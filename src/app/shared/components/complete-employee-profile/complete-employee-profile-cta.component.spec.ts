import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CurrentEmployeeService } from '../../../core/services/current-employee.service';
import { OnboardingStatusService } from '../../../core/services/onboarding-status.service';
import { CompleteEmployeeProfileCtaComponent } from './complete-employee-profile-cta.component';

/**
 * Residual IsOwner Removal - shouldShow's real business condition is now
 * "loaded, and no Employee profile yet", with no Owner flag anywhere. These
 * tests exercise that condition directly (no fixture.detectChanges(), so the
 * child CompleteEmployeeProfileDialogComponent is never instantiated and
 * doesn't need its own HTTP/PrimeNG dependencies satisfied here).
 */
function createComponent(loaded: boolean, hasProfile: boolean): CompleteEmployeeProfileCtaComponent {
  TestBed.configureTestingModule({
    imports: [CompleteEmployeeProfileCtaComponent],
    providers: [
      {
        provide: CurrentEmployeeService,
        useValue: { loaded: signal(loaded), hasProfile: signal(hasProfile) },
      },
      { provide: OnboardingStatusService, useValue: { getStatus: () => of({}) } },
    ],
  });

  return TestBed.createComponent(CompleteEmployeeProfileCtaComponent).componentInstance;
}

describe('CompleteEmployeeProfileCtaComponent.shouldShow', () => {
  it('shows the CTA for a loaded, profile-less user (the freshly-registered founder)', () => {
    const component = createComponent(true, false);
    expect(component.shouldShow()).toBe(true);
  });

  it('does not show the CTA once the user has an Employee profile', () => {
    const component = createComponent(true, true);
    expect(component.shouldShow()).toBe(false);
  });

  it('does not show the CTA before CurrentEmployeeService has finished loading, even with no profile yet', () => {
    const component = createComponent(false, false);
    expect(component.shouldShow()).toBe(false);
  });

  it('does not depend on any Owner/IsOwner concept - a normal permission-admin user with a profile never sees it', () => {
    // A normal, fully-onboarded permission-admin user (has a profile) - the
    // CTA must stay hidden regardless of what grants they hold, since it has
    // no isOwner()/grants check at all any more.
    const component = createComponent(true, true);
    expect(component.shouldShow()).toBe(false);
  });
});
