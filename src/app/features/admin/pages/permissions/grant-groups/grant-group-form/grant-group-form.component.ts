import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Accordion, AccordionContent, AccordionHeader, AccordionPanel } from 'primeng/accordion';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { finalize, forkJoin, of } from 'rxjs';
import { GrantDto, GrantGroupUpsertRequest } from '../../../../../../core/models/permissions.model';
import { GrantGroupsService } from '../../../../../../core/services/grant-groups.service';
import { GrantsService } from '../../../../../../core/services/grants.service';
import { NotificationService } from '../../../../../../core/services/notification.service';

/** Route param sentinel for create mode - same convention as Zaposlenici/Grupe. */
const NEW_ID = 'new';

interface ModuleGroup {
  module: string;
  grants: GrantDto[];
}

/** GrantGroup form (Owner-only) - a full routed page rather than a modal, since
 * the ~42-entry grant catalog needs real room, grouped by module into an
 * accordion so the list stays scannable instead of one long flat checkbox
 * list. Saving sends the full selected key list (GrantGroupUpsertRequest.grants) -
 * there's no incremental add/remove endpoint. */
@Component({
  selector: 'app-admin-grant-group-form',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    InputText,
    Checkbox,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
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
  readonly selectedGrants = signal<Set<string>>(new Set());
  readonly accordionValue = signal<string[]>([]);

  readonly moduleGroups = computed<ModuleGroup[]>(() => {
    const byModule = new Map<string, GrantDto[]>();
    for (const grant of this.catalog()) {
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
          this.accordionValue.set(Array.from(new Set(catalog.map((grant) => grant.module))));
          if (group) {
            this.form.reset({ name: group.name });
            this.selectedGrants.set(new Set(group.grants));
          }
        },
        error: () => this.navigateBack(),
      });
  }

  isChecked(key: string): boolean {
    return this.selectedGrants().has(key);
  }

  moduleCheckedCount(group: ModuleGroup): number {
    const selected = this.selectedGrants();
    return group.grants.filter((grant) => selected.has(grant.key)).length;
  }

  onToggle(key: string, checked: boolean): void {
    this.selectedGrants.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request: GrantGroupUpsertRequest = {
      name: this.form.getRawValue().name,
      grants: Array.from(this.selectedGrants()),
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
    this.router.navigate(['/admin/permissions'], { queryParams: { tab: 'grant-groups' } });
  }
}
