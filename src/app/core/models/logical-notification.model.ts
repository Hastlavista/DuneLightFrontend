export type LogicalNotificationStatus = 'Pending' | 'Cancelled';
export type LogicalNotificationType = 'BookingCancelled' | 'WaitlistPromoted' | 'BookingNoShow';
export interface LogicalNotificationDto { id: string; clientId: string | null; clientName: string | null; type: LogicalNotificationType; sourceType: string; sourceId: string; sourceVersion: number; status: LogicalNotificationStatus; data: string | null; occurredAt: string; createdAt: string; }
