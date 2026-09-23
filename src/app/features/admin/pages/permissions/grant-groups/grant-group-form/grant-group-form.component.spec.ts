import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CapabilityDefinitionDto, GrantGroupAuthoringStateDto, GrantGroupTemplateUpgradeStatusDto } from '../../../../../../core/models/capability.model';
import { GrantDto, GrantGroupDto } from '../../../../../../core/models/permissions.model';
import { errorInterceptor } from '../../../../../../core/interceptors/error.interceptor';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { GrantGroupFormComponent } from './grant-group-form.component';

/** Minimal fixed translation set - only the keys these tests actually read,
 * enough to distinguish "resolved a specific message" from "fell back to the
 * generic one" without dragging in the full hr.json. */
const TRANSLATIONS = {
  errors: {
    DUPLICATE_NAME: 'Taj naziv je već zauzet.',
    UNKNOWN: 'Došlo je do neočekivane greške. Pokušajte ponovno.',
  },
  PERMISSIONS: {
    GRANT_GROUPS: {
      SAVE_FAILED: 'Ulogu nije moguće spremiti. Provjerite podatke i pokušajte ponovno.',
      CREATED: 'Grupa je stvorena.',
      UPDATED: 'Grupa je ažurirana.',
    },
  },
  COMMON: { ERROR_TITLE: 'Greška', SUCCESS_TITLE: 'Uspjeh' },
};

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of(TRANSLATIONS);
  }
}

const CAPABILITY: CapabilityDefinitionDto = {
  id: 'cap-1',
  key: 'catalog.companies.manage',
  version: 1,
  categoryKey: 'catalog',
  scopeModel: 'ViewManage',
  sensitivity: 'Normal',
  isActive: true,
  deprecatedAt: null,
  grants: [
    { grantKey: 'catalog.companies.manage', role: 'PrimaryManage' },
    { grantKey: 'catalog.companies.view', role: 'PrimaryViewOnly' },
  ],
};

const RAW_CATALOG: GrantDto[] = [
  { key: 'catalog.companies.manage', module: 'catalog', description: 'Uređivanje tvrtki.' },
  { key: 'catalog.companies.view', module: 'catalog', description: 'Pregled tvrtki.' },
];

const EXISTING_GROUP: GrantGroupDto = {
  id: 'group-1',
  name: 'Recepcija',
  grants: [],
  assignedUserCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
};

const AUTHORING_STATE: GrantGroupAuthoringStateDto = {
  grantGroup: EXISTING_GROUP,
  capabilitySelections: [],
  manualGrantKeys: [],
  derivedGrantKeys: [],
  templateSourceKey: null,
  templateSourceVersion: null,
  hasCapabilityMetadata: true,
  isCustomized: false,
};

const CONFLICT_BODY = { error: { code: 'DUPLICATE_NAME', message: 'Duplicate.', details: null } };

function routeStub(id: string) {
  return { snapshot: { paramMap: convertToParamMap({ id }) } };
}

