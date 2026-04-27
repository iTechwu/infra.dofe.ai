import * as Rabbitmq from 'amqplib';
export declare const RABBITMQ_CONNECTION: unique symbol;
export declare class AppRabbitConfig {
    url: string;
}
export interface RabbitmqConnection {
    connection: Rabbitmq.Connection;
    close(): Promise<void>;
}
