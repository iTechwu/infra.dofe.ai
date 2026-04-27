import { SystemHealthService } from './system-health.service';
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
export declare class SystemHealthController {
    private readonly healthService;
    constructor(healthService: SystemHealthService);
    /**
     * Basic health check
     * 基础健康检查
     *
     * Returns 200 if the service is running.
     * Used by load balancers and Kubernetes liveness probes.
     */
    check(): Promise<{
        status: string;
        timestamp: string;
    }>;
    /**
     * Detailed health check
     * 详细健康检查
     *
     * Checks all dependencies (database, Redis, RabbitMQ).
     * Used by Kubernetes readiness probes.
     */
    ready(): Promise<{
        status: string;
        timestamp: string;
        checks: {
            database: string;
            redis: string;
            rabbitmq: string;
        };
    }>;
}
