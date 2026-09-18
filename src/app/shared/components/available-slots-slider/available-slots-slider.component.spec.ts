import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AvailableSlotsSliderComponent } from './available-slots-slider.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

describe('AvailableSlotsSliderComponent', () => {
  let fixture: ComponentFixture<AvailableSlotsSliderComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvailableSlotsSliderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AvailableSlotsSliderComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('serviceId', 'service-1');
    fixture.componentRef.setInput('companyId', 'company-1');
    fixture.componentRef.setInput('initialDate', new Date(2026, 8, 18, 12, 0));
    fixture.componentRef.setInput('lockedEmployeeId', 'employee-1');
  });

  afterEach(() => httpMock.verify());

  it('refetches the server-authoritative result when the dialog invalidates identical inputs', () => {
    fixture.detectChanges();
    const initialRequest = httpMock.expectOne((request) =>
      request.url.endsWith('/api/appointments/available-slots') &&
      request.params.get('serviceId') === 'service-1' &&
      request.params.get('companyId') === 'company-1' &&
      request.params.get('employeeId') === 'employee-1' &&
      request.params.get('date') === '2026-09-18',
    );
    initialRequest.flush([{ employeeId: 'employee-1', employeeName: 'Anea', colorHex: null, slots: [{ start: '12:00:00', end: '12:30:00' }] }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('12:00');

    fixture.componentRef.setInput('refreshVersion', 1);
    fixture.detectChanges();
    const refreshedRequest = httpMock.expectOne((request) => request.url.endsWith('/api/appointments/available-slots'));
    refreshedRequest.flush([{ employeeId: 'employee-1', employeeName: 'Anea', colorHex: null, slots: [] }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('12:00');
  });

  it('does not let an older availability response overwrite a newer query', () => {
    fixture.detectChanges();
    const oldRequest = httpMock.expectOne((request) => request.url.endsWith('/api/appointments/available-slots'));

    fixture.componentRef.setInput('refreshVersion', 1);
    fixture.detectChanges();
    const latestRequest = httpMock.expectOne((request) => request.url.endsWith('/api/appointments/available-slots'));

    latestRequest.flush([{ employeeId: 'employee-1', employeeName: 'Anea', colorHex: null, slots: [{ start: '13:00:00', end: '13:30:00' }] }]);
    oldRequest.flush([{ employeeId: 'employee-1', employeeName: 'Anea', colorHex: null, slots: [{ start: '12:00:00', end: '12:30:00' }] }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('13:00');
    expect(fixture.nativeElement.textContent).not.toContain('12:00');
  });
});
