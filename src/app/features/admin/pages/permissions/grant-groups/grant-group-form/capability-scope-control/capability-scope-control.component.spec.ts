import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CapabilitySelectedScope } from '../../../../../../../core/models/capability.model';
import { CapabilityScopeControlComponent } from './capability-scope-control.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

describe('CapabilityScopeControlComponent', () => {
  let fixture: ComponentFixture<CapabilityScopeControlComponent>;
  let component: CapabilityScopeControlComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CapabilityScopeControlComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } })],
    }).compileComponents();

    fixture = TestBed.createComponent(CapabilityScopeControlComponent);
    component = fixture.componentInstance;
  });

  function values(scope: CapabilitySelectedScope[]): CapabilitySelectedScope[] {
    return scope;
  }

  // Part T 1-4: exact option set per ScopeModel.
  it('None: renders exactly [None, On]', () => {
    component.scopeModel = 'None';
    component.selectedScope = 'None';
    expect(component.options.map((o) => o.value)).toEqual(values(['None', 'On']));
  });

  it('ViewManage: renders exactly [None, View, Manage]', () => {
    component.scopeModel = 'ViewManage';
    component.selectedScope = 'None';
    expect(component.options.map((o) => o.value)).toEqual(values(['None', 'View', 'Manage']));
  });

  it('OwnAll: renders exactly [None, Own, All]', () => {
    component.scopeModel = 'OwnAll';
    component.selectedScope = 'None';
    expect(component.options.map((o) => o.value)).toEqual(values(['None', 'Own', 'All']));
  });

  it('ViewOwnAll: renders exactly [None, View, Own, All]', () => {
    component.scopeModel = 'ViewOwnAll';
    component.selectedScope = 'None';
    expect(component.options.map((o) => o.value)).toEqual(values(['None', 'View', 'Own', 'All']));
  });

  it('never exposes raw .view/.manage/.own/.all grant keys as option values - only CapabilitySelectedScope', () => {
    component.scopeModel = 'ViewOwnAll';
    component.selectedScope = 'None';
    for (const option of component.options) {
      expect(['None', 'View', 'Own', 'All']).toContain(option.value);
    }
  });

  it('emits selectedScopeChange only when the value actually changes', () => {
    component.scopeModel = 'ViewManage';
    component.selectedScope = 'View';
    const emitted: CapabilitySelectedScope[] = [];
    component.selectedScopeChange.subscribe((v) => emitted.push(v));

    component.onChange('View');
    expect(emitted).toEqual([]);

    component.onChange('Manage');
    expect(emitted).toEqual(['Manage']);
  });
});
