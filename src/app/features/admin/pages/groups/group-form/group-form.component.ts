import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { EmployeeDto } from '../../../../../core/models/employee.model';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  GroupCreateRequest,
  GroupDetailDto,
  GroupSlotRequest,
  GroupUpdateRequest,
  dayOfWeekTranslationKey,
} from '../../../../../core/models/group.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { ServiceDto } from '../../../../../core/models/service.model';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { GroupsService } from '../../../../../core/services/groups.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { toTimeOfDayString } from '../../../../../core/utils/time-of-day.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { GroupAppointmentsSectionComponent } from './group-appointments-section.component';
import { GroupMembersSectionComponent } from './group-members-section.component';
import { GroupSlotsSectionComponent } from './group-slots-section.component';

/** Route param sentinel for create mode - see admin.routes.ts ('groups/:id'
 * instead of a separate 'new' route), same convention as Zaposlenici/Paketi. */
const NEW_ID = 'new';

/** pageSize max is 200 - fetches the full active set in one page for the
 * service/location/trainer pickers. */
const LOOKUP_PAGE_SIZE = 200;

export interface RefOption {
  id: string;
  name: string;
}

interface DayOption {
  label: string;
  value: DayOfWeek;
}

/** Array-level: at least one slot on create (the backend requires it too -
 * VALIDATION_ERROR otherwise). Not used in edit mode - slots there are managed
 * through their own endpoints, see GroupSlotsSectionComponent. */
function slotsArrayValidator(control: AbstractControl): ValidationErrors | null {
  return (control as FormArray).length > 0 ? null : { noSlots: true };
}

