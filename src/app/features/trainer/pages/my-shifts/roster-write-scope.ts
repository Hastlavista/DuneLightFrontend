import { Signal, computed } from '@angular/core';
import { CurrentEmployeeService } from '../../../../core/services/current-employee.service';

export const ROSTER_WRITE_ALL_GRANT = 'roster.entries.write.all';

export interface RosterWriteScope {
  /** roster.entries.write.all - may write any employee's roster entries. */
  readonly hasFullRosterScope: Signal<boolean>;
  /** Whether the viewer may create/edit/delete entries belonging to `employeeId`. */
  canWriteEntriesFor(employeeId: string | null | undefined): boolean;
}

/** Mirrors the backend's RosterEntryService.ValidateOwnership: write.all covers
 * every employee, write.own only the caller's own Employee, neither covers none. */
export function rosterWriteScope(currentEmployeeService: CurrentEmployeeService): RosterWriteScope {
  const hasFullRosterScope = computed(() => currentEmployeeService.hasGrant(ROSTER_WRITE_ALL_GRANT));
  const canWriteOwn = computed(() => currentEmployeeService.can('roster.entries.manage'));
  const selfId = computed(() => currentEmployeeService.employee()?.employeeId ?? null);
  return {
    hasFullRosterScope,
    canWriteEntriesFor: (employeeId) =>
      !!employeeId && (hasFullRosterScope() || (canWriteOwn() && employeeId === selfId())),
  };
}
