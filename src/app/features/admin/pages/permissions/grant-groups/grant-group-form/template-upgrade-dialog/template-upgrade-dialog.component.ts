import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Panel } from 'primeng/panel';
import { finalize } from 'rxjs';
import { AppError } from '../../../../../../../core/models/api-error.model';
import { CapabilityDiffEntryDto, ConflictResolution, GrantGroupTemplateDiffDto } from '../../../../../../../core/models/capability.model';
import { capabilityLabelKey, resolveOrFallback } from '../../../../../../../core/permissions/capability-presentation';
import { GrantGroupsService } from '../../../../../../../core/services/grant-groups.service';
import { NotificationService } from '../../../../../../../core/services/notification.service';
import { ConflictResolutionRowComponent } from './conflict-resolution-row/conflict-resolution-row.component';

/**
 * DefaultRoleTemplate v2 upgrade review/apply dialog (plan section 5). Follows
 * StockTransferDialogComponent's structural precedent: model(false) visible,
 * input.required for the subject GrantGroup, output<void> on success, an
 * effect() that resets state on open, and an AppError.code-based switch in
 * the HTTP error handler.
 *
 * This dialog NEVER computes or derives raw grants itself - it only ever
 * renders what GrantGroupTemplateDiffDto/GrantGroupAuthoringStateDto already
 * contain. Capability materialization stays backend-only.
 */
@Component({
  selector: 'app-template-upgrade-dialog',
  imports: [Dialog, Button, Panel, TranslatePipe, ConflictResolutionRowComponent],
  templateUrl: './template-upgrade-dialog.component.html',
  styleUrl: './template-upgrade-dialog.component.scss',
})
export class TemplateUpgradeDialogComponent {
  private readonly grantGroupsService = inject(GrantGroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly grantGroupId = input.required<string>();
  readonly targetVersion = input.required<number>();
  readonly applied = output<void>();

  readonly loading = signal(false);
  readonly applying = signal(false);
  readonly diff = signal<GrantGroupTemplateDiffDto | null>(null);
  /** Starts EMPTY on every open - never pre-filled with the backend's
   * `defaultResolution`, per the strict conflict-gating decision: nothing
   * counts as resolved until the viewer explicitly picks a radio or the bulk
   * "Zadrži sve moje postavke" action runs. */
  readonly resolutions = signal<Map<string, ConflictResolution>>(new Map());
  readonly staleState = signal(false);
  readonly conflictResolutionRequiredError = signal(false);
  readonly loadError = signal(false);

  readonly changedMinusConflicts = computed<CapabilityDiffEntryDto[]>(() => {
    const diff = this.diff();
    if (!diff) return [];
    const conflictKeys = new Set(diff.conflicts.map((c) => c.capabilityKey));
    return diff.changedCapabilities.filter((c) => !conflictKeys.has(c.capabilityKey));
  });

  readonly isNoOpDiff = computed<boolean>(() => {
    const diff = this.diff();
    if (!diff) return false;
    return diff.addedCapabilities.length === 0 && diff.removedCapabilities.length === 0 && diff.changedCapabilities.length === 0 && diff.conflicts.length === 0;
  });

  readonly allConflictsResolved = computed<boolean>(() => (this.diff()?.conflicts ?? []).every((c) => this.resolutions().has(c.capabilityKey)));

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetState();
        this.loadDiff();
      }
    });
  }

  private resetState(): void {
    this.diff.set(null);
    this.resolutions.set(new Map());
    this.staleState.set(false);
    this.conflictResolutionRequiredError.set(false);
    this.loadError.set(false);
  }

  // Close + quick reopen starts a second load; the first must not land later and
  // wipe conflict resolutions the user already picked on the second.
  private loadToken = 0;

  private loadDiff(): void {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.loadError.set(false);
    this.grantGroupsService
      .getTemplateUpgradeDiff(this.grantGroupId(), this.targetVersion())
      .pipe(finalize(() => token === this.loadToken && this.loading.set(false)))
      .subscribe({
        next: (diff) => {
          if (token !== this.loadToken) {
            return;
          }
          this.diff.set(diff);
          this.resolutions.set(new Map());
        },
        error: () => token === this.loadToken && this.loadError.set(true),
      });
  }

  capabilityLabel(key: string): string {
    return resolveOrFallback(this.translate, capabilityLabelKey(key), key);
  }

  resolutionFor(capabilityKey: string): ConflictResolution | null {
    return this.resolutions().get(capabilityKey) ?? null;
  }

  onResolutionChange(capabilityKey: string, resolution: ConflictResolution): void {
    this.resolutions.update((current) => {
      const next = new Map(current);
      next.set(capabilityKey, resolution);
      return next;
    });
  }

  onPreserveAll(): void {
    const diff = this.diff();
    if (!diff) return;
    this.resolutions.update((current) => {
      const next = new Map(current);
      diff.conflicts.forEach((c) => next.set(c.capabilityKey, 'PreserveCurrent'));
      return next;
    });
  }

  onRefresh(): void {
    this.staleState.set(false);
    this.conflictResolutionRequiredError.set(false);
    this.loadDiff();
  }

  onApply(): void {
    const diff = this.diff();
    if (!diff || !this.allConflictsResolved() || this.applying()) return;

    this.staleState.set(false);
    this.conflictResolutionRequiredError.set(false);
    const conflictKeys = new Set(diff.conflicts.map((c) => c.capabilityKey));
    const request = {
      targetTemplateVersion: this.targetVersion(),
      resolutions: [...this.resolutions()].filter(([key]) => conflictKeys.has(key)).map(([capabilityKey, resolution]) => ({ capabilityKey, resolution })),
      stateToken: diff.stateToken,
    };

    this.applying.set(true);
    this.grantGroupsService
      .applyTemplateUpgrade(this.grantGroupId(), request, { suppressErrorToast: true })
      .pipe(finalize(() => this.applying.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('PERMISSIONS.GRANT_GROUPS.UPGRADE.APPLIED_SUCCESS'));
          this.visible.set(false);
          this.applied.emit();
        },
        error: (err: AppError) => {
          if (err.code === 'GRANT_GROUP_UPGRADE_STATE_CHANGED') {
            this.staleState.set(true);
          } else if (err.code === 'GRANT_GROUP_UPGRADE_CONFLICT_RESOLUTION_REQUIRED') {
            // Should never happen given the frontend's own allConflictsResolved()
            // gate - this is the backend's real enforcement boundary, surfaced
            // here as defense in depth.
            this.conflictResolutionRequiredError.set(true);
          } else {
            this.notifications.showAppError(err);
          }
        },
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
