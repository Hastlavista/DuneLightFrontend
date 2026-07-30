import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';
import { ClientTagDto } from '../../../../../core/models/client-tag.model';
import { ClientDto, ClientUpsertRequest } from '../../../../../core/models/client.model';
import { EmployeeDirectoryDto } from '../../../../../core/models/employee.model';
import { LocationDto } from '../../../../../core/models/location.model';
import { ClientTagsService } from '../../../../../core/services/client-tags.service';
import { ClientsService } from '../../../../../core/services/clients.service';
import { EmployeesService } from '../../../../../core/services/employees.service';
import { LocationsService } from '../../../../../core/services/locations.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { toStartOfDayIso } from '../../../../../core/utils/date.util';
import { translationReadySignal } from '../../../../../core/utils/translation-signal.util';
import { ColorSwatchComponent } from '../../../../../shared/components/color-swatch/color-swatch.component';
import { ClientPackagesTabComponent } from './client-packages-tab.component';

/** Route param sentinel for create mode - see admin.routes.ts, same convention as
 * Zaposlenici/Paketi ('clients/:id' instead of a separate 'new' route). */
const NEW_ID = 'new';

/** pageSize max is 200 - fetches the full active set in one page for the
 * location/trainer/tag pickers. */
const LOOKUP_PAGE_SIZE = 200;

export interface ClientRefOption {
  id: string;
  name: string;
}

export interface ClientTagOption {
  id: string;
  name: string;
  colorHex: string | null;
}

/** Birth date can't be in the future - the backend rejects it (VALIDATION_ERROR),
 * the form blocks it first. */
function notFutureDateValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as Date | null;
  if (!value) {
    return null;
  }
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return value > endOfToday ? { futureDate: true } : null;
}

/** Group-level: if GDPR consent is given, its date is required - the backend
 * enforces this too (VALIDATION_ERROR) but the form blocks it first. */
function gdprConsentDateValidator(group: AbstractControl): ValidationErrors | null {
  const given = group.get('gdprConsentGiven')?.value as boolean;
  const date = group.get('gdprConsentDate')?.value as Date | null;
  return given && !date ? { gdprDateRequired: true } : null;
}

