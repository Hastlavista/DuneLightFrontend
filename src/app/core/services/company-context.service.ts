import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { StudioCompany, toStudioCompany } from '../models/company.model';
import { CompaniesService } from './companies.service';
import { CurrentEmployeeService } from './current-employee.service';

const SELECTED_COMPANY_KEY = 'dl_selected_company';

/** pageSize max is 200 (API limit) - comfortably above any realistic company count,
 * used here to fetch the full active set in one page for the global switcher. */
const SWITCHER_PAGE_SIZE = 200;

/**
 * Global company selection. Either "All companies" (null) or one specific company.
 * The Owner can choose from the full active-company list (including "All companies").
 * Employees are always scoped to the companies assigned to their own profile.
 */
@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private readonly companiesService = inject(CompaniesService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  private readonly companiesState = signal<StudioCompany[]>([]);
  private readonly selectedIdState = signal<string | null>(this.readStoredSelection());

  readonly companies = this.companiesState.asReadonly();
  readonly selectedCompanyId = this.selectedIdState.asReadonly();
  readonly canSelectAllCompanies = computed(
    () => this.currentEmployeeService.isOwner() || this.currentEmployeeService.hasGrant('catalog.companies.view'),
  );
  readonly selectedCompany = computed<StudioCompany | null>(() => {
    const id = this.selectedIdState();
    return id ? (this.companiesState().find((company) => company.id === id) ?? null) : null;
  });

  loadCompanies(): void {
    const assignedCompanies = this.currentEmployeeService.employee()?.companies.map((company) => ({
      id: company.companyId,
      name: company.companyName,
    })) ?? [];

    if (!this.canSelectAllCompanies()) {
      this.setCompanies(assignedCompanies);
      return;
    }

    this.companiesService
      .getPage({ page: 1, pageSize: SWITCHER_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .pipe(
        map((page) => page.items.map(toStudioCompany)),
        // Keep the selector useful if the company catalog is temporarily unavailable.
        catchError(() => of<StudioCompany[]>(assignedCompanies)),
      )
      .subscribe((companies) => this.setCompanies(companies));
  }

  selectCompany(companyId: string | null): void {
    this.selectedIdState.set(companyId);
    if (companyId) {
      localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
    } else {
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }

  private readStoredSelection(): string | null {
    return localStorage.getItem(SELECTED_COMPANY_KEY);
  }

  private setCompanies(companies: StudioCompany[]): void {
    this.companiesState.set(companies);

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
