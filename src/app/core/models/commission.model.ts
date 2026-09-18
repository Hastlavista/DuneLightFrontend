import { PagedResult } from './paged-result.model';

export type CommissionSubjectType = 'Service' | 'Product' | 'Package';
export type CommissionCalculationType = 'Percentage' | 'Fixed';
export type CommissionEntryStatus = 'Earned' | 'Reversed';
export interface CommissionRuleDto { id: string; employeeId: string; employeeName: string; subjectType: CommissionSubjectType; serviceId: string | null; serviceName: string | null; productId: string | null; productName: string | null; packageId: string | null; packageName: string | null; calculationType: CommissionCalculationType; value: number; isActive: boolean; createdAt: string; updatedAt: string | null; }
export interface CommissionRuleRequest { employeeId: string; subjectType: CommissionSubjectType; serviceId: string | null; productId: string | null; packageId: string | null; calculationType: CommissionCalculationType; value: number; }
export interface CommissionEntryDto { id: string; employeeId: string; employeeName: string; companyId: string; companyName: string; sourceType: string; appointmentId: string | null; bookingId: string | null; checkoutItemId: string | null; baseAmount: number; calculationType: CommissionCalculationType; ruleValue: number; commissionAmount: number; status: CommissionEntryStatus; earnedAt: string; }
export interface CommissionSummaryResultDto { employees: { employeeId: string; employeeName: string; earnedAmount: number; reversedAmount: number; netAmount: number; entryCount: number }[]; totalNetAmount: number; }
export type CommissionEntriesResult = PagedResult<CommissionEntryDto>;
