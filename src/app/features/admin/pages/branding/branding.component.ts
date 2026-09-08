import { Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { ColorPicker } from 'primeng/colorpicker';
import { finalize } from 'rxjs';
import { OrganizationBrandingResponse } from '../../../../core/models/branding.model';
import { BrandingService, resolveBrandingAssetUrl } from '../../../../core/services/branding.service';
import { NotificationService } from '../../../../core/services/notification.service';

const ACCEPT_IMAGE_EXTENSIONS = 'image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/avif';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

/** Platform default accent colors - mirrors --ochre/--olive-gold in
 * styles.scss, the fallback values --brand-primary/--brand-secondary resolve
 * to when an org hasn't set its own. "Vrati na zadano" writes these back
 * through PUT colors (there's no DELETE for colors - both fields are always
 * required), rather than actually clearing the org's saved colors. */
const DEFAULT_PRIMARY_COLOR = '#0D5C63';
const DEFAULT_SECONDARY_COLOR = '#0A4A50';

/** PUT /api/organization/branding/colors requires both colors together (400
 * ValidationError if only one is sent) - mirror that client-side so Save stays
 * disabled instead of round-tripping a guaranteed-invalid request. */
const bothColorsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const primary = (group.get('primaryColor')?.value ?? '').trim();
  const secondary = (group.get('secondaryColor')?.value ?? '').trim();
  if (!HEX_COLOR_PATTERN.test(primary) || !HEX_COLOR_PATTERN.test(secondary)) {
    return { bothColorsRequired: true };
  }
  return null;
};

@Component({
  selector: 'app-admin-branding',
  imports: [ReactiveFormsModule, TranslatePipe, ColorPicker, Button],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.scss',
})
export class BrandingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brandingService = inject(BrandingService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);

  readonly accept = ACCEPT_IMAGE_EXTENSIONS;

  readonly loading = signal(true);
  readonly savingColors = signal(false);
  readonly uploadingLogo = signal(false);
  readonly uploadingFavicon = signal(false);

  readonly branding = signal<OrganizationBrandingResponse | null>(null);

  readonly organizationName = computed(() => this.branding()?.organizationName ?? '');
  readonly organizationSlug = computed(() => this.branding()?.organizationSlug ?? '');

  readonly form = this.fb.nonNullable.group(
    {
      primaryColor: this.fb.nonNullable.control(''),
      secondaryColor: this.fb.nonNullable.control(''),
    },
    { validators: bothColorsValidator },
  );

  readonly logoUrl = computed(() => resolveBrandingAssetUrl(this.branding()?.logo));
  readonly faviconUrl = computed(() => resolveBrandingAssetUrl(this.branding()?.favicon));

  constructor() {
    effect(() => {
      const b = this.branding();
      if (!b) {
        return;
      }
      this.form.patchValue({
        primaryColor: b.primaryColor ?? '',
        secondaryColor: b.secondaryColor ?? '',
      });
    });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.brandingService.getBranding().subscribe({
      next: (b) => {
        this.branding.set(b);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    this.uploadFile(file, 'logo');
  }

  onFaviconSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    this.uploadFile(file, 'favicon');
  }

  saveColors(): void {
    const raw = this.form.getRawValue();
    const primary = this.normalizeHex(raw.primaryColor);
    const secondary = this.normalizeHex(raw.secondaryColor);
    if (!primary || !secondary) {
      return;
    }
    this.persistColors(primary, secondary, 'BRANDING.COLORS_UPDATED');
  }

  resetColorsForm(): void {
    const b = this.branding();
    if (!b) {
      return;
    }
    this.form.patchValue({
      primaryColor: b.primaryColor ?? '',
      secondaryColor: b.secondaryColor ?? '',
    });
  }

  confirmResetColors(): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant('BRANDING.CONFIRM_RESET_COLORS'),
      icon: 'pi pi-refresh',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      accept: () => this.persistColors(DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR, 'BRANDING.COLORS_RESET'),
    });
  }

  confirmDeleteLogo(): void {
    this.confirmDelete('logo');
  }

  confirmDeleteFavicon(): void {
    this.confirmDelete('favicon');
  }

  private uploadFile(file: File | undefined, kind: 'logo' | 'favicon'): void {
    if (!file) {
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.notifications.showError(this.translate.instant('BRANDING.ERRORS.FILE_TOO_LARGE'));
      return;
    }

    this.setUploading(kind, true);

    const request$ =
      kind === 'logo' ? this.brandingService.uploadLogo(file) : this.brandingService.uploadFavicon(file);

    request$
      .pipe(finalize(() => this.setUploading(kind, false)))
      .subscribe({
        next: () => {
          this.notifications.showSuccess(
            this.translate.instant(kind === 'logo' ? 'BRANDING.LOGO_UPLOADED' : 'BRANDING.FAVICON_UPLOADED'),
          );
          this.load();
        },
        error: () => {},
      });
  }

  private confirmDelete(kind: 'logo' | 'favicon'): void {
    this.confirmationService.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'),
      message: this.translate.instant(
        kind === 'logo' ? 'BRANDING.CONFIRM_DELETE_LOGO' : 'BRANDING.CONFIRM_DELETE_FAVICON',
      ),
      icon: 'pi pi-trash',
      acceptLabel: this.translate.instant('COMMON.YES'),
      rejectLabel: this.translate.instant('COMMON.NO'),
      acceptButtonProps: { severity: 'danger' },
      accept: () => {
        const request$ =
          kind === 'logo' ? this.brandingService.deleteLogo() : this.brandingService.deleteFavicon();
        request$.subscribe({
          next: (updated) => {
            this.brandingService.apply(updated);
            this.notifications.showSuccess(this.translate.instant('BRANDING.ITEM_DELETED'));
            this.load();
          },
          error: () => {},
        });
      },
    });
  }

  private persistColors(primaryColor: string, secondaryColor: string, successKey: string): void {
    this.savingColors.set(true);
    this.brandingService
      .updateColors({ primaryColor, secondaryColor })
      .pipe(finalize(() => this.savingColors.set(false)))
      .subscribe({
        next: (updated) => {
          this.brandingService.apply(updated);
          this.notifications.showSuccess(this.translate.instant(successKey));
          this.load();
        },
        error: () => {},
      });
  }

  private normalizeHex(value: string): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return null;
    }
    const hex = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
    return hex ? `#${hex[1].toUpperCase()}` : null;
  }

  private setUploading(kind: 'logo' | 'favicon', value: boolean): void {
    if (kind === 'logo') {
      this.uploadingLogo.set(value);
    } else {
      this.uploadingFavicon.set(value);
    }
  }
}
