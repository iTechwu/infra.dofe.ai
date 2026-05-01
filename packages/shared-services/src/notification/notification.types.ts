export type NotificationChannel = 'email' | 'webhook';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface NotificationSendOptions {
  channel: NotificationChannel;
  recipients: string[];
  subject?: string;
  content: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}
