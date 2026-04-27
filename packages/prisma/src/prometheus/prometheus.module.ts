import { Module, Global } from '@nestjs/common';
import {
  PrometheusModule as NestPrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { register } from 'prom-client';

// 在开发环境下清除已有的 metrics，避免热重载时重复注册
// 注意：register.clear() 必须在模块加载之前执行，但不会影响 NestJS 的依赖注入
// 因为 makeCounterProvider 创建的 providers 会在模块初始化时重新注册
if (process.env.NODE_ENV === 'dev') {
  register.clear();
}

// 定义所有 metrics providers
const metricsProviders = [
  // Preference Service Metrics
  makeCounterProvider({
    name: 'preference_cache_hits_total',
    help: 'Total number of preference cache hits',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'preference_cache_misses_total',
    help: 'Total number of preference cache misses',
    labelNames: ['operation'],
  }),
  makeHistogramProvider({
    name: 'preference_api_latency_seconds',
    help: 'Preference API call latency in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),
  makeCounterProvider({
    name: 'preference_operations_total',
    help: 'Total number of preference operations',
    labelNames: ['operation'],
  }),

  // Memory Service Metrics
  makeCounterProvider({
    name: 'memory_cache_hits_total',
    help: 'Total number of memory cache hits',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'memory_cache_misses_total',
    help: 'Total number of memory cache misses',
    labelNames: ['operation'],
  }),
  makeHistogramProvider({
    name: 'memory_api_latency_seconds',
    help: 'Memory API call latency in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),
  makeCounterProvider({
    name: 'memory_operations_total',
    help: 'Total number of memory operations',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'memory_batch_operations_total',
    help: 'Total number of memory batch operations',
    labelNames: ['operation', 'status'],
  }),
  makeHistogramProvider({
    name: 'memory_search_latency_seconds',
    help: 'Memory search latency in seconds',
    labelNames: ['method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  }),

  // Subscription Service Metrics
  makeCounterProvider({
    name: 'subscription_cache_hits_total',
    help: 'Total number of subscription cache hits',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'subscription_cache_misses_total',
    help: 'Total number of subscription cache misses',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'subscription_operations_total',
    help: 'Total number of subscription operations',
    labelNames: ['operation'],
  }),
  makeHistogramProvider({
    name: 'subscription_api_latency_seconds',
    help: 'Subscription API call latency in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),

  // Notification Service Metrics
  makeCounterProvider({
    name: 'notification_cache_hits_total',
    help: 'Total number of notification cache hits',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'notification_cache_misses_total',
    help: 'Total number of notification cache misses',
    labelNames: ['operation'],
  }),
  makeCounterProvider({
    name: 'notification_operations_total',
    help: 'Total number of notification operations',
    labelNames: ['operation'],
  }),
  makeHistogramProvider({
    name: 'notification_api_latency_seconds',
    help: 'Notification API call latency in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),

  // Subscription Matcher Metrics
  makeCounterProvider({
    name: 'subscription_match_total',
    help: 'Total number of subscription matches',
    labelNames: ['eventType', 'teamId'],
  }),
  makeHistogramProvider({
    name: 'subscription_match_latency_seconds',
    help: 'Subscription matching latency in seconds',
    labelNames: ['eventType'],
    buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
  }),
  makeCounterProvider({
    name: 'notification_generation_total',
    help: 'Total number of notifications generated from events',
    labelNames: ['eventType'],
  }),

  // WebSocket Gateway Metrics
  makeCounterProvider({
    name: 'websocket_connections_total',
    help: 'Total number of WebSocket connections',
    labelNames: ['status'], // connected, disconnected
  }),
  makeGaugeProvider({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
  }),
  makeCounterProvider({
    name: 'websocket_notifications_sent_total',
    help: 'Total number of notifications sent via WebSocket',
    labelNames: ['userId'],
  }),

  // Recommendation Service Metrics
  makeCounterProvider({
    name: 'recommendation_cache_hits_total',
    help: 'Total number of recommendation cache hits',
    labelNames: ['cache_type'], // collaborative, recommendations, matrix
  }),
  makeCounterProvider({
    name: 'recommendation_cache_misses_total',
    help: 'Total number of recommendation cache misses',
    labelNames: ['cache_type'],
  }),
  makeCounterProvider({
    name: 'recommendation_cache_invalidations_total',
    help: 'Total number of cache invalidation operations',
    labelNames: ['event_type'], // user-behavior.created, recommendation.accepted, etc.
  }),
  makeHistogramProvider({
    name: 'recommendation_generation_latency_seconds',
    help: 'Recommendation generation latency in seconds',
    labelNames: ['strategy'], // collaborative, graph-based, hybrid
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  }),
  makeCounterProvider({
    name: 'recommendation_operations_total',
    help: 'Total number of recommendation operations',
    labelNames: ['operation', 'status'], // generate/accept/reject, success/error
  }),
  makeHistogramProvider({
    name: 'recommendation_python_agent_latency_seconds',
    help: 'Python Agent collaborative filtering latency in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  }),

  // User Behavior Service Metrics
  makeCounterProvider({
    name: 'user_behavior_cache_hits_total',
    help: 'Total number of user behavior cache hits',
    labelNames: ['cache_type'], // matrix, high-weight
  }),
  makeCounterProvider({
    name: 'user_behavior_cache_misses_total',
    help: 'Total number of user behavior cache misses',
    labelNames: ['cache_type'],
  }),
  makeCounterProvider({
    name: 'user_behavior_tracked_total',
    help: 'Total number of user behaviors tracked',
    labelNames: ['behavior_type'], // VIEW, LIKE, SHARE, etc.
  }),
  makeHistogramProvider({
    name: 'user_behavior_matrix_build_latency_seconds',
    help: 'User-item matrix build latency in seconds',
    labelNames: ['time_window'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  }),
  makeCounterProvider({
    name: 'user_behavior_operations_total',
    help: 'Total number of user behavior operations',
    labelNames: ['operation', 'status'], // track/batch/query, success/error
  }),

  // Routing Engine Metrics
  makeCounterProvider({
    name: 'routing_decisions_total',
    help: 'Total number of routing decisions made',
    labelNames: ['model', 'vendor', 'strategy', 'status'], // strategy: smart/fallback/manual
  }),
  makeCounterProvider({
    name: 'routing_fallback_total',
    help: 'Total number of routing fallback events',
    labelNames: ['model', 'from_vendor', 'to_vendor', 'reason'],
  }),
  makeHistogramProvider({
    name: 'routing_decision_latency_seconds',
    help: 'Routing decision latency in seconds',
    labelNames: ['model', 'strategy'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  }),
  makeCounterProvider({
    name: 'routing_score_calculations_total',
    help: 'Total number of routing score calculations',
    labelNames: ['model', 'vendor', 'score_type'], // score_type: health/cost/speed/custom
  }),
  makeGaugeProvider({
    name: 'routing_vendor_health_score',
    help: 'Current vendor health score (0-100)',
    labelNames: ['vendor', 'model'],
  }),

  // Cost Tracking Metrics
  makeCounterProvider({
    name: 'gateway_cost_total',
    help: 'Total cost tracked in USD',
    labelNames: ['model', 'vendor', 'cost_type'], // cost_type: input/output/cache_read/cache_write/thinking
  }),
  makeCounterProvider({
    name: 'gateway_revenue_total',
    help: 'Total revenue tracked in USD',
    labelNames: ['model', 'vendor', 'billing_unit'], // billing_unit: tokens/per_call/per_minute/per_character/per_second/per_image/per_megapixel/flat_rate
  }),
  makeGaugeProvider({
    name: 'gateway_profit_margin',
    help: 'Current profit margin percentage',
    labelNames: ['model', 'vendor'],
  }),
  makeCounterProvider({
    name: 'gateway_budget_spending_total',
    help: 'Total budget spending tracked',
    labelNames: ['team_id', 'budget_type', 'period'], // budget_type: requests/tokens/cost, period: daily/weekly/monthly
  }),
  makeCounterProvider({
    name: 'gateway_budget_alert_total',
    help: 'Total budget alert events',
    labelNames: ['team_id', 'budget_id', 'threshold'], // threshold: 80/90/100
  }),

  // Provider Health Metrics
  makeGaugeProvider({
    name: 'provider_key_health_status',
    help: 'Provider key health status (1=healthy, 0=unhealthy)',
    labelNames: ['vendor', 'key_id'],
  }),
  makeCounterProvider({
    name: 'provider_key_errors_total',
    help: 'Total provider key errors',
    labelNames: ['vendor', 'error_type'], // error_type: auth/rate_limit/timeout/other
  }),
  makeGaugeProvider({
    name: 'provider_available_models',
    help: 'Number of available models per provider',
    labelNames: ['vendor'],
  }),

  // Model Request Success Rate Metrics
  makeCounterProvider({
    name: 'model_requests_success_total',
    help: 'Total successful model requests',
    labelNames: ['model', 'vendor', 'protocol'],
  }),
  makeCounterProvider({
    name: 'model_requests_failure_total',
    help: 'Total failed model requests',
    labelNames: ['model', 'vendor', 'error_code'],
  }),
  makeGaugeProvider({
    name: 'model_success_rate',
    help: 'Current model request success rate (0-1)',
    labelNames: ['model', 'vendor'],
  }),

  // Billing & Pricing Metrics
  makeCounterProvider({
    name: 'tiered_pricing_calculations_total',
    help: 'Total tiered pricing calculations',
    labelNames: ['model', 'period', 'status'], // period: per_request/daily/monthly/tier_by_monthly
  }),
  makeCounterProvider({
    name: 'pricing_sync_total',
    help: 'Total pricing sync operations',
    labelNames: ['vendor', 'status'], // status: success/error
  }),
  makeGaugeProvider({
    name: 'active_tiered_pricing_rules',
    help: 'Number of active tiered pricing rules',
    labelNames: ['model'],
  }),
];

@Global()
@Module({
  imports: [
    NestPrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      path: '/metrics',
    }),
  ],
  providers: metricsProviders,
  exports: [NestPrometheusModule, ...metricsProviders],
})
export class PrometheusConfigModule {}
