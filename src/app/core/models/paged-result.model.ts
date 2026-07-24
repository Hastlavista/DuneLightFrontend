/** Shape returned by every paginated list endpoint in the API. */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Query parameters accepted by every paginated list endpoint.
 * `isActive` follows the "show inactive" switch contract: omit it to get all
 * records, or set it to `true` to get only active ones - there is no `false` case
 * in this app's UI (see PagedCrudService.getPage). */
export interface PagedQuery {
  page: number;
  pageSize: number;
  search?: string;
  isActive?: boolean;
}
