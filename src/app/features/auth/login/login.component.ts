import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { distinctUntilChanged, finalize, map, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { KnownUsersService } from '../../../core/auth/known-users.service';
import { AppError } from '../../../core/models/api-error.model';
import { BrandingService, resolveBrandingAssetUrl } from '../../../core/services/branding.service';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { resolveErrorMessage } from '../../../core/utils/error-translation.util';
import { PinLockOverlayComponent } from '../../../shared/components/pin-lock-overlay/pin-lock-overlay.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, InputText, Password, Button, TranslatePipe, PinLockOverlayComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly knownUsersService = inject(KnownUsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly brandingService = inject(BrandingService);

  readonly branding = this.brandingService.branding;
  private readonly forcedFullForm = signal(this.route.snapshot.queryParamMap.get('mode') === 'full');
  readonly knownUsers = computed(() => this.knownUsersService.forOrganization(this.authService.getRememberedOrganizationSlug()));
  readonly showChooser = computed(() => !this.forcedFullForm() && this.knownUsers().length > 0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    organizationSlug: [this.authService.getRememberedOrganizationSlug(), Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly logoUrl = computed(() => resolveBrandingAssetUrl(this.branding()?.logo));

  constructor() {
    this.brandingService.reset();
    const routeSub = this.route.queryParamMap.subscribe((params) => {
      this.forcedFullForm.set(params.get('mode') === 'full');
    });
    const brandingSub = this.form.controls.organizationSlug.valueChanges
      .pipe(startWith(this.form.controls.organizationSlug.value ?? ''), map((value) => value?.trim() ?? ''), distinctUntilChanged())
      .subscribe((slug) => {
        if (!slug) {
          this.brandingService.clear();
          return;
        }
        this.brandingService.getPublicBranding(slug).subscribe({
          next: (branding) => {
            if (this.form.controls.organizationSlug.value?.trim() === slug) this.brandingService.apply(branding, slug);
          },
          error: () => {},
        });
      });
    inject(DestroyRef).onDestroy(() => {
      routeSub.unsubscribe();
      brandingSub.unsubscribe();
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.authService
      .login(this.form.getRawValue())
      .pipe(
        switchMap(() => {
          this.currentEmployeeService.clear();
          return this.currentEmployeeService.load();
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: () => this.router.navigate(['/app']),
        error: (error: AppError) => this.errorMessage.set(resolveErrorMessage(this.translate, error.code)),
      });
  }

  showChooserAgain(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { mode: null }, queryParamsHandling: 'merge' });
  }
}
