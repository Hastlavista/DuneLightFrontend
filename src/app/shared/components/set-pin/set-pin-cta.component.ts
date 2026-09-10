import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { SetPinDialogComponent } from './set-pin-dialog.component';

/**
 * "Postavi PIN" banner - shown to any logged-in Employee who has no PIN yet
 * (see InactivityService/PinLockOverlayComponent for what the PIN is for:
 * fast user switching on a shared device). Gated on hasProfile(), not just
 * hasPinSet, so a profile-less Owner sees only CompleteEmployeeProfileCtaComponent's
 * "dovrši profil" banner first - a PIN has nowhere to attach before that
 * Employee record exists. Mounted once in ShellComponent so it appears above
 * every admin/trainer page instead of being wired into each landing screen.
 */
@Component({
  selector: 'app-set-pin-cta',
  imports: [Button, TranslatePipe, SetPinDialogComponent],
  templateUrl: './set-pin-cta.component.html',
  styleUrl: './set-pin-cta.component.scss',
})
export class SetPinCtaComponent {
  private readonly currentEmployeeService = inject(CurrentEmployeeService);

  readonly shouldShow = computed(
    () => this.currentEmployeeService.hasProfile() && !this.currentEmployeeService.employee()?.hasPinSet,
  );

  readonly dialogVisible = signal(false);

  openDialog(): void {
    this.dialogVisible.set(true);
  }
}
