import { ApplicationRef, Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, ToastMessageOptions } from 'primeng/api';
import { AppError } from '../models/api-error.model';
import { resolveErrorMessage } from '../utils/error-translation.util';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Only used to nudge the zoneless scheduler after a message reaches
   * MessageService from outside any Angular-tracked handler - see dispatch()'s
   * own doc. Never read/write app state through this otherwise. */
  private readonly appRef = inject(ApplicationRef);

  constructor(
    private readonly messageService: MessageService,
    private readonly translate: TranslateService,
  ) {}

  showError(detail: string): void {
    this.dispatch({
      severity: 'error',
      summary: this.translate.instant('COMMON.ERROR_TITLE'),
      detail,
      life: 6000,
    });
  }

  showSuccess(detail: string): void {
    this.dispatch({
      severity: 'success',
      summary: this.translate.instant('COMMON.SUCCESS_TITLE'),
      detail,
      life: 4000,
    });
  }

  /** Non-error but noteworthy - e.g. the `warning` field on Zaposlenici's
   * activate/deactivate response ("Zaposlenik ima buduće termine."). The action
   * itself already succeeded, so this must never look like a failure. */
  showWarning(detail: string): void {
    this.dispatch({
      severity: 'warn',
      summary: this.translate.instant('COMMON.WARNING_TITLE'),
      detail,
      life: 6000,
    });
  }

  showAppError(error: AppError): void {
    this.showError(resolveErrorMessage(this.translate, error.code));
  }

  /** PrimeNG's MessageService pushes through a plain RxJS Subject, not a
   * signal - Angular's zoneless scheduler has no way to know the Toast host
   * needs re-checking unless something explicitly asks. Most callers (a click
   * handler, an HttpClient response subscribed directly from a component) are
   * already inside an Angular-tracked context that triggers a tick on its own,
   * so this goes unnoticed there - but a message raised from deeper inside an
   * HttpClient interceptor's catchError (see error.interceptor.ts's lazily
   * resolved NotificationService) reaches MessageService.add() from outside any
   * tracked handler, and the Toast never re-renders without this. Deferred to
   * a microtask (never a timer) so it always runs after the *current* call
   * stack - including one already inside a tick - has fully unwound, instead
   * of risking "ApplicationRef.tick is called recursively". */
  private dispatch(message: ToastMessageOptions): void {
    this.messageService.add(message);
    queueMicrotask(() => {
      if (!this.appRef.destroyed) {
        this.appRef.tick();
      }
    });
  }
}
