export interface OperationalDashboardDto {
  company: { id: string; name: string; isActive: boolean };
  date: string;
  schedule: DashboardScheduleOccurrenceDto[];
  staff: DashboardStaffMemberDto[];
  financial: DashboardFinancialDto;
  alerts: DashboardAlertsDto;
}

export interface DashboardScheduleOccurrenceDto {
  appointmentId: string; startsAt: string; durationMinutes: number; status: string;
  serviceId: string; serviceName: string; employeeId: string | null; employeeName: string | null;
  roomId: string | null; roomName: string | null; isGroup: boolean; groupId: string | null; groupName: string | null;
  bookings: DashboardBookingSummaryDto[]; groupSummary: DashboardGroupSummaryDto | null;
}
export interface DashboardBookingSummaryDto { bookingId: string; clientId: string; clientName: string; bookingStatus: string; paidAmount: number; outstandingAmount: number; isPaid: boolean; packageCovered: boolean; }
export interface DashboardGroupSummaryDto { capacity: number; confirmedCount: number; completedCount: number; noShowCount: number; cancelledCount: number; waitingCount: number; availableReservationSeats: number; hasUnresolvedAttendance: boolean; }
export interface DashboardStaffMemberDto { employeeId: string; employeeName: string; isActive: boolean; isAbsent: boolean; isWorking: boolean; workIntervals: { start: string; end: string }[]; breaks: { startsAt: string; durationMinutes: number }[]; }
export interface DashboardFinancialDto { todayRevenue: number; outstandingAmount: number; unpaidBookingCount: number; openCheckoutCount: number; openCheckoutOutstandingAmount: number; }
export interface DashboardAlertsDto { waitingCount: number; noShowCount: number; cancelledBookingCount: number; cancelledAppointmentCount: number; unpaidBookingCount: number; outOfStockCount: number; outOfStockProducts: { productId: string; productName: string }[]; }
