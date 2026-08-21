import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OnboardingStatusDto } from '../models/onboarding-status.model';

@Injectable({ providedIn: 'root' })
export class OnboardingStatusService {
  private readonly http = inject(HttpClient);

  getStatus(): Observable<OnboardingStatusDto> {
    return this.http.get<OnboardingStatusDto>(`${environment.apiUrl}/api/onboarding-status`);
  }
}
