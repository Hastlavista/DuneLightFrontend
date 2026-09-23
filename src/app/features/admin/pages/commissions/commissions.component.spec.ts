import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CurrentEmployee } from '../../../../core/models/employee.model';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { toStartOfDayIso } from '../../../../core/utils/date.util';
import { CommissionsComponent } from './commissions.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 200 };

describe('CommissionsComponent - local business dates', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  it('shortly after local midnight, "today" and the day boundaries are the LOCAL calendar days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 0, 30));

    await TestBed.configureTestingModule({
      imports: [CommissionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
        MessageService,
      ],
    }).compileComponents();
    const httpMock = TestBed.inject(HttpTestingController);
    const me: CurrentEmployee = {
      hasProfile: true,
      employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member', grants: ['commissions.view'],
      colorHex: null, companies: [], hasPinSet: false,
    };
    TestBed.inject(CurrentEmployeeService).load().subscribe();
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(me);

    const fixture = TestBed.createComponent(CommissionsComponent);
    const component = fixture.componentInstance;

    for (const path of ['/api/employees', '/api/catalog/services', '/api/products', '/api/catalog/packages']) {
      httpMock.expectOne((req) => req.url.endsWith(path)).flush(EMPTY_PAGE);
    }
    const entries = httpMock.expectOne((req) => req.url.endsWith('/api/commissions/entries'));

    // toISOString() would have said 4 Oct here (22:30Z on 4 Oct in UTC+2).
    expect(component.to).toBe('2026-10-05');
    expect(component.from).toBe('2026-09-05');
    expect(entries.request.params.get('from')).toBe(toStartOfDayIso(new Date(2026, 8, 5)));
    // Exclusive upper bound (backend filters EarnedAt < to): the next local midnight.
    expect(entries.request.params.get('to')).toBe(toStartOfDayIso(new Date(2026, 9, 6)));
    // '+' in an offset must be percent-encoded, or the server reads it as a space.
    expect(entries.request.urlWithParams).not.toMatch(/T00:00:00\.000\+/);
    entries.flush({ items: [], totalCount: 0 });
  });
});
