/** GET /api/catalog/rooms/{id} and the items of its paged list. Scoped to a
 * Company (companyId/companyName kept as the raw backend field names, same
 * precedent as CompanyHolidayDto/GroupDto - see company.model.ts's doc
 * comment on why the top-level entity itself is renamed but nested
 * references to it aren't). */
export interface RoomDto {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  /** false (default) - the room hard-blocks overlapping appointments, same as
   * a trainer. true - multiple appointments may share this room at the same
   * time (e.g. an open gym floor). Drives the 409 APPOINTMENT_OVERLAP check
   * server-side. */
  allowConcurrentBookings: boolean;
  isActive: boolean;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Body for both POST and PUT /api/catalog/rooms - identical shape. `isActive`
 * is never sent, it has its own activate/deactivate endpoints. */
export interface RoomUpsertRequest {
  companyId: string;
  name: string;
  allowConcurrentBookings: boolean;
  note: string | null;
  sortOrder: number;
}