@Component({
  selector: 'app-admin-client-form',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    InputNumber,
    Select,
    MultiSelect,
    DatePicker,
    Checkbox,
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    ColorSwatchComponent,
    ClientPackagesTabComponent,
  ],
  templateUrl: './client-form.component.html',
  styleUrl: './client-form.component.scss',
})
export class ClientFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly clientsService = inject(ClientsService);
  private readonly locationsService = inject(LocationsService);
  private readonly employeesService = inject(EmployeesService);
  private readonly clientTagsService = inject(ClientTagsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  /** This component is reused verbatim at /app/my-clients/:id (see
   * trainer.routes.ts) - resolved once from the current URL rather than an
   * input, since it's a route concern, not something the host page passes down. */
  private readonly isTrainerContext = this.router.url.startsWith('/app');

  private readonly loadedClient = signal<ClientDto | null>(null);
  readonly isAnonymized = computed(() => this.loadedClient()?.isAnonymized ?? false);

  readonly activeLocations = signal<LocationDto[]>([]);
  readonly activeEmployees = signal<EmployeeDirectoryDto[]>([]);
  readonly activeTags = signal<ClientTagDto[]>([]);

  /** Home location/trainer/tags the client being edited already has, even if
   * since deactivated - kept visible in their picker (with a badge) instead of
   * silently dropped, same pattern as EmployeeFormComponent. Unlike Zaposlenici
   * there's no activity check on save either way - this is purely a display
   * nicety, not a validation concern. */
  private readonly loadedHomeLocation = signal<ClientRefOption | null>(null);
  private readonly loadedHomeTrainer = signal<ClientRefOption | null>(null);
  private readonly loadedTags = signal<ClientTagOption[]>([]);

  private readonly translationsReady = translationReadySignal(this.translate);

  readonly homeLocationOptions = computed<ClientRefOption[]>(() =>
    this.mergeOptions(
      this.activeLocations().map((location) => ({ id: location.id, name: location.name })),
      this.loadedHomeLocation() ? [this.loadedHomeLocation()!] : [],
    ),
  );

  readonly homeTrainerOptions = computed<ClientRefOption[]>(() =>
    this.mergeOptions(
      this.activeEmployees().map((employee) => ({ id: employee.id, name: `${employee.firstName} ${employee.lastName}` })),
      this.loadedHomeTrainer() ? [this.loadedHomeTrainer()!] : [],
    ),
  );

  readonly tagOptions = computed<ClientTagOption[]>(() => {
    this.translationsReady();
    const active = this.activeTags().map((tag) => ({ id: tag.id, name: tag.name, colorHex: tag.colorHex }));
    const activeIds = new Set(active.map((tag) => tag.id));
    const badge = this.translate.instant('CLIENTS.INACTIVE_BADGE');
    const grandfathered = this.loadedTags()
      .filter((tag) => !activeIds.has(tag.id))
      .map((tag) => ({ ...tag, name: `${tag.name} (${badge})` }));
    return [...active, ...grandfathered];
  });

  readonly form = this.fb.nonNullable.group(
    {
      memberNumber: this.fb.control<number | null>(null, Validators.required),
      firstName: ['', [Validators.required, Validators.maxLength(255)]],
      lastName: ['', [Validators.required, Validators.maxLength(255)]],
      dateOfBirth: this.fb.control<Date | null>(null, notFutureDateValidator),
      occupation: ['', Validators.maxLength(255)],
      phone: ['', Validators.maxLength(255)],
      email: ['', [Validators.maxLength(255), Validators.email]],
      note: [''],
      healthNote: [''],
      homeLocationId: this.fb.control<string | null>(null),
      homeTrainerId: this.fb.control<string | null>(null),
      tagIds: this.fb.nonNullable.control<string[]>([]),
      gdprConsentGiven: [false],
      gdprConsentDate: this.fb.control<Date | null>(null),
    },
    { validators: [gdprConsentDateValidator] },
  );

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam && idParam !== NEW_ID ? idParam : null;
    this.editingId.set(id);

    this.loadActiveLocations();
    this.loadActiveEmployees();
    this.loadActiveTags();

    if (id) {
      this.loadClient(id);
    } else {
      this.prefillMemberNumber();
    }

    // Unchecking GDPR consent clears its date so a stale date can't linger
    // invisibly once the checkbox is off again.
    this.form.controls.gdprConsentGiven.valueChanges.subscribe((given) => {
      if (!given) {
        this.form.controls.gdprConsentDate.reset(null);
      }
    });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    const request = this.toUpsertRequest();
    const request$ = id ? this.clientsService.update(id, request) : this.clientsService.create(request);

    this.saving.set(true);
    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.notifications.showSuccess(this.translate.instant(id ? 'CLIENTS.UPDATED' : 'CLIENTS.CREATED'));
        this.navigateBack();
      },
      error: () => {},
    });
  }

  onCancel(): void {
    this.navigateBack();
  }

  private mergeOptions(active: ClientRefOption[], linked: ClientRefOption[]): ClientRefOption[] {
    this.translationsReady();
    const activeIds = new Set(active.map((option) => option.id));
    const badge = this.translate.instant('CLIENTS.INACTIVE_BADGE');
    const grandfathered = linked
      .filter((option) => !activeIds.has(option.id))
      .map((option) => ({ id: option.id, name: `${option.name} (${badge})` }));
    return [...active, ...grandfathered];
  }

  private toUpsertRequest(): ClientUpsertRequest {
    const raw = this.form.getRawValue();
    return {
      memberNumber: raw.memberNumber as number,
      firstName: raw.firstName,
      lastName: raw.lastName,
      dateOfBirth: raw.dateOfBirth ? toStartOfDayIso(raw.dateOfBirth) : null,
      occupation: raw.occupation || null,
      phone: raw.phone || null,
      email: raw.email || null,
      note: raw.note || null,
      healthNote: raw.healthNote || null,
      gdprConsentGiven: raw.gdprConsentGiven,
      gdprConsentDate: raw.gdprConsentGiven && raw.gdprConsentDate ? toStartOfDayIso(raw.gdprConsentDate) : null,
      homeLocationId: raw.homeLocationId || null,
      homeTrainerId: raw.homeTrainerId || null,
      tagIds: raw.tagIds,
    };
  }

  private prefillMemberNumber(): void {
    this.clientsService.getNextMemberNumber().subscribe((next) => this.form.controls.memberNumber.setValue(next));
  }

  private loadActiveLocations(): void {
    this.locationsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeLocations.set(result.items));
  }

  /** GET /api/employees/directory, not getPage()/`/api/employees` - only feeds
   * the "Matični trener" picker (name only), and this component is also reused
   * at /app/my-clients/:id (see trainer.routes.ts), where the full endpoint
   * 403s for Member/Reception. */
  private loadActiveEmployees(): void {
    this.employeesService
      .getDirectory(true, { suppressErrorToast: true })
      .subscribe((result) => this.activeEmployees.set(result));
  }

  private loadActiveTags(): void {
    this.clientTagsService
      .getPage({ page: 1, pageSize: LOOKUP_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => this.activeTags.set(result.items));
  }

  private loadClient(id: string): void {
    this.loading.set(true);
    this.clientsService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (client) => this.applyClient(client),
        error: () => this.navigateBack(),
      });
  }

  private applyClient(client: ClientDto): void {
    this.loadedClient.set(client);
    this.loadedHomeLocation.set(
      client.homeLocationId ? { id: client.homeLocationId, name: client.homeLocationName ?? '' } : null,
    );
    this.loadedHomeTrainer.set(
      client.homeTrainerId ? { id: client.homeTrainerId, name: client.homeTrainerName ?? '' } : null,
    );
    this.loadedTags.set(client.tags.map((tag) => ({ id: tag.tagId, name: tag.name, colorHex: tag.colorHex })));

    this.form.reset(
      {
        memberNumber: client.memberNumber,
        firstName: client.firstName,
        lastName: client.lastName,
        dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth) : null,
        occupation: client.occupation ?? '',
        phone: client.phone ?? '',
        email: client.email ?? '',
        note: client.note ?? '',
        healthNote: client.healthNote ?? '',
        homeLocationId: client.homeLocationId ?? null,
        homeTrainerId: client.homeTrainerId ?? null,
        tagIds: client.tags.map((tag) => tag.tagId),
        gdprConsentGiven: client.gdprConsentGiven,
        gdprConsentDate: client.gdprConsentDate ? new Date(client.gdprConsentDate) : null,
      },
      { emitEvent: false },
    );

    // Anonymized clients are read-only everywhere - see the "Anonimizacija"
    // section of the Klijenti spec: editing one is blocked server-side
    // (CLIENT_ANONYMIZED, 409), so the form disables itself first rather than
    // letting the user hit that error.
    if (client.isAnonymized) {
      this.form.disable({ emitEvent: false });
    }
  }

  private navigateBack(): void {
    if (this.isTrainerContext) {
      this.router.navigate(['/app/my-clients']);
    } else {
      this.router.navigate(['/admin/clients'], { queryParams: { tab: 'clients' } });
    }
  }
}
