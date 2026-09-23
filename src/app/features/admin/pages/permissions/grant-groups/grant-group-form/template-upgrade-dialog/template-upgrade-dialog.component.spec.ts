import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { GrantGroupTemplateDiffDto } from '../../../../../../../core/models/capability.model';
import { errorInterceptor } from '../../../../../../../core/interceptors/error.interceptor';
import { NotificationService } from '../../../../../../../core/services/notification.service';
import { TemplateUpgradeDialogComponent } from './template-upgrade-dialog.component';

/** Minimal fixed translation set - only the keys this dialog actually reads. */
const TRANSLATIONS = {
  errors: {
    GRANT_GROUP_UPGRADE_CONFLICT_RESOLUTION_REQUIRED: 'Sve prilagodbe moraju biti razrijesene.',
    UNKNOWN: 'Doslo je do greske.',
  },
  COMMON: { ERROR_TITLE: 'Greska', SUCCESS_TITLE: 'Uspjeh', CANCEL: 'Odustani', RETRY: 'Ponovno' },
  PERMISSIONS: {
    GRANT_GROUPS: {
      LOADING: 'Ucitavanje...',
      CATALOG_ERROR: 'Greska ucitavanja.',
      MANUAL_ADVANCED: 'Rucno dodane ovlasti',
      UPGRADE: {
        SECTION_ADDED: 'Dodat ce se',
        SECTION_CHANGED: 'Promijenit ce se',
        SECTION_REMOVED: 'Uklonit ce se',
        SECTION_CUSTOMIZATIONS: 'Vase prilagodbe',
        SECTION_MANUAL_GRANTS: 'Rucne napredne dozvole',
        NO_PERMISSION_CHANGES: 'Ova verzija ne mijenja dozvole.',
        TECHNICAL_DETAILS_TOGGLE: 'Tehnicki detalji',
        TECHNICAL_UNCHANGED: 'Nepromijenjeno',
        PRESERVE_ALL_ACTION: 'Zadrzi sve moje postavke',
        APPLY_BUTTON: 'Primijeni nadogradnju',
        APPLYING: 'Primjenjujem...',
        APPLIED_SUCCESS: 'Nadogradnja je primijenjena.',
        STATE_CHANGED_MESSAGE: 'Stanje se promijenilo.',
        REFRESH_ACTION: 'Osvjezi',
      },
    },
  },
};

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of(TRANSLATIONS);
  }
}

const NO_OP_DIFF: GrantGroupTemplateDiffDto = {
  currentTemplate: { key: 'Admin', version: 1 },
  targetTemplate: { key: 'Admin', version: 2 },
  addedCapabilities: [],
  removedCapabilities: [],
  changedCapabilities: [],
  rawGrantsAdded: [],
  rawGrantsRemoved: [],
  rawGrantsUnchanged: [{ grantKey: 'catalog.companies.manage', source: 'Capability' }],
  conflicts: [],
  stateToken: 'token-noop',
};

const CONFLICT_DIFF: GrantGroupTemplateDiffDto = {
  currentTemplate: { key: 'Recepcija', version: 1 },
  targetTemplate: { key: 'Recepcija', version: 2 },
  addedCapabilities: [{ capabilityKey: 'catalog.services.manage', currentScope: null, targetScope: 'View' }],
  removedCapabilities: [],
  changedCapabilities: [{ capabilityKey: 'schedule.breaks.manage', currentScope: 'Own', targetScope: 'Own' }],
  rawGrantsAdded: [{ grantKey: 'catalog.services.view', source: 'Capability' }],
  rawGrantsRemoved: [],
  rawGrantsUnchanged: [],
  conflicts: [
    { capabilityKey: 'checkout.manage', baseScope: 'View', currentScope: 'Manage', targetScope: 'View', defaultResolution: 'PreserveCurrent' },
    { capabilityKey: 'products.manage', baseScope: 'View', currentScope: 'All', targetScope: 'View', defaultResolution: 'PreserveCurrent' },
  ],
  stateToken: 'token-conflicts',
};

async function createFixture(): Promise<{ fixture: ComponentFixture<TemplateUpgradeDialogComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [TemplateUpgradeDialogComponent],
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      MessageService,
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TemplateUpgradeDialogComponent);
  const httpMock = TestBed.inject(HttpTestingController);
  fixture.componentRef.setInput('grantGroupId', 'group-1');
  fixture.componentRef.setInput('targetVersion', 2);
  return { fixture, httpMock };
}

function openWith(fixture: ComponentFixture<TemplateUpgradeDialogComponent>, httpMock: HttpTestingController, diff: GrantGroupTemplateDiffDto): void {
  fixture.componentRef.setInput('visible', true);
  fixture.detectChanges();
  httpMock.expectOne((req) => req.url.includes('/api/permissions/grant-groups/group-1/template-upgrade-diff')).flush(diff);
  fixture.detectChanges();
}

describe('TemplateUpgradeDialogComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('conflicts start unresolved - resolutions map is empty even though the backend sent a defaultResolution', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, CONFLICT_DIFF);

    const component = fixture.componentInstance;
    expect(component.resolutionFor('checkout.manage')).toBeNull();
    expect(component.resolutionFor('products.manage')).toBeNull();
    expect(component.allConflictsResolved()).toBe(false);
  });

  it('bulk "Zadrzi sve moje postavke" action marks every conflict as PreserveCurrent in one call', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, CONFLICT_DIFF);

    const component = fixture.componentInstance;
    component.onPreserveAll();

    expect(component.resolutionFor('checkout.manage')).toBe('PreserveCurrent');
    expect(component.resolutionFor('products.manage')).toBe('PreserveCurrent');
    expect(component.allConflictsResolved()).toBe(true);
  });

  it('Apply stays disabled until all conflicts are resolved, then enables once the last one is', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, CONFLICT_DIFF);
    const component = fixture.componentInstance;

    expect(component.allConflictsResolved()).toBe(false);
    component.onResolutionChange('checkout.manage', 'UseTemplate');
    expect(component.allConflictsResolved()).toBe(false);
    component.onResolutionChange('products.manage', 'PreserveCurrent');
    expect(component.allConflictsResolved()).toBe(true);
  });

  it('a zero-conflict diff enables Apply immediately', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, NO_OP_DIFF);

    expect(fixture.componentInstance.allConflictsResolved()).toBe(true);
  });

  it('renders the Admin-v2 no-op message when added/removed/changed/conflicts are all empty', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, NO_OP_DIFF);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(TRANSLATIONS.PERMISSIONS.GRANT_GROUPS.UPGRADE.NO_PERMISSION_CHANGES);
    expect(fixture.componentInstance.isNoOpDiff()).toBe(true);
  });

  it('a stale stateToken (GRANT_GROUP_UPGRADE_STATE_CHANGED) shows an inline refresh message, not a generic toast', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, NO_OP_DIFF);
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    fixture.componentInstance.onApply();
    httpMock
      .expectOne((req) => req.url.includes('/template-upgrade/apply') && req.method === 'POST')
      .flush({ error: { code: 'GRANT_GROUP_UPGRADE_STATE_CHANGED', message: 'stale', details: null } }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(fixture.componentInstance.staleState()).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(TRANSLATIONS.PERMISSIONS.GRANT_GROUPS.UPGRADE.STATE_CHANGED_MESSAGE);
    expect(text).toContain(TRANSLATIONS.PERMISSIONS.GRANT_GROUPS.UPGRADE.REFRESH_ACTION);

    // Refresh re-loads a fresh diff/stateToken.
    fixture.componentInstance.onRefresh();
    httpMock.expectOne((req) => req.url.includes('/api/permissions/grant-groups/group-1/template-upgrade-diff')).flush({ ...NO_OP_DIFF, stateToken: 'token-fresh' });
    fixture.detectChanges();
    expect(fixture.componentInstance.staleState()).toBe(false);
    expect(fixture.componentInstance.diff()?.stateToken).toBe('token-fresh');
  });

  it('an unrecognized error code falls back to a generic toast', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, NO_OP_DIFF);
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    fixture.componentInstance.onApply();
    httpMock.expectOne((req) => req.url.includes('/template-upgrade/apply')).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.staleState()).toBe(false);
  });

  it('only ever renders server-provided diff data - the technical-details section reflects exactly the raw grant arrays the backend sent, nothing recomputed', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, CONFLICT_DIFF);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('catalog.services.view');
    expect(text).toContain('Capability');
    // Nothing beyond the exact server-provided rawGrantsAdded/Removed/Unchanged
    // arrays is rendered - the dialog never calls into capability-materialization.
    expect(fixture.componentInstance.diff()?.rawGrantsAdded.length).toBe(1);
    expect(fixture.componentInstance.diff()?.rawGrantsRemoved.length).toBe(0);
    expect(fixture.componentInstance.diff()?.rawGrantsUnchanged.length).toBe(0);
  });

  it('conflicts are excluded from the PROMIJENIT CE SE section - changedMinusConflicts filters them out', async () => {
    const { fixture, httpMock } = await createFixture();
    openWith(fixture, httpMock, CONFLICT_DIFF);

    const changed = fixture.componentInstance.changedMinusConflicts();
    expect(changed.map((c) => c.capabilityKey)).toEqual(['schedule.breaks.manage']);
  });
});
