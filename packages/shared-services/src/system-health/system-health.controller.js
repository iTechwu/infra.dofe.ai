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
exports.SystemHealthController = void 0;
const common_1 = require("@nestjs/common");
const system_health_service_1 = require("./system-health.service");
const ts_rest_controller_decorator_1 = require("../../../common/src/decorators/ts-rest-controller.decorator");
/**
 * Health Check Controller
 * 健康检查控制器
 *
 * Exposes /health endpoint for monitoring and load balancer health checks.
 * This endpoint is excluded from the global '/api' prefix.
 *
 * 暴露 /health 端点用于监控和负载均衡器健康检查。
 * 此端点已从全局 '/api' 前缀中排除。
 */
let SystemHealthController = class SystemHealthController {
    healthService;
    constructor(healthService) {
        this.healthService = healthService;
    }
    /**
     * Basic health check
     * 基础健康检查
     *
     * Returns 200 if the service is running.
     * Used by load balancers and Kubernetes liveness probes.
     */
    async check() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Detailed health check
     * 详细健康检查
     *
     * Checks all dependencies (database, Redis, RabbitMQ).
     * Used by Kubernetes readiness probes.
     */
    async ready() {
        const [database, redis, rabbitmq] = await Promise.all([
            this.healthService.checkDatabaseConnection(),
            this.healthService.checkRedisConnection(),
            this.healthService.checkRabbitMQConnection(),
        ]);
        const isHealthy = database && redis && rabbitmq;
        return {
            status: isHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: {
                database: database ? 'ok' : 'fail',
                redis: redis ? 'ok' : 'fail',
                rabbitmq: rabbitmq ? 'ok' : 'fail',
            },
        };
    }
};
exports.SystemHealthController = SystemHealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemHealthController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('ready'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SystemHealthController.prototype, "ready", null);
exports.SystemHealthController = SystemHealthController = __decorate([
    (0, ts_rest_controller_decorator_1.TsRestController)({ path: 'health' }),
    __metadata("design:paramtypes", [system_health_service_1.SystemHealthService])
], SystemHealthController);
//# sourceMappingURL=system-health.controller.js.map