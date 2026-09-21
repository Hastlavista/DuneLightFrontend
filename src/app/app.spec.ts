import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { asyncScheduler, firstValueFrom, observeOn, of } from 'rxjs';
import { App } from './app';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { NotificationService } from './core/services/notification.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideZonelessChangeDetection(),
        providePrimeNG(),
        ConfirmationService,
        MessageService,
        {
          provide: TranslateService,
          // Echoes every key except the one code-path fallback resolution
          // actually depends on distinguishing - resolveErrorMessage treats
          // "translate.instant(key) === key" as "no translation exists",
          // so a plain echo would make every backend error code look
          // unresolved and always fall back to errors.UNKNOWN.
          useValue: { instant: (key: string) => (key === 'errors.DUPLICATE_NAME' ? 'Taj naziv je već zauzet.' : key) },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('dispatches the expected success message without duplicating it', () => {
    const messages: unknown[] = [];
    const subscription = TestBed.inject(MessageService).messageObserver.subscribe((message) => messages.push(message));

    TestBed.inject(NotificationService).showSuccess('Saved');

    expect(messages).toEqual([
      { severity: 'success', summary: 'COMMON.SUCCESS_TITLE', detail: 'Saved', life: 4000 },
    ]);
    subscription.unsubscribe();
  });

  it('dispatches the expected error message', () => {
    const messages: unknown[] = [];
    const subscription = TestBed.inject(MessageService).messageObserver.subscribe((message) => messages.push(message));

    TestBed.inject(NotificationService).showError('Taj naziv je već zauzet.');

    expect(messages).toEqual([
      {
        severity: 'error',
        summary: 'COMMON.ERROR_TITLE',
        detail: 'Taj naziv je već zauzet.',
        life: 6000,
      },
    ]);
    subscription.unsubscribe();
  });

  it('renders a NotificationService success message after the root toast has initialized', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    TestBed.inject(NotificationService).showSuccess('Toast test');

    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.p-toast-detail')?.textContent).toContain('Toast test');
  });

  it('renders an error emitted from an RxJS async callback under zoneless change detection', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await firstValueFrom(of(null).pipe(observeOn(asyncScheduler)));
    TestBed.inject(NotificationService).showError('Taj naziv je već zauzet.');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.p-toast-detail')?.textContent).toContain('Taj naziv je već zauzet.');
  });

  /** This is the actual failure path that shipped broken: a real HttpClient
   * request rejected by the backend, caught by errorInterceptor's catchError,
   * which lazily resolves NotificationService via Injector.get() (see
   * error.interceptor.ts's own doc on why it's lazy) and calls
   * showAppError() from there - never from a click handler or a directly
   * `.subscribe()`d component callback. A spy on NotificationService.showError
   * (as every earlier regression test used) proves the call happened but
   * can't prove the Toast ever painted; only reading the real DOM after the
   * real request settles proves that. Deliberately avoids
   * fixture.whenStable() - that call actively drains Angular's zoneless
   * scheduler and would still report "stable" (and pass) even if nothing had
   * scheduled a follow-up check on its own, which is exactly how the bug hid
   * behind whenStable()-based tests before. */
  it('renders a real HttpClient error caught inside the interceptor chain, without forcing stability, and without duplicating it', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    http.post('/api/permissions/grant-groups/capability-based', { name: 'Recepcija' }).subscribe({ error: () => {} });

    httpMock
      .expectOne('/api/permissions/grant-groups/capability-based')
      .flush({ error: { code: 'DUPLICATE_NAME', message: 'Duplicate.', details: null } }, { status: 409, statusText: 'Conflict' });

    // A handful of real macrotask/microtask turns - what a live browser
    // session gets "for free" from the event loop - not a forced CD flush.
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const toastDetails = fixture.nativeElement.querySelectorAll('.p-toast-detail');
    expect(toastDetails.length).toBe(1);
    expect(toastDetails[0].textContent).toContain('Taj naziv je već zauzet.');

    httpMock.verify();
  });
});
