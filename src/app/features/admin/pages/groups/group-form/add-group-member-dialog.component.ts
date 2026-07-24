import { Component, DestroyRef, ViewChild, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TimeoutError, finalize, timeout } from 'rxjs';
import { ClientDto } from '../../../../../core/models/client.model';
import { GroupDetailDto } from '../../../../../core/models/group.model';
import { ClientsService } from '../../../../../core/services/clients.service';
import { GroupsService } from '../../../../../core/services/groups.service';
import { NotificationService } from '../../../../../core/services/notification.service';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const ADD_MEMBER_TIMEOUT_MS = 20000;

/**
 * "Dodaj člana" modal on the group detail page - paginated/searchable client
 * list (same ClientsService/PagedCrudService as the Klijenti screen), POST
 * .../members per row. Stays open after a successful add so multiple members
 * can be added in one go; the just-added client is hidden immediately (see
 * justAddedIds) so a slow reload of `group` can't leave it double-clickable.
 * ALREADY_MEMBER (and any other add error) is left to the global error-toast
 * interceptor - no local handling needed beyond resetting the row spinner.
 *
 * The content (search + table) is NEVER removed from the DOM by us - no
 * @if around it. p-dialog's own [(visible)] fully owns showing/hiding it via
 * its own CSS (display:none when closed), same as everything else inside a
 * p-dialog. Earlier this was gated behind an @if(visible()), which meant our
 * content vanished the INSTANT `visible` flipped false - synchronously, in
 * the same tick as p-dialog trying to run its own leave transition, which
 * (per --pui-motion-height showing up on the dialog element) animates based
 * on the content's actual height. Yanking that content out from under an
 * in-progress height-based transition can leave it with nothing to animate,
 * so it never reports "done" (onAfterLeave never fires) - and p-dialog only
 * calls applyHiddenStyles() (hides the mask/backdrop) from inside that
 * callback. Net effect: close the dialog while this was happening and the
 * backdrop + header shell could get stuck on screen forever, unclosable,
 * even though our own inner content was already gone. Never touching the
 * DOM ourselves removes the interference entirely, instead of just betting
 * on a different transition-completion event the way the @if(dialogShown())
 * gate used to (see git history) - that one had the exact same failure mode
 * on the *open* side.
 *
 * Because the table is never destroyed/recreated, p-table's own automatic
 * "fire onLazyLoad once on init" (which is what drove the initial fetch
 * before) would only ever happen once, on first construction - not on every
 * reopen. So [lazyLoadOnInit]="false" turns that off, and the effect below
 * fetches manually every time `visible` becomes true instead. This does NOT
 * reintroduce the earlier double-fetch race (search history) because it's
 * now the ONLY source of the initial fetch - the table's own auto-init-fire
 * is disabled, so there's nothing left to race against.
 */
@Component({
  selector: 'app-add-group-member-dialog',
  imports: [Dialog, FormsModule, IconField, InputIcon, InputText, TableModule, Button, TranslatePipe],
  templateUrl: './add-group-member-dialog.component.html',
  styleUrl: './add-group-member-dialog.component.scss',
})
export class AddGroupMemberDialogComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly groupsService = inject(GroupsService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private debounceHandle: ReturnType<typeof setTimeout> | undefined;

  @ViewChild('dt') private table!: Table;

  readonly visible = model(false);
  readonly group = input.required<GroupDetailDto>();
  readonly changed = output<void>();

  readonly items = signal<ClientDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly rows = signal(PAGE_SIZE);
  readonly search = signal('');
  readonly addingClientId = signal<string | null>(null);

  private readonly justAddedIds = signal<Set<string>>(new Set());

  readonly activeMemberIds = computed(
    () => new Set(this.group().members.filter((member) => member.isActive).map((member) => member.clientId)),
  );

  readonly visibleItems = computed(() => {
    const excluded = this.activeMemberIds();
    const justAdded = this.justAddedIds();
    return this.items().filter((client) => !excluded.has(client.id) && !justAdded.has(client.id));
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.search.set('');
        this.justAddedIds.set(new Set());
        if (this.table) {
          this.table.first = 0;
        }
        this.fetch(0, this.rows());
      }
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.debounceHandle));
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows();
    this.rows.set(rows);
    this.fetch(first, rows);
  }

  onSearchInput(term: string): void {
    clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => {
      this.search.set(term);
      this.table.first = 0;
      this.fetch(0, this.rows());
    }, SEARCH_DEBOUNCE_MS);
  }

  addClient(client: ClientDto, event?: Event): void {
    event?.stopPropagation();
    if (this.addingClientId()) {
      return;
    }

    this.addingClientId.set(client.id);
    this.groupsService
      .addMember(this.group().id, client.id)
      .pipe(
        timeout(ADD_MEMBER_TIMEOUT_MS),
        finalize(() => this.addingClientId.set(null)),
      )
      .subscribe({
        next: (updated) => {
          this.notifications.showSuccess(this.translate.instant('GROUPS.MEMBERS.ADDED'));
          for (const warning of updated.warnings) {
            this.notifications.showWarning(warning);
          }
          this.justAddedIds.update((ids) => new Set(ids).add(client.id));
          this.changed.emit();
        },
        error: (err: unknown) => {
          // A plain HttpErrorResponse (incl. 409 ALREADY_MEMBER) is already
          // toasted by the global error interceptor. A TimeoutError never
          // reaches that interceptor (it's not an HttpErrorResponse - the
          // request is still technically in flight from Angular's point of
          // view, just abandoned client-side), so it needs its own toast or
          // a hung backend would silently reset the spinner with no
          // explanation.
          if (err instanceof TimeoutError) {
            this.notifications.showError(this.translate.instant('errors.UNKNOWN'));
          }
        },
      });
  }

  private fetch(first: number, rows: number): void {
    this.loading.set(true);
    const page = Math.floor(first / rows) + 1;
    this.clientsService
      .getPage({ page, pageSize: rows, search: this.search() || undefined, isActive: true })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.items.set(result.items);
        this.totalCount.set(result.totalCount);
      });
  }
}
