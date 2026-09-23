import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CapabilityDefinitionDto, CapabilitySelectedScope, GrantGroupAuthoringStateDto, GrantGroupCapabilityWriteRequest, GrantGroupTemplateUpgradeStatusDto } from '../../../../../../core/models/capability.model';
import { GrantDto } from '../../../../../../core/models/permissions.model';
import { CapabilityReconstruction, CapabilitySelectionResult, materializeCapability, reconstructGrantProvenance } from '../../../../../../core/permissions/capability-materialization';
import { capabilityDescriptionKey, capabilityLabelKey, categoryLabelKey, CapabilityCategoryGroup, groupByCategory, resolveOrFallback } from '../../../../../../core/permissions/capability-presentation';
import { CapabilitiesService } from '../../../../../../core/services/capabilities.service';
import { GrantGroupsService } from '../../../../../../core/services/grant-groups.service';
import { GrantsService } from '../../../../../../core/services/grants.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { CapabilityScopeControlComponent } from './capability-scope-control/capability-scope-control.component';
import { CapabilitySensitivityBadgeComponent } from './capability-sensitivity-badge/capability-sensitivity-badge.component';
import { RoleSummaryComponent } from './role-summary/role-summary.component';
import { TemplateUpgradeDialogComponent } from './template-upgrade-dialog/template-upgrade-dialog.component';

const NEW_ID = 'new';
interface ModuleGroup { module: string; grants: GrantDto[]; }

