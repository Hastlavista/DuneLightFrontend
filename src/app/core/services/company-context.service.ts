import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CurrentEmployee } from '../models/employee.model';
import { catchError, finalize, map, of } from 'rxjs';
import { StudioCompany, toStudioCompany } from '../models/company.model';
import { CompaniesService } from './companies.service';
import { CurrentEmployeeService } from './current-employee.service';

const SELECTED_COMPANY_KEY = 'dl_selected_company';

/** pageSize max is 200 (API limit) - comfortably above any realistic company count,
 * used here to fetch the full active set in one page for the global switcher. */
const SWITCHER_PAGE_SIZE = 200;

/**
 * Global company selection. Either "All companies" (null) or one specific company.
 * A viewer holding catalog.companies.view can choose from the full
 * active-company list (including "All companies"). Everyone else is always
 * scoped to the companies assigned to their own profile.
 */
/** Everything the company list is derived from; null = no employee profile. */
function identityKeyOf(employee: CurrentEmployee | null): string {
  if (!employee) {
    return 'no-profile';
  }
  const grants = [...employee.grants].sort().join(',');
  const companies = employee.companies.map((company) => `${company.companyId}:${company.companyName}`).sort().join(',');
  return `${employee.employeeId}|${grants}|${companies}`;
}

@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private readonly companiesService = inject(CompaniesService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  private readonly companiesState = signal<StudioCompany[]>([]);
  private readonly selectedIdState = signal<string | null>(this.readStoredSelection());

  readonly companies = this.companiesState.asReadonly();
  readonly selectedCompanyId = this.selectedIdState.asReadonly();
  readonly canSelectAllCompanies = computed(() => this.currentEmployeeService.hasGrant('catalog.companies.view'));
  readonly selectedCompany = computed<StudioCompany | null>(() => {
    const id = this.selectedIdState();
    return id ? (this.companiesState().find((company) => company.id === id) ?? null) : null;
  });

  // Several independent components call loadCompanies() during the same
  // navigation, each seeing an empty companies() before the first request
  // resolves. Guard against firing GET /api/companies more than once at a time.
  private loadInFlight = false;
  private reloadAfterInFlight = false;
  /** Bumped whenever the signed-in identity changes, so a response started for
   * the previous user/grant set is dropped instead of applied. */
  private generation = 0;
  private identityKey: string | null = null;
  /** Identity the most recent load was started for (in flight or done). */
  private lastLoadKey: string | null = null;

  constructor() {
    // The list depends on who is signed in (grants + assigned companies): reload
    // on login, PIN user switch, profile completion and after the current user's
    // own assignments are refreshed; clear on logout.
    effect(() => {
      const loaded = this.currentEmployeeService.loaded();
      const employee = this.currentEmployeeService.employee();
      untracked(() => this.onIdentity(loaded ? identityKeyOf(employee) : null));
    });
  }

  /** After a company write: unlike loadCompanies(), never skipped - a load
   * already in flight predates the write, so one more reload is queued. */
  refreshCompanies(): void {
    if (this.loadInFlight) {
      this.reloadAfterInFlight = true;
      return;
    }
    this.loadCompanies();
  }

  loadCompanies(): void {
    // Before /employees/me resolves neither grants nor assignments are known;
    // the identity effect loads as soon as they are.
    if (this.loadInFlight || !this.currentEmployeeService.loaded()) {
      return;
    }
    this.lastLoadKey = identityKeyOf(this.currentEmployeeService.employee());

    const assignedCompanies: StudioCompany[] = this.currentEmployeeService.employee()?.companies.map((company) => ({
      id: company.companyId,
      name: company.companyName,
      colorHex: null,
    })) ?? [];

    if (!this.canSelectAllCompanies()) {
      this.setCompanies(assignedCompanies, true);
      return;
    }

    this.loadInFlight = true;
    const generation = this.generation;
    this.companiesService
      .getPage({ page: 1, pageSize: SWITCHER_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .pipe(
        map((page) => ({ companies: page.items.map(toStudioCompany), authoritative: true })),
        // Keep the selector useful if the company catalog is temporarily unavailable -
        // but this fallback list is known incomplete, so it must never be treated as
        // ground truth for validating (and possibly clearing) the stored selection.
        catchError(() => of({ companies: assignedCompanies, authoritative: false })),
        finalize(() => {
          if (generation !== this.generation) {
            return;
          }
          this.loadInFlight = false;
          if (this.reloadAfterInFlight) {
            this.reloadAfterInFlight = false;
            this.loadCompanies();
          }
        }),
      )
      .subscribe((result) => {
        if (generation === this.generation) {
          this.setCompanies(result.companies, result.authoritative);
        }
      });
  }

  selectCompany(companyId: string | null): void {
    this.selectedIdState.set(companyId);
    if (companyId) {
      localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
    } else {
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }

  private onIdentity(key: string | null): void {
    if (key === this.identityKey) {
      return;
    }
    this.identityKey = key;
    // A page may already have started the load for this very identity.
    if (key !== null && key === this.lastLoadKey) {
      return;
    }
    this.generation++;
    this.loadInFlight = false;
    this.reloadAfterInFlight = false;
    if (key === null) {
      this.lastLoadKey = null;
      this.companiesState.set([]);
      return;
    }
    this.loadCompanies();
  }

  private readStoredSelection(): string | null {
    return localStorage.getItem(SELECTED_COMPANY_KEY);
  }

  private setCompanies(companies: StudioCompany[], authoritative: boolean): void {
    this.companiesState.set(companies);
    if (!authoritative) {
      // A temporarily-failed load: the list shown is a fallback (the viewer's own
      // assigned companies), not the real catalog - leave the persisted selection
      // as-is rather than clearing it because it's merely absent from this fallback.
      return;
    }

    const currentId = this.selectedIdState();
    if (!this.canSelectAllCompanies()) {
      // An employee must always be pinned to one of their assigned companies;
      // retaining a previously stored "All companies" selection would send
      // unscoped requests that their backend permissions correctly reject.
      if (!currentId || !companies.some((company) => company.id === currentId)) {
        this.selectCompany(companies[0]?.id ?? null);
      }
      return;
    }

    if (currentId && !companies.some((company) => company.id === currentId)) {
      this.selectCompany(null);
    }
  }
}
