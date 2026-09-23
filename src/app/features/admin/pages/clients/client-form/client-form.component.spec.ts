import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { ClientFormComponent } from './client-form.component';

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

@Component({ template: '' })
class EmptyRouteComponent {}

async function createNewClientForm(): Promise<{ fixture: ComponentFixture<ClientFormComponent>; httpMock: HttpTestingController; nextNumber: TestRequest }> {
  await TestBed.configureTestingModule({
    imports: [ClientFormComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: '**', component: EmptyRouteComponent }]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
      ConfirmationService,
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'new' }), queryParamMap: convertToParamMap({}) } } },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const me: CurrentEmployee = {
    hasProfile: true,
    employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member', grants: ['clients.manage'],
    colorHex: null, companies: [], hasPinSet: false,
  };
  TestBed.inject(CurrentEmployeeService).load().subscribe();
  httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(me);

  const fixture = TestBed.createComponent(ClientFormComponent);
  fixture.detectChanges();
  httpMock.expectOne((req) => req.url.includes('/api/employees/directory')).flush([]);
  httpMock.expectOne((req) => req.url.includes('/api/clients/tags')).flush({ items: [], totalCount: 0, page: 1, pageSize: 200 });
  const nextNumber = httpMock.expectOne((req) => req.url.endsWith('/api/clients/next-member-number'));
  return { fixture, httpMock, nextNumber };
}

describe('ClientFormComponent - prefilled member number', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('fills the suggested member number when the user has not typed one', async () => {
    const { fixture, nextNumber } = await createNewClientForm();

    nextNumber.flush(1001);

    expect(fixture.componentInstance.form.controls.memberNumber.value).toBe(1001);
  });

  it('never overwrites a member number the user typed while the suggestion was still loading', async () => {
    const { fixture, nextNumber } = await createNewClientForm();
    const control = fixture.componentInstance.form.controls.memberNumber;

    control.setValue(42);
    control.markAsDirty();
    nextNumber.flush(1001);

    expect(control.value).toBe(42);
  });
});