async function createFixture(
  id: string,
  authoringState: GrantGroupAuthoringStateDto = AUTHORING_STATE,
): Promise<{ fixture: ComponentFixture<GrantGroupFormComponent>; httpMock: HttpTestingController }> {
  await TestBed.configureTestingModule({
    imports: [GrantGroupFormComponent],
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      ConfirmationService,
      MessageService,
      provideTranslateService({ lang: 'hr', fallbackLang: 'hr', loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } }),
      { provide: ActivatedRoute, useValue: routeStub(id) },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(GrantGroupFormComponent);
  const httpMock = TestBed.inject(HttpTestingController);

  httpMock.expectOne((req) => req.url.endsWith('/api/permissions/capabilities')).flush([CAPABILITY]);
  httpMock.expectOne((req) => req.url.endsWith('/api/grants')).flush(RAW_CATALOG);
  if (id !== 'new') {
    httpMock.expectOne((req) => req.url.endsWith(`/api/permissions/grant-groups/${id}/authoring-state`)).flush(authoringState);
  }
  fixture.detectChanges();
  return { fixture, httpMock };
}

/** Dirties the form the same way a real user edit would - renames the group
 * and flips one capability's scope - so "unsaved selections remain unchanged
 * after a failed save" has two independent things to check, not just the name. */
const ME = { hasProfile: true, employeeId: 'me-1', firstName: 'Ana', lastName: 'Test', role: 'Member', grants: ['permissions.manage'], colorHex: null, companies: [], hasPinSet: false };

function makeDirty(component: GrantGroupFormComponent, name: string): void {
  component.form.controls.name.setValue(name);
  component.onScopeChange(CAPABILITY.key, 'Manage');
}

describe('GrantGroupFormComponent - save failure handling', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('capability CREATE failure (409 duplicate name): shows a visible error, keeps the editor open with unsaved input intact, and re-enables Save', async () => {
    const { fixture, httpMock } = await createFixture('new');
    const component = fixture.componentInstance;
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    makeDirty(component, 'Duplicate Role');
    fixture.detectChanges();
    expect(component.saving()).toBe(false);

    component.onSave();
    expect(component.saving()).toBe(true);

    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/capability-based') && req.method === 'POST').flush(CONFLICT_BODY, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    // Shown exactly once - the global error interceptor is the sole source of
    // this toast; the component must not also raise its own (see PART G's
    // no-duplicate-toast requirement).
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls.some((call) => call[0] === TRANSLATIONS.errors.DUPLICATE_NAME)).toBe(true);

    // Editor stayed on the same (create) form - never navigated away.
    expect(component.editingId()).toBeNull();
    // Unsaved name and capability selection are exactly what the user entered.
    expect(component.form.getRawValue().name).toBe('Duplicate Role');
    expect(component.scopeFor(CAPABILITY.key)).toBe('Manage');
    // Save is usable again.
    expect(component.saving()).toBe(false);
    expect(component.dirty()).toBe(true);
  });

  it('capability UPDATE failure (409 duplicate name): shows a visible error, keeps unsaved selections, and does not refetch authoring-state', async () => {
    const { fixture, httpMock } = await createFixture('group-1');
    const component = fixture.componentInstance;
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    makeDirty(component, 'Recepcija Renamed');
    fixture.detectChanges();

    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/capability-based') && req.method === 'PUT').flush(CONFLICT_BODY, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(component.form.getRawValue().name).toBe('Recepcija Renamed');
    expect(component.scopeFor(CAPABILITY.key)).toBe('Manage');
    expect(component.dirty()).toBe(true);

    // No authoring-state GET beyond the initial load - onSave's success-only reloadAuthoringState() must not run.
    httpMock.expectNone((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/authoring-state'));
  });

  it('a known backend error code (DUPLICATE_NAME) shows its own translated message, not the generic fallback', async () => {
    const { fixture, httpMock } = await createFixture('new');
    const component = fixture.componentInstance;
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    makeDirty(component, 'Some Role');
    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/capability-based')).flush(CONFLICT_BODY, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(errorSpy.mock.calls.some((call) => call[0] === TRANSLATIONS.errors.DUPLICATE_NAME)).toBe(true);
    expect(errorSpy.mock.calls.some((call) => call[0] === TRANSLATIONS.PERMISSIONS.GRANT_GROUPS.SAVE_FAILED)).toBe(false);
  });

  it('an unrecognized/missing backend error code falls back to the generic error message, shown exactly once', async () => {
    const { fixture, httpMock } = await createFixture('new');
    const component = fixture.componentInstance;
    const notifications = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notifications, 'showError');

    makeDirty(component, 'Some Role');
    component.onSave();
    // No body at all (e.g. a network-level failure) - the interceptor's
    // toAppError() has no error.error.code to read, so its own 'UNKNOWN'
    // sentinel + resolveErrorMessage's generic fallback is what's under test.
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/capability-based')).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe(TRANSLATIONS.errors.UNKNOWN);
  });

  it('a successful save still refetches authoring-state and clears the dirty flag from the authoritative reload', async () => {
    const { fixture, httpMock } = await createFixture('group-1');
    const component = fixture.componentInstance;

    makeDirty(component, 'Recepcija Renamed');
    expect(component.dirty()).toBe(true);

    component.onSave();
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/capability-based') && req.method === 'PUT')
      .flush({ ...EXISTING_GROUP, name: 'Recepcija Renamed' });
    fixture.detectChanges();

    const refetch = httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/authoring-state'));
    refetch.flush({ ...AUTHORING_STATE, grantGroup: { ...EXISTING_GROUP, name: 'Recepcija Renamed' } });
    // The editor may belong to this group - its own effective grants are re-read.
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(ME);
    fixture.detectChanges();

    expect(component.dirty()).toBe(false);
    expect(component.form.getRawValue().name).toBe('Recepcija Renamed');
  });
});

const TEMPLATE_BACKED_STATE: GrantGroupAuthoringStateDto = {
  ...AUTHORING_STATE,
  templateSourceKey: 'Recepcija',
  templateSourceVersion: 1,
};

const UPGRADE_STATUS: GrantGroupTemplateUpgradeStatusDto = {
  grantGroupId: 'group-1',
  templateKey: 'Recepcija',
  currentTemplateVersion: 1,
  latestTemplateVersion: 2,
  hasUpgrade: true,
  isCustomized: false,
};

function bannerElement(fixture: ComponentFixture<GrantGroupFormComponent>): Element | null {
  return (fixture.nativeElement as HTMLElement).querySelector('.grant-group-form-page__upgrade-banner');
}

describe('GrantGroupFormComponent - template upgrade banner', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('skips the upgrade-status call entirely and hides the banner for a custom/no-provenance role', async () => {
    const { fixture, httpMock } = await createFixture('group-1', AUTHORING_STATE);
    fixture.detectChanges();

    httpMock.expectNone((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/template-upgrade-status'));
    expect(bannerElement(fixture)).toBeNull();
  });

  it('fetches upgrade status and shows the banner when the role has template provenance and hasUpgrade=true', async () => {
    const { fixture, httpMock } = await createFixture('group-1', TEMPLATE_BACKED_STATE);
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/template-upgrade-status')).flush(UPGRADE_STATUS);
    fixture.detectChanges();

    expect(bannerElement(fixture)).not.toBeNull();
  });

  it('hides the banner when the role has template provenance but hasUpgrade=false', async () => {
    const { fixture, httpMock } = await createFixture('group-1', TEMPLATE_BACKED_STATE);
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/template-upgrade-status')).flush({ ...UPGRADE_STATUS, hasUpgrade: false });
    fixture.detectChanges();

    expect(bannerElement(fixture)).toBeNull();
  });

  it('onUpgradeApplied() reloads both authoring-state and upgrade-status', async () => {
    const { fixture, httpMock } = await createFixture('group-1', TEMPLATE_BACKED_STATE);
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/template-upgrade-status')).flush(UPGRADE_STATUS);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.onUpgradeApplied();

    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/authoring-state')).flush(TEMPLATE_BACKED_STATE);
    httpMock.expectOne((req) => req.url.endsWith('/api/employees/me')).flush(ME);
    httpMock.expectOne((req) => req.url.endsWith('/api/permissions/grant-groups/group-1/template-upgrade-status')).flush({ ...UPGRADE_STATUS, hasUpgrade: false });
    fixture.detectChanges();

    expect(bannerElement(fixture)).toBeNull();
  });
});
