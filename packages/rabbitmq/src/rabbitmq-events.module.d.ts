import * as Rabbitmq from 'amqplib';
export declare const RABBITMQ_EVENTS_CONNECTION = "RABBITMQ_EVENTS_CONNECTION";
export interface RabbitmqEventsConnection {
    connection: Rabbitmq.Connection;
    close: () => Promise<void>;
}
export declare class RabbitmqEventsModule {
}
