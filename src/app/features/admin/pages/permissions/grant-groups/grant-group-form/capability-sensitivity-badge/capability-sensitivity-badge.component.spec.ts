import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CapabilitySensitivityBadgeComponent } from './capability-sensitivity-badge.component';

class FakeTranslateLoader implements TranslateLoader {
  getTranslation() {
    return of({});
  }
}

describe('CapabilitySensitivityBadgeComponent (Part T 5)', () => {
  let fixture: ComponentFixture<CapabilitySensitivityBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CapabilitySensitivityBadgeComponent],
      providers: [provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeTranslateLoader } })],
    }).compileComponents();
    fixture = TestBed.createComponent(CapabilitySensitivityBadgeComponent);
  });

  it('Normal: renders nothing', () => {
    fixture.componentInstance.sensitivity = 'Normal';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.capability-sensitivity-badge')).toBeNull();
  });

  it('Sensitive: renders a subtle marker', () => {
    fixture.componentInstance.sensitivity = 'Sensitive';
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.capability-sensitivity-badge--sensitive');
    expect(el).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.capability-sensitivity-badge--high-risk')).toBeNull();
  });

  it('HighRisk: renders a stronger visible warning', () => {
    fixture.componentInstance.sensitivity = 'HighRisk';
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.capability-sensitivity-badge--high-risk');
    expect(el).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.capability-sensitivity-badge--sensitive')).toBeNull();
  });
});
