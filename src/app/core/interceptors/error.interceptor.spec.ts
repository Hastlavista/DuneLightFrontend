import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AppError } from '../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor - status fallback codes', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let showAppError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showAppError = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', children: [] }]),
        provideTranslateService({ lang: 'hr', fallbackLang: 'hr' }),
        { provide: AuthService, useValue: { logout: vi.fn() } },
        { provide: NotificationService, useValue: { showAppError, showError: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function failWith(status: number, body: object | null): AppError | undefined {
    let received: AppError | undefined;
    http.get('/api/anything').subscribe({ error: (e: AppError) => (received = e) });
    httpMock.expectOne('/api/anything').flush(body, { status, statusText: 'x' });
    return received;
  }

  it('maps a body-less 403 (ForbidResult) to FORBIDDEN instead of the generic UNKNOWN', () => {
    expect(failWith(403, null)?.code).toBe('FORBIDDEN');
    expect(showAppError).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('maps a body-less 404 to NOT_FOUND', () => {
    expect(failWith(404, null)?.code).toBe('NOT_FOUND');
  });

  it('keeps UNKNOWN for other body-less failures', () => {
    expect(failWith(500, null)?.code).toBe('UNKNOWN');
  });

  it('a session-expiry 401 logs out, notifies exactly once, and marks the error so callers stay silent', () => {
    const error = failWith(401, null);

    expect(error?.sessionExpired).toBe(true);
    expect(TestBed.inject(AuthService).logout).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(NotificationService).showError).toHaveBeenCalledTimes(1);
    expect(showAppError).not.toHaveBeenCalled();
  });

  it('prefers the backend business code when the body carries one', () => {
    expect(failWith(403, { error: { code: 'NOT_OWNER', message: 'x' } })?.code).toBe('NOT_OWNER');
  });
});
