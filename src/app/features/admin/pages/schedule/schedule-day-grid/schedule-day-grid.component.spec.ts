import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { AppointmentScheduleCellDto } from '../../../../../core/models/appointment.model';
import { CurrentEmployee } from '../../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../../core/services/current-employee.service';
import { ScheduleDayGridComponent } from './schedule-day-grid.component';

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

const isSchedule = (url: string) => url.includes('/api/appointments');
const isBirthdays = (url: string) => url.includes('/api/clients/birthdays');

async function createFixture(grants: string[]): Promise<{ fixture: ComponentFixture<ScheduleDayGridComponent>; httpMock: HttpTestingController }> {
  localStorage.clear();
  await TestBed.configureTestingModule({
    imports: [ScheduleDayGridComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      MessageService,
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

  const fixture = TestBed.createComponent(ScheduleDayGridComponent);
  fixture.componentRef.setInput('employees', []);
  fixture.detectChanges();
  return { fixture, httpMock };
}

const feed = (id: string) => ({ appointments: [{ id } as AppointmentScheduleCellDto], breaks: [] });
const rawCellIds = (fixture: ComponentFixture<ScheduleDayGridComponent>) => fixture.componentInstance['rawCells']().map((cell) => cell.id);

describe('ScheduleDayGridComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the schedule without requesting birthdays when the viewer lacks clients.view', async () => {
    const { fixture, httpMock } = await createFixture(['appointments.view']);

    httpMock.expectNone((req) => isBirthdays(req.url));
    httpMock.expectOne((req) => isSchedule(req.url)).flush(feed('a-1'));

    expect(rawCellIds(fixture)).toEqual(['a-1']);
  });

  it('still shows the schedule when the birthdays lookup fails', async () => {
    const { fixture, httpMock } = await createFixture(['appointments.view', 'clients.view']);

    httpMock.expectOne((req) => isBirthdays(req.url)).flush(null, { status: 500, statusText: 'x' });
    httpMock.expectOne((req) => isSchedule(req.url)).flush(feed('a-1'));

    expect(rawCellIds(fixture)).toEqual(['a-1']);
  });

  it('ignores a slower response for a previously selected day', async () => {
    const { fixture, httpMock } = await createFixture(['appointments.view']);
    const today = httpMock.expectOne((req) => isSchedule(req.url));

    fixture.componentInstance.goNextDay();
    fixture.detectChanges();
    const tomorrow: TestRequest = httpMock.expectOne((req) => isSchedule(req.url));

    tomorrow.flush(feed('tomorrow'));
    today.flush(feed('today'));

    expect(rawCellIds(fixture)).toEqual(['tomorrow']);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('does not keep the previous day on screen when the new day fails to load', async () => {
    const { fixture, httpMock } = await createFixture(['appointments.view']);
    httpMock.expectOne((req) => isSchedule(req.url)).flush(feed('today'));

    fixture.componentInstance.goNextDay();
    fixture.detectChanges();
    httpMock.expectOne((req) => isSchedule(req.url)).flush(null, { status: 500, statusText: 'x' });

    expect(rawCellIds(fixture)).toEqual([]);
  });
});
