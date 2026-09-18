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
import { finalize } from 'rxjs';
import { EmployeeDirectoryDto } from '../../../../../core/models/employee.model';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  GroupCreateRequest,
  GroupDetailDto,
  GroupSlotRequest,
  GroupUpdateRequest,
  dayOfWeekTranslationKey,
} from '../../../../../core/models/group.model';
import { CompanyDto } from '../../../../../core/models/company.model';
import { RoomDto } from '../../../../../core/models/room.model';
import { ServiceDto, ServiceExecutionMode } from '../../../../../core/models/service.model';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { GroupsService } from '../../../../../core/services/groups.service';
import { CompaniesService } from '../../../../../core/services/companies.service';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { RoomsService } from '../../../../../core/services/rooms.service';
import { ServicesService } from '../../../../../core/services/services.service';
import { toTimeOfDayString } from '../../../../../core/utils/time-of-day.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { resolveWarningMessage } from '../../../../../core/utils/warning-translation.util';
import { GroupAppointmentsSectionComponent } from './group-appointments-section.component';
import { GroupMembersSectionComponent } from './group-members-section.component';
import { GroupSlotsSectionComponent } from './group-slots-section.component';

/** Route param sentinel for create mode - see admin.routes.ts ('groups/:id'
 * instead of a separate 'new' route), same convention as Zaposlenici/Paketi. */
const NEW_ID = 'new';

/** pageSize max is 200 - fetches the full active set in one page for the
 * service/company/trainer pickers. */
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
  private readonly companiesService = inject(CompaniesService);
  private readonly employeesService = inject(EmployeesService);
  private readonly roomsService = inject(RoomsService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
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
  readonly activeCompanies = signal<CompanyDto[]>([]);
  readonly activeTrainers = signal<EmployeeDirectoryDto[]>([]);
  readonly activeRooms = signal<RoomDto[]>([]);

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

  readonly companyOptions = computed<RefOption[]>(() =>
    this.mergeOptions(
      this.activeCompanies().map((company) => ({ id: company.id, name: company.name })),
      this.groupRefOption((group) => ({ id: group.companyId, name: group.companyName })),
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

  readonly roomOptions = computed<RefOption[]>(() =>
    this.mergeOptions(
      this.activeRooms().map((room) => ({ id: room.id, name: room.name })),
      this.groupRefOption((group) => (group.defaultRoomId ? { id: group.defaultRoomId, name: group.defaultRoomName ?? '' } : null)),
    ),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    serviceId: this.fb.control<string | null>(null, Validators.required),
    companyId: this.fb.control<string | null>(null, Validators.required),
    capacity: this.fb.control<number | null>(1, [Validators.required, Validators.min(1)]),
    defaultTrainerId: this.fb.control<string | null>(null),
    defaultRoomId: this.fb.control<string | null>(null),
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
    this.loadActiveCompanies();
    this.loadActiveTrainers();

    // Rooms belong to one company - reload whenever the picked company
    // changes (same trigger as NewAppointmentDialogComponent.refreshRooms).
    // No initial call needed: create mode starts with no company picked
    // (loadActiveRooms would just no-op), edit mode's applyGroup() resets
    // companyId to the loaded group's companyId, which fires this itself.
    this.form.controls.companyId.valueChanges.subscribe(() => this.loadActiveRooms());

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
    if (this.saving()) {
      return;
    }
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
          next: (updated) => {
            this.notifications.showSuccess(this.translate.instant('GROUPS.UPDATED'));
            for (const warning of updated.warnings) {
              this.notifications.showWarning(resolveWarningMessage(this.translate, warning));
            }
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
            for (const warning of created.warnings) {
              this.notifications.showWarning(resolveWarningMessage(this.translate, warning));
            }
            this.navigateBack();
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

  private toCommonRequest(): {
    name: string;
    serviceId: string;
    companyId: string;
    capacity: number;
    defaultTrainerId: string | null;
    defaultRoomId: string | null;
    note: string | null;
  } {
    const raw = this.form.getRawValue();
    return {
      name: raw.name,
      serviceId: raw.serviceId as string,
      companyId: raw.companyId as string,
      capacity: raw.capacity as number,
      defaultTrainerId: raw.defaultTrainerId,
      defaultRoomId: raw.defaultRoomId,
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

  /** Grupe can only run a Group-executionMode uslugu - Individual services
   * would produce per-client, not shared, termini and aren't valid here. */
  private loadActiveServices(): void {
    this.servicesService
      .getPage(
        { page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true },
        { suppressErrorToast: true, extraParams: { executionMode: 'Group' satisfies ServiceExecutionMode } },
      )
      .subscribe((result) => this.activeServices.set(result.items));
  }

  private loadActiveCompanies(): void {
    this.companiesService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeCompanies.set(result.items));
  }

  /** GET /api/employees/directory, not getPage()/`/api/employees` - the
   * trainer picker only needs id/firstName/lastName, not the full EmployeeDto
   * (salary/OIB/contact data included) that getPage() returns; the lighter
   * endpoint also doesn't require employees.view/.manage to succeed. */
  private loadActiveTrainers(): void {
    this.employeesService
      .getDirectory(true, { suppressErrorToast: true })
      .subscribe((result) => this.activeTrainers.set(result));
  }

  private loadActiveRooms(): void {
    const companyId = this.form.controls.companyId.value;
    if (!companyId) {
      this.activeRooms.set([]);
      return;
    }
    this.roomsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true, extraParams: { companyId } })
      .subscribe((result) => this.activeRooms.set(result.items));
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
        companyId: group.companyId,
        capacity: group.capacity,
        defaultTrainerId: group.defaultTrainerId,
        defaultRoomId: group.defaultRoomId,
        note: group.note ?? '',
        slots: [],
      },
      { emitEvent: false },
    );
  }

  private navigateBack(): void {
    this.router.navigate(['/app/groups']);
  }
}