/** Role editor, gated on permissions.manage. The backend, never Angular, materializes raw grants. */
@Component({
  selector: 'app-admin-grant-group-form',
  imports: [ReactiveFormsModule, FormsModule, InputText, Button, TranslatePipe, CapabilityScopeControlComponent, CapabilitySensitivityBadgeComponent, RoleSummaryComponent, TemplateUpgradeDialogComponent],
  templateUrl: './grant-group-form.component.html',
  styleUrl: './grant-group-form.component.scss',
})
export class GrantGroupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly grantsService = inject(GrantsService);
  private readonly capabilitiesService = inject(CapabilitiesService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly catalogError = signal(false);
  readonly capabilities = signal<CapabilityDefinitionDto[]>([]);
  readonly rawCatalog = signal<GrantDto[]>([]);
  readonly authoringState = signal<GrantGroupAuthoringStateDto | null>(null);
  readonly upgradeStatus = signal<GrantGroupTemplateUpgradeStatusDto | null>(null);
  readonly upgradeDialogVisible = signal(false);
  private readonly legacyRawGrants = signal<string[]>([]);
  private readonly loadedCapabilityDerived = signal<Set<string>>(new Set());
  private baseline = '';

  readonly selectedScopes = signal<Map<string, CapabilitySelectedScope>>(new Map());
  readonly manualAdvancedSelected = signal<Set<string>>(new Set());
  readonly reconstruction = computed<CapabilityReconstruction>(() => reconstructGrantProvenance(this.capabilities(), this.legacyRawGrants(), null));
  readonly categoryGroups = computed<CapabilityCategoryGroup[]>(() => groupByCategory(this.capabilities()));
  readonly isLegacy = computed(() => this.isEditMode() && this.authoringState()?.hasCapabilityMetadata === false);
  readonly derivedGrantKeys = computed(() => {
    const state = this.authoringState();
    const keys = this.materializedSelectedCapabilityKeys();
    if (state?.hasCapabilityMetadata) {
      // Preserve template compatibility extras as read-only, while allowing
      // grants released by a changed capability selection to become unclaimed.
      const compatibilityExtras = state.derivedGrantKeys.filter((key) => !this.loadedCapabilityDerived().has(key));
      compatibilityExtras.forEach((key) => keys.add(key));
    }
    return keys;
  });
  readonly manualPickableGroups = computed<ModuleGroup[]>(() => {
    const derived = this.derivedGrantKeys();
    const byModule = new Map<string, GrantDto[]>();
    for (const grant of this.rawCatalog()) {
      if (derived.has(grant.key)) continue;
      const grants = byModule.get(grant.module) ?? [];
      grants.push(grant);
      byModule.set(grant.module, grants);
    }
    return [...byModule].map(([module, grants]) => ({ module, grants }));
  });
  readonly form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(255)]] });

  constructor() {
    const param = this.route.snapshot.paramMap.get('id');
    this.editingId.set(param && param !== NEW_ID ? param : null);
    this.form.valueChanges.subscribe(() => this.refreshDirty());
    this.load();
  }

  retryLoadCatalog(): void { this.load(); }
  private load(): void {
    this.catalogError.set(false); this.loading.set(true);
    const id = this.editingId();
    forkJoin({
      capabilities: this.capabilitiesService.getDefinitions().pipe(catchError(() => { this.catalogError.set(true); return of([] as CapabilityDefinitionDto[]); })),
      rawCatalog: this.grantsService.getAll(),
      state: id ? this.grantGroupsService.getAuthoringState(id) : of(null),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ capabilities, rawCatalog, state }) => {
        this.capabilities.set(capabilities);
        this.rawCatalog.set(rawCatalog);
        this.applyAuthoritativeState(state);
        this.fetchUpgradeStatusIfNeeded(state);
      },
      error: () => this.navigateBack(),
    });
  }
  /** Only called when the loaded authoring state has non-null
   * `templateSourceKey` - a custom/no-provenance role never shows an upgrade
   * banner, so this call is skipped entirely rather than fetched and hidden
   * (Part N). */
  private fetchUpgradeStatusIfNeeded(state: GrantGroupAuthoringStateDto | null): void {
    const id = this.editingId();
    if (!id || !state?.templateSourceKey) { this.upgradeStatus.set(null); return; }
    this.grantGroupsService.getTemplateUpgradeStatus(id).subscribe({
      next: (status) => this.upgradeStatus.set(status),
      error: () => this.upgradeStatus.set(null),
    });
  }
  openUpgradeReview(): void { this.upgradeDialogVisible.set(true); }
  onUpgradeApplied(): void {
    const id = this.editingId();
    if (!id) return;
    this.reloadAuthoringState(id);
    this.grantGroupsService.getTemplateUpgradeStatus(id).subscribe({
      next: (status) => this.upgradeStatus.set(status),
      error: () => this.upgradeStatus.set(null),
    });
  }
  private applyAuthoritativeState(state: GrantGroupAuthoringStateDto | null): void {
    this.authoringState.set(state);
    this.legacyRawGrants.set(state?.grantGroup.grants ?? []);
    this.form.reset({ name: state?.grantGroup.name ?? '' }, { emitEvent: false });
    if (state?.hasCapabilityMetadata) {
      const scopes = new Map<string, CapabilitySelectedScope>(this.capabilities().map((capability) => [capability.key, 'None']));
      state.capabilitySelections.forEach((selection) => scopes.set(selection.capabilityKey, selection.selectedScope));
      this.selectedScopes.set(scopes);
      this.manualAdvancedSelected.set(new Set(state.manualGrantKeys));
      this.loadedCapabilityDerived.set(this.materializedSelectedCapabilityKeys());
    } else {
      const recon = this.reconstruction();
      this.selectedScopes.set(new Map(recon.selections.map((s) => [s.capability.key, s.selectedScope ?? 'None'])));
      // Unmatched legacy grants remain explicit manual grants on conversion.
      this.manualAdvancedSelected.set(new Set(recon.manualGrantKeys));
      this.loadedCapabilityDerived.set(new Set());
    }
    this.resetBaseline();
  }

  scopeFor(key: string): CapabilitySelectedScope { return this.selectedScopes().get(key) ?? 'None'; }
  onScopeChange(key: string, scope: CapabilitySelectedScope): void {
    this.selectedScopes.update((current) => { const next = new Map(current); next.set(key, scope); return next; });
    this.manualAdvancedSelected.update((current) => new Set([...current].filter((grant) => !this.derivedGrantKeys().has(grant))));
    this.refreshDirty();
  }
  get previewSelections(): CapabilitySelectionResult[] { return this.capabilities().map((capability) => ({ capability, selectedScope: this.scopeFor(capability.key), claimedGrantKeys: new Set<string>() })); }
  isCapabilityUnmatched(key: string): boolean { return this.isLegacy() && this.reconstruction().selections.some((s) => s.capability.key === key && s.selectedScope === null); }
  labelFor(key: string): string { return resolveOrFallback(this.translate, capabilityLabelKey(key), key); }
  descriptionFor(key: string): string { return resolveOrFallback(this.translate, capabilityDescriptionKey(key), key); }
  categoryLabel(key: string): string { return resolveOrFallback(this.translate, categoryLabelKey(key), key); }
  isManualChecked(key: string): boolean { return this.manualAdvancedSelected().has(key); }
  onToggleManual(key: string, checked: boolean): void {
    if (checked && this.derivedGrantKeys().has(key)) return;
    this.manualAdvancedSelected.update((current) => { const next = new Set(current); checked ? next.add(key) : next.delete(key); return next; });
    this.refreshDirty();
  }
  manualCheckedCount(group: ModuleGroup): number { return group.grants.filter((g) => this.isManualChecked(g.key)).length; }
  rawGrantDescription(key: string): string { return this.rawCatalog().find((g) => g.key === key)?.description ?? key; }

  onSave(): void {
    if (this.saving() || !this.dirty()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.isLegacy()) {
      this.confirmation.confirm({
        header: this.translate.instant('COMMON.CONFIRM_HEADER'), icon: 'pi pi-exclamation-triangle',
        message: this.translate.instant('PERMISSIONS.GRANT_GROUPS.CONVERT_CONFIRM', this.legacyDiff()),
        acceptLabel: this.translate.instant('COMMON.YES'), rejectLabel: this.translate.instant('COMMON.NO'),
        accept: () => this.persist(),
      });
      return;
    }
    this.persist();
  }
  private persist(): void {
    const request = this.writeRequest(); const id = this.editingId(); this.saving.set(true);
    (id ? this.grantGroupsService.updateCapabilityBased(id, request) : this.grantGroupsService.createCapabilityBased(request)).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (group) => {
        const savedId = id ?? group.id;
        this.notifications.showSuccess(this.translate.instant(id ? 'PERMISSIONS.GRANT_GROUPS.UPDATED' : 'PERMISSIONS.GRANT_GROUPS.CREATED'));
        if (!id) { this.editingId.set(savedId); this.router.navigate(['/app/permissions/grant-groups', savedId], { replaceUrl: true }); }
        this.reloadAuthoringState(savedId);
      },
      // The global error interceptor already shows a translated toast for
      // this failure (see error.interceptor.ts) - nothing page-specific to
      // add here, so this only needs to exist to keep the editor open with
      // the unsaved input intact (the default RxJS behavior on an
      // unhandled `error` from subscribe would otherwise be to just not call
      // `next`, which already happens - this callback exists so `finalize`
      // runs and `saving` resets without an unhandled-error console warning).
      error: () => {},
    });
  }
  private reloadAuthoringState(id: string): void {
    this.grantGroupsService.getAuthoringState(id).subscribe({ next: (state) => this.applyAuthoritativeState(state), error: () => {} });
  }
  private writeRequest(): GrantGroupCapabilityWriteRequest {
    return {
      name: this.form.getRawValue().name,
      capabilitySelections: this.capabilities().flatMap((capability) => {
        const selectedScope = this.scopeFor(capability.key);
        return selectedScope === 'None' ? [] : [{ capabilityKey: capability.key, capabilityVersion: capability.version, selectedScope }];
      }),
      manualGrantKeys: [...this.manualAdvancedSelected()].filter((key) => !this.derivedGrantKeys().has(key)),
    };
  }
  private legacyDiff(): object {
    const raw = new Set(this.legacyRawGrants()); const derived = this.derivedGrantKeys(); const manual = this.manualAdvancedSelected();
    return { raw: raw.size, explained: [...raw].filter((key) => derived.has(key)).length, manual: manual.size, removed: [...raw].filter((key) => !derived.has(key) && !manual.has(key)).length };
  }
  private materializedSelectedCapabilityKeys(): Set<string> {
    const keys = new Set<string>();
    for (const capability of this.capabilities()) materializeCapability(capability.scopeModel, this.scopeFor(capability.key), capability.grants).forEach((key) => keys.add(key));
    return keys;
  }
  private snapshot(): string { return JSON.stringify({ name: this.form.getRawValue().name, scopes: [...this.selectedScopes()].sort(), manual: [...this.manualAdvancedSelected()].sort() }); }
  private resetBaseline(): void { this.baseline = this.snapshot(); this.dirty.set(false); }
  private refreshDirty(): void { this.dirty.set(this.snapshot() !== this.baseline); }
  onCancel(): void { this.navigateBack(); }
  private navigateBack(): void { this.router.navigate(['/app/permissions'], { queryParams: { tab: 'grant-groups' } }); }
}
