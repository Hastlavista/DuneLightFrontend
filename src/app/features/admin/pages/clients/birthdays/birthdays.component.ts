import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { finalize } from 'rxjs';
import { BirthdayDto } from '../../../../../core/models/client.model';
import { ClientsService } from '../../../../../core/services/clients.service';
import { toEndOfDayIso, toStartOfDayIso } from '../../../../../core/utils/date.util';

type QuickRange = 'today' | 'week' | 'month' | 'custom';

const DATE_FORMATTER = new Intl.DateTimeFormat('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  // Croatian week starts Monday - getDay() is 0 (Sun) .. 6 (Sat).
  const diff = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - diff);
  return result;
}

function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** "Rođendani" - read-only lookup over GET /api/clients/birthdays?from=&to=, a
 * flat array (not paged). Birth year is ignored server-side when matching; only
 * `nextOccurrence` (the actual date within [from, to]) is used for sorting/display. */
@Component({
  selector: 'app-admin-birthdays',
  imports: [TranslatePipe, Button],
  templateUrl: './birthdays.component.html',
  styleUrl: './birthdays.component.scss',
})
export class BirthdaysComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly router = inject(Router);

  readonly items = signal<BirthdayDto[]>([]);
  readonly loading = signal(false);
  readonly activeRange = signal<QuickRange>('today');
  readonly customFrom = signal<Date>(new Date());
  readonly customTo = signal<Date>(new Date());

  constructor() {
    this.applyQuickRange('today');
  }

  applyQuickRange(range: QuickRange): void {
    this.activeRange.set(range);
    const today = new Date();
    let from: Date;
    let to: Date;
    switch (range) {
      case 'week':
        from = startOfWeek(today);
        to = endOfWeek(today);
        break;
      case 'month':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      default:
        from = startOfDay(today);
        to = startOfDay(today);
    }
    this.customFrom.set(from);
    this.customTo.set(to);
    this.fetch(from, to);
  }

  onCustomFromChange(date: Date): void {
    this.customFrom.set(date);
    this.activeRange.set('custom');
  }

  onCustomToChange(date: Date): void {
    this.customTo.set(date);
    this.activeRange.set('custom');
  }

  applyCustomRange(): void {
    this.activeRange.set('custom');
    this.fetch(this.customFrom(), this.customTo());
  }

  turningAge(item: BirthdayDto): number {
    return new Date(item.nextOccurrence).getFullYear() - new Date(item.dateOfBirth).getFullYear();
  }

  initials(item: BirthdayDto): string {
    return `${item.firstName.charAt(0)}${item.lastName.charAt(0)}`.toUpperCase();
  }

  rangeLabel(): string {
    return `${DATE_FORMATTER.format(this.customFrom())} – ${DATE_FORMATTER.format(this.customTo())}`;
  }

  whenLabel(item: BirthdayDto): string {
    const today = startOfDay(new Date());
    const birthday = startOfDay(new Date(item.nextOccurrence));
    const days = Math.round((birthday.getTime() - today.getTime()) / 86_400_000);
    const prefix = days === 0 ? 'Danas' : days === 1 ? 'Sutra' : `Za ${days} dana`;
    return `${prefix} · ${DATE_FORMATTER.format(birthday)}`;
  }

  openClient(item: BirthdayDto): void {
    this.router.navigate(['/admin/clients', item.id]);
  }

  private fetch(from: Date, to: Date): void {
    this.loading.set(true);
    this.clientsService
      .getBirthdays(toStartOfDayIso(from), toEndOfDayIso(to))
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => this.items.set(items));
  }
}
