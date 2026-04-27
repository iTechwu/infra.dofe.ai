"use strict";
/**
 * Rate Limit Module Exports
 *
 * 统一导出限流模块的所有组件
 *
 * @example
 * ```typescript
 * import {
 *     RateLimit,
 *     RateLimitPresets,
 *     SkipRateLimit,
 *     RateLimitService,
 *     RateLimitException,
 *     RateLimitModule,
 * } from '@/decorators/rate-limit';
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitModule = exports.RateLimitException = exports.RateLimitService = exports.SKIP_RATE_LIMIT_KEY = exports.RATE_LIMIT_KEY = exports.RateLimitStrict = exports.RateLimitSensitive = exports.RateLimitLow = exports.RateLimitStandard = exports.RateLimitHigh = exports.RateLimitPresets = exports.SkipRateLimit = exports.RateLimit = void 0;
// Decorators
var rate_limit_decorator_1 = require("./rate-limit.decorator");
Object.defineProperty(exports, "RateLimit", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimit; } });
Object.defineProperty(exports, "SkipRateLimit", { enumerable: true, get: function () { return rate_limit_decorator_1.SkipRateLimit; } });
Object.defineProperty(exports, "RateLimitPresets", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitPresets; } });
Object.defineProperty(exports, "RateLimitHigh", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitHigh; } });
Object.defineProperty(exports, "RateLimitStandard", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitStandard; } });
Object.defineProperty(exports, "RateLimitLow", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitLow; } });
Object.defineProperty(exports, "RateLimitSensitive", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitSensitive; } });
Object.defineProperty(exports, "RateLimitStrict", { enumerable: true, get: function () { return rate_limit_decorator_1.RateLimitStrict; } });
Object.defineProperty(exports, "RATE_LIMIT_KEY", { enumerable: true, get: function () { return rate_limit_decorator_1.RATE_LIMIT_KEY; } });
Object.defineProperty(exports, "SKIP_RATE_LIMIT_KEY", { enumerable: true, get: function () { return rate_limit_decorator_1.SKIP_RATE_LIMIT_KEY; } });
// Service
var rate_limit_service_1 = require("./rate-limit.service");
Object.defineProperty(exports, "RateLimitService", { enumerable: true, get: function () { return rate_limit_service_1.RateLimitService; } });
// Exception
var rate_limit_exception_1 = require("./rate-limit.exception");
Object.defineProperty(exports, "RateLimitException", { enumerable: true, get: function () { return rate_limit_exception_1.RateLimitException; } });
// Module
var rate_limit_module_1 = require("./rate-limit.module");
Object.defineProperty(exports, "RateLimitModule", { enumerable: true, get: function () { return rate_limit_module_1.RateLimitModule; } });
//# sourceMappingURL=index.js.map