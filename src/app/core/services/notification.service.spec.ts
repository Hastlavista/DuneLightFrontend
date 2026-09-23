import { TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { NotificationService } from './notification.service';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

describe('NotificationService.showAppError', () => {
  let add: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    add = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
        { provide: MessageService, useValue: { add } },
      ],
    });
  });

  it('shows a toast for an ordinary error', () => {
    TestBed.inject(NotificationService).showAppError({ status: 409, code: 'APPOINTMENT_OVERLAP', message: '' });
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('stays silent for a session-expiry error the interceptor already reported', () => {
    TestBed.inject(NotificationService).showAppError({ status: 401, code: 'UNAUTHORIZED', message: '', sessionExpired: true });
    expect(add).not.toHaveBeenCalled();
  });
});
