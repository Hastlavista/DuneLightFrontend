import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { ClientDto } from '../../../../../core/models/client.model';
import { ClientsService } from '../../../../../core/services/clients.service';
import { NotificationService } from '../../../../../core/services/notification.service';

const CONFIRM_WORD = 'ANONIMIZIRAJ';

/**
 * Strong confirmation required before POST /api/clients/{id}/anonymize - this is
 * a GDPR "right to be forgotten" action, irreversible, and deliberately harder to
 * trigger than a normal delete/deactivate confirm dialog: it lists exactly what
 * gets wiped and requires the user to type a confirmation word before the danger
 * button becomes clickable. Kept entirely separate from ConfirmationService
 * (used for deactivate/delete elsewhere) since those don't support a typed-input
 * gate. See the "Anonimizacija" section of the Klijenti spec.
 */
@Component({
  selector: 'app-anonymize-client-dialog',
  imports: [Dialog, FormsModule, InputText, Button, TranslatePipe],
  templateUrl: './anonymize-client-dialog.component.html',
  styleUrl: './anonymize-client-dialog.component.scss',
})
export class AnonymizeClientDialogComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly visible = model(false);
  readonly client = input<ClientDto | null>(null);
  readonly anonymized = output<void>();

  readonly confirmText = signal('');
  readonly saving = signal(false);

  readonly canConfirm = computed(() => this.confirmText().trim().toUpperCase() === CONFIRM_WORD);

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.confirmText.set('');
      }
    });
  }

  onConfirm(): void {
    const client = this.client();
    if (!client || !this.canConfirm()) {
      return;
    }

    this.saving.set(true);
    this.clientsService
      .anonymize(client.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(this.translate.instant('CLIENTS.ANONYMIZE_SUCCESS'));
          this.visible.set(false);
          this.anonymized.emit();
        },
        error: () => {},
      });
  }

  onCancel(): void {
    this.visible.set(false);
  }
}
