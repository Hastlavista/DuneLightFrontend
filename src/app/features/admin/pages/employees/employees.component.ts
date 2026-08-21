import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { EngagementTypesComponent } from './engagement-types/engagement-types.component';

const DEFAULT_TAB = 'employees';

/**
 * "Zaposlenici" tab shell. Vrste angažmana is a small šifrarnik used only by
 * the employee form's engagement-type dropdown, so it lives as a second tab
 * here rather than getting its own nav entry (same reasoning as Usluge's
 * Cjenik/Paketi tabs). Employees' create/edit form is a separate
 * routed page (see EmployeeFormComponent) and always navigates back to this
 * default tab.
 */
@Component({
  selector: 'app-admin-employees',
  imports: [Tabs, TabList, Tab, TabPanels, TabPanel, TranslatePipe, EmployeeListComponent, EngagementTypesComponent],
  templateUrl: './employees.component.html',
})
export class EmployeesComponent {
  private readonly route = inject(ActivatedRoute);

  readonly initialTab = this.route.snapshot.queryParamMap.get('tab') ?? DEFAULT_TAB;
}
