import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { EmployeesComponent } from './employees.component';

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

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 20 };

const isEngagementTypes = (url: string) => url.includes('/api/employees/engagement-types');
const isEmployeeList = (url: string) => /\/api\/employees(\?|$)/.test(url);

describe('EmployeesComponent - lazy tabs', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('does not load the hidden Vrste angažmana tab until it is first opened, and loads it exactly once', async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
        MessageService,
        ConfirmationService,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    }).compileComponents();

    const httpMock = TestBed.inject(HttpTestingController);
    const employee: CurrentEmployee = {
      hasProfile: true,
      employeeId: 'me-1',
      firstName: 'Marko',
      lastName: 'Testni',
      role: 'Member',
      grants: ['employees.view', 'employees.engagement-types.view'],
      colorHex: null,
      companies: [],
      hasPinSet: false,
    };
    TestBed.inject(CurrentEmployeeService).load().subscribe();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(employee);

    const fixture = TestBed.createComponent(EmployeesComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // Employee list tab (active) loads; its engagement-type dropdown lookup is
    // the list's own supporting read, not the hidden tab.
    httpMock.match((req) => isEmployeeList(req.url)).forEach((r) => r.flush(EMPTY_PAGE));
    const lookups = httpMock.match((req) => isEngagementTypes(req.url));
    expect(lookups.length).toBe(1);
    lookups.forEach((r) => r.flush(EMPTY_PAGE));

    const tabs = fixture.nativeElement.querySelectorAll('p-tab') as NodeListOf<HTMLElement>;
    tabs[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const firstOpen = httpMock.match((req) => isEngagementTypes(req.url));
    expect(firstOpen.length).toBe(1);
    firstOpen.forEach((r) => r.flush(EMPTY_PAGE));

    tabs[0].click();
    fixture.detectChanges();
    tabs[1].click();
    fixture.detectChanges();
    await fixture.whenStable();

    httpMock.expectNone((req) => isEngagementTypes(req.url) || isEmployeeList(req.url));
  });
});
