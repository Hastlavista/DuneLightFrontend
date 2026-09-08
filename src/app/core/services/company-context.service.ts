import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { StudioCompany, toStudioCompany } from '../models/company.model';
import { CompaniesService } from './companies.service';

const SELECTED_COMPANY_KEY = 'dl_selected_company';

/** pageSize max is 200 (API limit) - comfortably above any realistic company count,
 * used here to fetch the full active set in one page for the global switcher. */
const SWITCHER_PAGE_SIZE = 200;

/**
 * Global company selection. Either "All companies" (null) or one specific company.
 * Future screens (schedule, finance, clients...) just subscribe to selectedCompany.
 */
@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private readonly companiesService = inject(CompaniesService);

  private readonly companiesState = signal<StudioCompany[]>([]);
  private readonly selectedIdState = signal<string | null>(this.readStoredSelection());

  readonly companies = this.companiesState.asReadonly();
  readonly selectedCompanyId = this.selectedIdState.asReadonly();
  readonly selectedCompany = computed<StudioCompany | null>(() => {
    const id = this.selectedIdState();
    return id ? (this.companiesState().find((company) => company.id === id) ?? null) : null;
  });

  loadCompanies(): void {
    this.companiesService
      .getPage({ page: 1, pageSize: SWITCHER_PAGE_SIZE, isActive: true }, { suppressErrorToast: true })
      .pipe(
        map((page) => page.items.map(toStudioCompany)),
        catchError(() => of<StudioCompany[]>([])),
      )
      .subscribe((companies) => {
        this.companiesState.set(companies);

        const currentId = this.selectedIdState();
        if (currentId && !companies.some((company) => company.id === currentId)) {
          this.selectCompany(null);
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

  private readStoredSelection(): string | null {
    return localStorage.getItem(SELECTED_COMPANY_KEY);
  }
}
