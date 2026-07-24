import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { AppError } from '../models/api-error.model';
import { resolveErrorMessage } from '../utils/error-translation.util';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(
    private readonly messageService: MessageService,
    private readonly translate: TranslateService,
  ) {}

  showError(detail: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('COMMON.ERROR_TITLE'),
      detail,
      life: 6000,
    });
  }

  showSuccess(detail: string): void {
    this.messageService.add({
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
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('COMMON.WARNING_TITLE'),
      detail,
      life: 6000,
    });
  }

  showAppError(error: AppError): void {
    this.showError(resolveErrorMessage(this.translate, error.code));
  }
}