@Component({
  selector: 'app-admin-group-form',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    Select,
    DatePicker,
    Button,
    TranslatePipe,
    GroupSlotsSectionComponent,
    GroupMembersSectionComponent,
    GroupAppointmentsSectionComponent,
  ],
  templateUrl: './group-form.component.html',
  styleUrl: './group-form.component.scss',
})
export class GroupFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly groupsService = inject(GroupsService);
  private readonly servicesService = inject(ServicesService);
  private readonly locationsService = inject(LocationsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly loadedGroup = signal<GroupDetailDto | null>(null);

  readonly activeServices = signal<ServiceDto[]>([]);
  readonly activeLocations = signal<LocationDto[]>([]);
  readonly activeTrainers = signal<EmployeeDto[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly dayOptions = computed<DayOption[]>(() => {
    this.translationsReady();
    return DAYS_OF_WEEK.map((day) => ({ label: this.translate.instant(dayOfWeekTranslationKey(day)), value: day }));
  });

  readonly serviceOptions = computed<RefOption[]>(() =>
    this.mergeOptions(
      this.activeServices().map((service) => ({ id: service.id, name: service.name })),
      this.groupRefOption((group) => ({ id: group.serviceId, name: group.serviceName })),
    ),
  );

  readonly locationOptions = computed<RefOption[]>(() =>
    this.mergeOptions(
      this.activeLocations().map((location) => ({ id: location.id, name: location.name })),
      this.groupRefOption((group) => ({ id: group.locationId, name: group.locationName })),
    ),
  );

  readonly trainerOptions = computed<RefOption[]>(() =>
    this.mergeOptions(
      this.activeTrainers().map((trainer) => ({ id: trainer.id, name: `${trainer.firstName} ${trainer.lastName}` })),
      this.groupRefOption((group) =>
        group.defaultTrainerId ? { id: group.defaultTrainerId, name: group.defaultTrainerName ?? '' } : null,
      ),
    ),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    serviceId: this.fb.control<string | null>(null, Validators.required),
    locationId: this.fb.control<string | null>(null, Validators.required),
    capacity: this.fb.control<number | null>(1, [Validators.required, Validators.min(1)]),
    defaultTrainerId: this.fb.control<string | null>(null),
    note: [''],
    slots: this.fb.array<FormGroup>([], slotsArrayValidator),
  });

  get slotsArray(): FormArray {
    return this.form.controls.slots;
  }

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    this.loadActiveServices();
    this.loadActiveLocations();
    this.loadActiveTrainers();

    if (id) {
      // Slots aren't part of the edit-mode form at all (see
      // GroupSlotsSectionComponent) - the array-level "at least one slot"
      // validator only makes sense on create, so it's dropped here. Otherwise
      // the permanently-empty, hidden FormArray would keep the whole form
      // invalid and block saving basic info.
      this.slotsArray.clearValidators();
      this.slotsArray.updateValueAndValidity();
      this.loadGroup(id);
    } else {
      this.addSlotRow();
    }
  }

  addSlotRow(): void {
    const group = this.fb.nonNullable.group({
      dayOfWeek: this.fb.nonNullable.control<DayOfWeek>('Monday', Validators.required),
      startTime: this.fb.control<Date | null>(null, Validators.required),
    });
    this.slotsArray.push(group);
    this.slotsArray.updateValueAndValidity();
  }

  removeSlotRow(index: number): void {
    this.slotsArray.removeAt(index);
    this.slotsArray.updateValueAndValidity();
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    this.saving.set(true);

    if (id) {
      this.groupsService
        .update(id, this.toUpdateRequest())
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.UPDATED'));
            this.loadGroup(id);
          },
          error: () => {},
        });
    } else {
      this.groupsService
        .create(this.toCreateRequest())
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: (created) => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.CREATED'));
            this.router.navigate(['/admin/groups', created.id]);
          },
          error: () => {},
        });
    }
  }

  onCancel(): void {
    this.navigateBack();
  }

  /** Slots/members mutations return only a GroupDto (or nothing) - simplest to
   * just refetch the full detail rather than reconcile partial state. */
  onChildChanged(): void {
    const id = this.editingId();
    if (id) {
      this.loadGroup(id, { quiet: true });
    }
  }

  private toCommonRequest(): { name: string; serviceId: string; locationId: string; capacity: number; defaultTrainerId: string | null; note: string | null } {
    const raw = this.form.getRawValue();
    return {
      name: raw.name,
      serviceId: raw.serviceId as string,
      locationId: raw.locationId as string,
      capacity: raw.capacity as number,
      defaultTrainerId: raw.defaultTrainerId,
      note: raw.note || null,
    };
  }

  private toCreateRequest(): GroupCreateRequest {
    const raw = this.form.getRawValue();
    const slots: GroupSlotRequest[] = raw.slots.map((row) => ({
      dayOfWeek: row['dayOfWeek'],
      startTime: toTimeOfDayString(row['startTime'] as Date),
    }));
    return { ...this.toCommonRequest(), slots };
  }

  private toUpdateRequest(): GroupUpdateRequest {
    return this.toCommonRequest();
  }

  private mergeOptions(active: RefOption[], loaded: RefOption | null): RefOption[] {
    this.translationsReady();
    if (!loaded || active.some((option) => option.id === loaded.id)) {
      return active;
    }
    const badge = this.translate.instant('GROUPS.INACTIVE_BADGE');
    return [...active, { id: loaded.id, name: `${loaded.name} (${badge})` }];
  }

  private groupRefOption(select: (group: GroupDetailDto) => RefOption | null): RefOption | null {
    const group = this.loadedGroup();
    return group ? select(group) : null;
  }

  private loadActiveServices(): void {
    this.servicesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeServices.set(result.items));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }

  private loadActiveTrainers(): void {
    this.employeesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeTrainers.set(result.items));
  }

  private loadGroup(id: string, options?: { quiet?: boolean }): void {
    if (!options?.quiet) {
      this.loading.set(true);
    }
    this.groupsService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (group) => this.applyGroup(group),
        error: () => {
          if (!options?.quiet) {
            this.navigateBack();
          }
        },
      });
  }

  private applyGroup(group: GroupDetailDto): void {
    this.loadedGroup.set(group);

    this.form.reset(
      {
        name: group.name,
        serviceId: group.serviceId,
        locationId: group.locationId,
        capacity: group.capacity,
        defaultTrainerId: group.defaultTrainerId,
        note: group.note ?? '',
        slots: [],
      },
      { emitEvent: false },
    );
  }

  private navigateBack(): void {
    this.router.navigate(['/admin/groups']);
  }
}
