import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CompanyDto } from '../../../../core/models/company.model';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { ServiceDto } from '../../../../core/models/service.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { CompanyFormDialogComponent } from './companies/company-form-dialog.component';
import { ServiceFormDialogComponent } from './services/service-form-dialog.component';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const COMPANY: CompanyDto = {
  id: 'company-new', name: 'Nova', address: null, phone: null, colorHex: '#123456', country: 'HR',
  isActive: true, note: null, sortOrder: 0, createdAt: '', createdBy: '', updatedAt: null, updatedBy: null,
};

async function setUp(grants: string[]): Promise<HttpTestingController> {
  await TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
      ConfirmationService,
    ],
  }).compileComponents();
  const httpMock = TestBed.inject(HttpTestingController);
  const me: CurrentEmployee = {
    hasProfile: true,
    employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member', grants,
    colorHex: null, companies: [], hasPinSet: false,
  };
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(me);
  return httpMock;
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('CompanyFormDialogComponent - create wizard', () => {
  it('saving "Podaci" again after the wizard created the company updates it instead of creating a duplicate', async () => {
    const httpMock = await setUp(['catalog.companies.manage', 'roster.templates.view']);
    const fixture = TestBed.createComponent(CompanyFormDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.form.controls.name.setValue('Nova');
    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/catalog/companies') && req.method === 'POST').flush(COMPANY);
    fixture.detectChanges();
    // The wizard step opens "Radno vrijeme", whose editor loads its own data - irrelevant here.
    httpMock.match((req) => !req.url.includes('/api/catalog/companies'));

    component.activeTab.set('data');
    component.form.controls.name.setValue('Nova poslovnica');
    component.onSave();

    httpMock.expectOne((req) => req.url.endsWith(`/api/catalog/companies/${COMPANY.id}`) && req.method === 'PUT').flush(COMPANY);
    httpMock.expectNone((req) => req.url.endsWith('/api/catalog/companies') && req.method === 'POST');
  });
});

describe('CompanyFormDialogComponent - reopened while a save is in flight', () => {
  it('the earlier save neither closes the reopened dialog nor turns it into the created company\'s wizard', async () => {
    const httpMock = await setUp(['catalog.companies.manage', 'roster.templates.view']);
    const fixture = TestBed.createComponent(CompanyFormDialogComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.form.controls.name.setValue('Prva');
    component.onSave();
    const create = httpMock.expectOne((req) => req.url.endsWith('/api/catalog/companies') && req.method === 'POST');

    component.visible.set(false);
    fixture.detectChanges();
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.name.setValue('Druga');

    create.flush(COMPANY);
    fixture.detectChanges();

    expect(component.visible()).toBe(true);
    expect(component.currentCompanyId()).toBeNull();
    expect(component.activeTab()).toBe('data');
    expect(component.form.controls.name.value).toBe('Druga');
    expect(saved).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceFormDialogComponent - company assignments', () => {
  const SERVICE = {
    id: 'service-1', name: 'Masaža', executionMode: 'Individual', colorHex: '#AABBCC', defaultDurationMinutes: 60,
    defaultPrice: 50, description: null, sortOrder: 0, isActive: true,
  } as unknown as ServiceDto;

  async function openForEdit() {
    const httpMock = await setUp(['catalog.services.manage', 'catalog.services.view', 'catalog.companies.view']);
    const fixture = TestBed.createComponent(ServiceFormDialogComponent);
    httpMock.expectOne((req) => req.url.includes('/api/catalog/companies') && req.method === 'GET').flush({ items: [COMPANY], totalCount: 1, page: 1, pageSize: 200 });
    fixture.componentRef.setInput('service', SERVICE);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    return { httpMock, fixture, component: fixture.componentInstance };
  }

  it('saving before the assigned companies loaded does not replace them with an empty list', async () => {
    const { httpMock, component } = await openForEdit();
    const assignments = httpMock.expectOne((req) => req.url.endsWith('/api/catalog/services/service-1/companies') && req.method === 'GET');

    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/catalog/services/service-1') && req.method === 'PUT').flush(SERVICE);

    httpMock.expectNone((req) => req.url.endsWith('/api/catalog/services/service-1/companies') && req.method === 'PUT');
    assignments.flush([COMPANY]);
  });

  it('replaces the assignments once they have loaded', async () => {
    const { httpMock, component } = await openForEdit();
    httpMock.expectOne((req) => req.url.endsWith('/api/catalog/services/service-1/companies') && req.method === 'GET').flush([COMPANY]);

    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/catalog/services/service-1') && req.method === 'PUT').flush(SERVICE);

    const replace = httpMock.expectOne((req) => req.url.endsWith('/api/catalog/services/service-1/companies') && req.method === 'PUT');
    expect(replace.request.body).toEqual({ companyIds: [COMPANY.id] });
    replace.flush([COMPANY]);
  });
});
