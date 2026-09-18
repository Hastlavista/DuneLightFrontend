import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize, forkJoin, of } from 'rxjs';
import { GrantDto, GrantGroupUpsertRequest } from '../../../../../../core/models/permissions.model';
import { GrantGroupsService } from '../../../../../../core/services/grant-groups.service';
import { GrantsService } from '../../../../../../core/services/grants.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { ALL_CAPABILITIES, CAPABILITY_SECTIONS, CapabilitySection, MANAGED_GRANT_KEYS } from './grant-capabilities';

/** Route param sentinel for create mode - same convention as Zaposlenici/Grupe. */
const NEW_ID = 'new';

interface ModuleGroup {
  module: string;
  grants: GrantDto[];
}

/** GrantGroup form (Owner-only) - a full routed page rather than a modal, since
 * the ~42-entry grant catalog needs real room to stay scannable.
 *
 * The grant catalog itself (GrantDto{key, module, description}) stays exactly
 * as granular as the backend defines it - what changed is how it's presented:
 * instead of one flat "raw key" checkbox list grouped by backend module, the
 * bulk of the catalog is now organized into page/action "capabilities" (see
 * grant-capabilities.ts) - an Owner picks "Raspored: može kreirati vlastite
 * termine" instead of separately hunting down `appointments.write.own` AND
 * the `catalog.services.view`/`catalog.companies.view` it silently needs to
 * actually work. Any raw grant the capability catalog doesn't yet know about
 * (a brand new backend grant, or one this file hasn't been updated for) still
 * shows up, unmodeled, in the "Napredno" fallback section at the bottom -
 * nothing becomes ungrantable through this UI.
 *
 * Saving sends the full resolved key list (GrantGroupUpsertRequest.grants) -
 * there's no incremental add/remove endpoint. */
@Component({
  selector: 'app-admin-grant-group-form',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    InputText,
    Button,
    TranslatePipe,
  ],
  templateUrl: './grant-group-form.component.html',
  styleUrl: './grant-group-form.component.scss',
})
export class GrantGroupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly grantsService = inject(GrantsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly catalog = signal<GrantDto[]>([]);

  /** Capability-level selection (drives every named section) - keyed by each
   * capability's primaryGrant, which is unique across the whole catalog. */
  readonly enabledCapabilities = signal<Set<string>>(new Set());

  /** Manual raw-key selection for the "Napredno" fallback section only. */
  readonly unmanagedSelected = signal<Set<string>>(new Set());

  readonly sections: CapabilitySection[] = CAPABILITY_SECTIONS;

  /** Whatever the live catalog contains that no capability above claims
   * (either as its primaryGrant or one of its impliedGrants) - grouped by raw
   * backend module exactly like the old flat UI, as a safety net. */
  readonly unmanagedGroups = computed<ModuleGroup[]>(() => {
    const byModule = new Map<string, GrantDto[]>();
    for (const grant of this.catalog()) {
      if (MANAGED_GRANT_KEYS.has(grant.key)) {
        continue;
      }
      const list = byModule.get(grant.module) ?? [];
      list.push(grant);
      byModule.set(grant.module, list);
    }
    return Array.from(byModule.entries()).map(([module, grants]) => ({ module, grants }));
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    this.loading.set(true);
    forkJoin({
      catalog: this.grantsService.getAll(),
      group: id ? this.grantGroupsService.getById(id) : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ catalog, group }) => {
          this.catalog.set(catalog);
          if (group) {
            this.form.reset({ name: group.name });
            const grants = new Set(group.grants);
            this.enabledCapabilities.set(
              new Set(ALL_CAPABILITIES.filter((capability) => grants.has(capability.primaryGrant)).map((capability) => capability.primaryGrant)),
            );
            this.unmanagedSelected.set(new Set(group.grants.filter((key) => !MANAGED_GRANT_KEYS.has(key))));
          }
        },
        error: () => this.navigateBack(),
      });
  }

  isCapabilityEnabled(primaryGrant: string): boolean {
    return this.enabledCapabilities().has(primaryGrant);
  }

  onToggleCapability(primaryGrant: string, checked: boolean): void {
    this.enabledCapabilities.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(primaryGrant);
      } else {
        next.delete(primaryGrant);
      }
      return next;
    });
  }

  sectionCheckedCount(section: CapabilitySection): number {
    const enabled = this.enabledCapabilities();
    return section.capabilities.filter((capability) => enabled.has(capability.primaryGrant)).length;
  }

  isUnmanagedChecked(key: string): boolean {
    return this.unmanagedSelected().has(key);
  }

  onToggleUnmanaged(key: string, checked: boolean): void {
    this.unmanagedSelected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  unmanagedCheckedCount(group: ModuleGroup): number {
    const selected = this.unmanagedSelected();
    return group.grants.filter((grant) => selected.has(grant.key)).length;
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Rebuilt from scratch every save, purely as a function of current state -
    // no incremental bookkeeping, so unchecking one capability never drops a
    // grant still required by another currently-enabled one (e.g.
    // catalog.services.view stays granted as long as either "Raspored:
    // vlastiti termini" or "Usluge: pregled" is still on).
    const managed = new Set<string>();
    for (const capability of ALL_CAPABILITIES) {
      if (this.enabledCapabilities().has(capability.primaryGrant)) {
        managed.add(capability.primaryGrant);
        capability.impliedGrants.forEach((grant) => managed.add(grant));
      }
    }
    const grants = Array.from(new Set([...managed, ...this.unmanagedSelected()]));

    const request: GrantGroupUpsertRequest = {
      name: this.form.getRawValue().name,
      grants,
    };

    const id = this.editingId();
    const request$ = id ? this.grantGroupsService.update(id, request) : this.grantGroupsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(
          this.translate.instant(id ? 'PERMISSIONS.GRANT_GROUPS.UPDATED' : 'PERMISSIONS.GRANT_GROUPS.CREATED'),
        );
        this.navigateBack();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.navigateBack();
  }

  private navigateBack(): void {
    this.router.navigate(['/app/permissions'], { queryParams: { tab: 'grant-groups' } });
  }
}
