import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter } from 'events';
export declare class ThirdPartySseClient extends EventEmitter implements OnModuleInit {
    private readonly httpService;
    private readonly baseUrl;
    private eventSource;
    constructor(httpService: HttpService);
    onModuleInit(): void;
    connect(taskId: string): void;
    private listenToThirdPartySse;
    disconnect(): void;
}
