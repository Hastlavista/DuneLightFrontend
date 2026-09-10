import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize } from 'rxjs';
import { OrganizationBranding, OrganizationBrandingResponse } from '../../../../core/models/branding.model';
import { BrandingService, resolveBrandingAssetUrl } from '../../../../core/services/branding.service';
import { NotificationService } from '../../../../core/services/notification.service';

const DEFAULT_PRIMARY = '#0D5C63';
const DEFAULT_SECONDARY = '#0A4A50';
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'avif']);

@Component({
  selector: 'app-admin-branding',
  imports: [ReactiveFormsModule, TranslatePipe, Button, InputText],
  templateUrl: './branding.component.html',
  styleUrl: './branding.component.scss',
})
export class BrandingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brandingService = inject(BrandingService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  readonly branding = signal<OrganizationBrandingResponse | null>(null);
  readonly loading = signal(true);
  readonly savingColors = signal(false);
  readonly uploading = signal<'logo' | 'favicon' | null>(null);
  readonly logoPreview = signal<string | null>(null);
  readonly faviconPreview = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    primaryColor: [DEFAULT_PRIMARY, [Validators.required, Validators.pattern(HEX_PATTERN)]],
    secondaryColor: [DEFAULT_SECONDARY, [Validators.required, Validators.pattern(HEX_PATTERN)]],
  });
  readonly primaryColor = signal(DEFAULT_PRIMARY);
  readonly secondaryColor = signal(DEFAULT_SECONDARY);
  readonly logoUrl = computed(() => this.logoPreview() ?? resolveBrandingAssetUrl(this.branding()?.logo));
  readonly faviconUrl = computed(() => this.faviconPreview() ?? resolveBrandingAssetUrl(this.branding()?.favicon));

  constructor() {
    this.load();
    const destroyRef = inject(DestroyRef);
    this.form.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((colors) => {
      this.primaryColor.set(colors.primaryColor || DEFAULT_PRIMARY);
      this.secondaryColor.set(colors.secondaryColor || DEFAULT_SECONDARY);
    });
    destroyRef.onDestroy(() => {
      this.revoke(this.logoPreview());
      this.revoke(this.faviconPreview());
    });
  }

  saveColors(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.savingColors.set(true);
    this.brandingService.updateColors({
      primaryColor: this.primaryColor().toUpperCase(), secondaryColor: this.secondaryColor().toUpperCase(),
    }).pipe(finalize(() => this.savingColors.set(false))).subscribe({
      next: (updated) => { this.update(updated); this.success('BRANDING.COLORS_SAVED'); }, error: () => {},
    });
  }

  resetColors(): void {
    this.confirm('BRANDING.CONFIRM_RESET_COLORS', 'pi pi-refresh', 'BRANDING.RESET_COLORS', () =>
      this.brandingService.resetColors().subscribe({ next: (updated) => { this.update(updated); this.success('BRANDING.COLORS_RESET'); }, error: () => {} }),
    );
  }

  upload(kind: 'logo' | 'favicon', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file || !this.validFile(file)) return;
    this.setPreview(kind, URL.createObjectURL(file));
    this.uploading.set(kind);
    const request = kind === 'logo' ? this.brandingService.uploadLogo(file) : this.brandingService.uploadFavicon(file);
    request.pipe(finalize(() => this.uploading.set(null))).subscribe({
      next: () => { this.clearPreview(kind); this.load(() => this.success(kind === 'logo' ? 'BRANDING.LOGO_SAVED' : 'BRANDING.FAVICON_SAVED')); },
      error: () => this.clearPreview(kind),
    });
  }

  removeAsset(kind: 'logo' | 'favicon'): void {
    this.confirm('BRANDING.CONFIRM_REMOVE_ASSET', 'pi pi-trash', 'COMMON.DELETE', () => {
      const request = kind === 'logo' ? this.brandingService.deleteLogo() : this.brandingService.deleteFavicon();
      request.subscribe({ next: (updated) => { this.update(updated); this.success(kind === 'logo' ? 'BRANDING.LOGO_REMOVED' : 'BRANDING.FAVICON_REMOVED'); }, error: () => {} });
    }, { asset: this.translate.instant(kind === 'logo' ? 'BRANDING.LOGO' : 'BRANDING.FAVICON').toLowerCase() }, true);
  }

  private load(afterLoad?: () => void): void {
    this.loading.set(true);
    this.brandingService.getBranding().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (branding) => { this.branding.set(branding); this.setColors(branding); this.brandingService.apply(branding, branding.organizationSlug); afterLoad?.(); }, error: () => {},
    });
  }

  private update(updated: OrganizationBranding): void {
    const current = this.branding(); if (!current) return;
    const branding = { ...current, ...updated };
    this.branding.set(branding); this.setColors(branding); this.brandingService.apply(branding, branding.organizationSlug);
  }

  private setColors(branding: OrganizationBranding): void {
    this.form.patchValue({ primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY, secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY });
  }

  private validFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) { this.notifications.showError(this.translate.instant('BRANDING.INVALID_FILE_TYPE')); return false; }
    if (file.size > MAX_FILE_SIZE) { this.notifications.showError(this.translate.instant('BRANDING.FILE_TOO_LARGE')); return false; }
    return true;
  }

  private confirm(message: string, icon: string, acceptLabel: string, accept: () => void, params?: object, danger = false): void {
    this.confirmation.confirm({
      header: this.translate.instant('COMMON.CONFIRM_HEADER'), message: this.translate.instant(message, params), icon,
      acceptLabel: this.translate.instant(acceptLabel), rejectLabel: this.translate.instant('COMMON.CANCEL'),
      acceptButtonProps: danger ? { severity: 'danger' } : undefined, accept,
    });
  }

  private success(key: string): void { this.notifications.showSuccess(this.translate.instant(key)); }
  private setPreview(kind: 'logo' | 'favicon', url: string): void { this.clearPreview(kind); (kind === 'logo' ? this.logoPreview : this.faviconPreview).set(url); }
  private clearPreview(kind: 'logo' | 'favicon'): void { const preview = kind === 'logo' ? this.logoPreview : this.faviconPreview; this.revoke(preview()); preview.set(null); }
  private revoke(url: string | null): void { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); }
}
