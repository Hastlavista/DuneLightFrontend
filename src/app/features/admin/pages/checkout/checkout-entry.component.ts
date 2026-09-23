import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { finalize } from 'rxjs';
import { checkoutStatusSeverity, checkoutStatusTranslationKey, CheckoutDto } from '../../../../core/models/checkout.model';
import { ClientDto } from '../../../../core/models/client.model';
import { CheckoutsService } from '../../../../core/services/checkouts.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { CompanyContextService } from '../../../../core/services/company-context.service';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EurCurrencyPipe } from '../../../../shared/pipes/eur-currency.pipe';
import { HrDatePipe } from '../../../../shared/pipes/hr-date.pipe';

const CLIENT_SEARCH_PAGE_SIZE = 10;

interface ClientSearchOption {
  clientId: string;
  name: string;
}

/**
 * "Blagajna" entry point (route 'checkout') - the backend has no global/
 * company-scoped Checkout browse endpoint, only a per-client history (see
 * CheckoutsService.getByClient's doc), so this screen is client-first: search
 * a client, see their existing Checkouts (resume an Open one, or start a new
 * one against a chosen Company). Doubles as spec sections 9 ("Create
 * Checkout") and 10 ("Checkout list").
 */
@Component({
  selector: 'app-checkout-entry',
  imports: [FormsModule, TranslatePipe, AutoComplete, Button, Select, Tag, TableModule, EurCurrencyPipe, HrDatePipe],
  templateUrl: './checkout-entry.component.html',
  styleUrl: './checkout-entry.component.scss',
})
export class CheckoutEntryComponent {
  private readonly checkoutsService = inject(CheckoutsService);
  private readonly clientsService = inject(ClientsService);
  protected readonly companyContextService = inject(CompanyContextService);
  protected readonly currentEmployeeService = inject(CurrentEmployeeService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly clientResults = signal<ClientSearchOption[]>([]);
  readonly selectedClient = signal<ClientSearchOption | null>(null);

  readonly checkouts = signal<CheckoutDto[]>([]);
  readonly loadingCheckouts = signal(false);
  readonly checkoutsFailed = signal(false);

  // Latest-request-wins: picking client B (or clearing) must not show A's checkouts.
  private checkoutsToken = 0;
  private clientSearchToken = 0;

  readonly selectedCompanyId = signal<string | null>(null);
  readonly creating = signal(false);

  readonly checkoutStatusTranslationKey = checkoutStatusTranslationKey;
  readonly checkoutStatusSeverity = checkoutStatusSeverity;

  constructor() {
    if (this.companyContextService.companies().length === 0) {
      this.companyContextService.loadCompanies();
    }

    // Do not submit a new Checkout against a stale Company after the operator
    // changes the global Company while this screen is open.
    effect(() => {
      const companyId = this.companyContextService.selectedCompanyId();
      if (companyId && this.selectedClient()) {
        this.selectedCompanyId.set(companyId);
      }
    });
  }

  onClientSearch(event: AutoCompleteCompleteEvent): void {
    const term = event.query.trim();
    const token = ++this.clientSearchToken;
    if (!term) {
      this.clientResults.set([]);
      return;
    }
    this.clientsService
      .getPage({ page: 1, pageSize: CLIENT_SEARCH_PAGE_SIZE, search: term, isActive: true }, { suppressErrorToast: true })
      .subscribe((result) => {
        if (token !== this.clientSearchToken) {
          return;
        }
        this.clientResults.set(
          result.items.map((client: ClientDto) => ({
            clientId: client.id,
            name: `${client.firstName} ${client.lastName}`,
          })),
        );
      });
  }

  /** PrimeNG emits the user's raw query while they type and emits a
   * ClientSearchOption only after choosing a suggestion. Never treat that
   * transient string as a selected Client: doing so requested
   * /api/checkouts?clientId=undefined and surfaced a false validation error. */
  onSelectedClientChange(client: ClientSearchOption | string | null): void {
    if (!client || typeof client === 'string') {
      this.checkoutsToken++;
      this.loadingCheckouts.set(false);
      this.checkoutsFailed.set(false);
      this.selectedClient.set(null);
      this.checkouts.set([]);
      return;
    }

    this.selectedClient.set(client);
    this.selectedCompanyId.set(this.companyContextService.selectedCompanyId() ?? this.companyContextService.companies()[0]?.id ?? null);
    if (client) {
      this.fetchCheckouts(client.clientId);
    } else {
      this.checkouts.set([]);
    }
  }

  openCheckout(checkout: CheckoutDto): void {
    this.router.navigate(['/app/checkout', checkout.id]);
  }

  createCheckout(): void {
    const client = this.selectedClient();
    const companyId = this.selectedCompanyId();
    if (!client || !companyId) {
      return;
    }
    this.creating.set(true);
    this.checkoutsService
      .create({ clientId: client.clientId, companyId })
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (checkout) => {
          this.notifications.showSuccess(this.translate.instant('CHECKOUT.ENTRY.CREATED'));
          this.router.navigate(['/app/checkout', checkout.id]);
        },
        error: () => {},
      });
  }

  private fetchCheckouts(clientId: string): void {
    const token = ++this.checkoutsToken;
    this.loadingCheckouts.set(true);
    this.checkoutsFailed.set(false);
    this.checkouts.set([]);
    this.checkoutsService
      .getByClient(clientId)
      .pipe(
        finalize(() => {
          if (token === this.checkoutsToken) {
            this.loadingCheckouts.set(false);
          }
        }),
      )
      .subscribe({
        next: (checkouts) => {
          if (token === this.checkoutsToken) {
            this.checkouts.set(checkouts);
          }
        },
        error: () => {
          if (token === this.checkoutsToken) {
            this.checkoutsFailed.set(true);
          }
        },
      });
  }
}
