"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThirdPartySseClient = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const events_1 = require("events");
let ThirdPartySseClient = class ThirdPartySseClient extends events_1.EventEmitter {
    httpService;
    baseUrl;
    eventSource = null;
    constructor(httpService) {
        super();
        this.httpService = httpService;
        // video-task-processor has been removed, baseUrl is no longer needed
        this.baseUrl = '';
    }
    onModuleInit() {
        // Initialize without connecting - connection will be established when needed
    }
    connect(taskId) {
        // Close existing connection if any
        if (this.eventSource) {
            this.eventSource.close();
        }
        const url = `${this.baseUrl}/task/${taskId}/sse`;
        this.listenToThirdPartySse(url);
    }
    listenToThirdPartySse(url) {
        this.eventSource = new EventSource(url);
        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.emit('data', data); // Emit data for other parts of the application
        };
        this.eventSource.onerror = (err) => {
            console.error('Error connecting to third-party SSE:', err);
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
            }
        };
    }
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
};
exports.ThirdPartySseClient = ThirdPartySseClient;
exports.ThirdPartySseClient = ThirdPartySseClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], ThirdPartySseClient);
//# sourceMappingURL=third-party-sse.client.js.map