import type * as Rabbitmq from 'amqplib';

export const RABBITMQ_EVENTS_CONNECTION = 'RABBITMQ_EVENTS_CONNECTION';

export interface RabbitmqEventsConnection {
  connection: Rabbitmq.Connection;
  close: () => Promise<void>;
}
