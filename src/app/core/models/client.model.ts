/** One tag assigned to a client, as returned by GET - a full object (id + name +
 * color), not a bare tag id. See ClientUpsertRequest.tagIds for the write side,
 * which is a full-replace list of ids. */
export interface ClientTagRef {
  tagId: string;
  name: string;
  colorHex: string | null;
}

/** GET /api/clients/{id} and the items of its paged list. Null/absent fields are
 * both possible - the backend omits null fields from the JSON entirely, so treat
 * "missing key" and "null" the same. `homeCompanyName`/`homeTrainerName` are
 * ready-to-display text (trainer name is already "Ime Prezime"). Unlike
 * Zaposlenici, assigning a home company/trainer/tag is NOT checked for
 * activity by the backend - inactive ones stay assigned freely, no grandfathering
 * warning, no VALIDATION_ERROR. */
export interface ClientDto {
  id: string;
  memberNumber: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  occupation?: string;
  phone?: string;
  email?: string;
  note?: string;
  healthNote?: string;
  gdprConsentGiven: boolean;
  gdprConsentDate?: string;
  homeCompanyId?: string;
  homeCompanyName?: string;
  homeTrainerId?: string;
  homeTrainerName?: string;
  isActive: boolean;
  isAnonymized: boolean;
  anonymizedAt?: string;
  tags: ClientTagRef[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Body for both POST and PUT /api/clients - identical shape. `tagIds` is a
 * full-replace of the client's tags on every save, same convention as
 * Zaposlenici's `companyIds`/`serviceIds`. `dateOfBirth`/`gdprConsentDate` -
 * use toStartOfDayIso(). The backend requires gdprConsentDate whenever
 * gdprConsentGiven is true (VALIDATION_ERROR otherwise) - validate this on the
 * frontend first. */
export interface ClientUpsertRequest {
  memberNumber: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  healthNote: string | null;
  gdprConsentGiven: boolean;
  gdprConsentDate: string | null;
  homeCompanyId: string | null;
  homeTrainerId: string | null;
  tagIds: string[];
}

/** One row of GET /api/clients/birthdays - a flat array, NOT a PagedResult.
 * `dateOfBirth` keeps the real birth year (so the turning age can be shown);
 * `nextOccurrence` is the actual date of that birthday within the requested
 * [from, to] range, birth year ignored for matching. Sorted by nextOccurrence. */
export interface BirthdayDto {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth: string;
  nextOccurrence: string;
}
