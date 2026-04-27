"use strict";
/**
 * Feature Flag Module Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagModule = exports.FeatureFlagInterceptor = exports.FeatureFlagService = exports.FEATURE_FLAGS_METADATA_KEY = exports.FEATURE_FLAG_METADATA_KEY = exports.GradualRollout = exports.BetaFeature = exports.IfFeatureEnabled = exports.FeatureFlags = exports.FeatureEnabled = void 0;
var feature_flag_decorator_1 = require("./feature-flag.decorator");
// Decorators
Object.defineProperty(exports, "FeatureEnabled", { enumerable: true, get: function () { return feature_flag_decorator_1.FeatureEnabled; } });
Object.defineProperty(exports, "FeatureFlags", { enumerable: true, get: function () { return feature_flag_decorator_1.FeatureFlags; } });
Object.defineProperty(exports, "IfFeatureEnabled", { enumerable: true, get: function () { return feature_flag_decorator_1.IfFeatureEnabled; } });
Object.defineProperty(exports, "BetaFeature", { enumerable: true, get: function () { return feature_flag_decorator_1.BetaFeature; } });
Object.defineProperty(exports, "GradualRollout", { enumerable: true, get: function () { return feature_flag_decorator_1.GradualRollout; } });
// Constants
Object.defineProperty(exports, "FEATURE_FLAG_METADATA_KEY", { enumerable: true, get: function () { return feature_flag_decorator_1.FEATURE_FLAG_METADATA_KEY; } });
Object.defineProperty(exports, "FEATURE_FLAGS_METADATA_KEY", { enumerable: true, get: function () { return feature_flag_decorator_1.FEATURE_FLAGS_METADATA_KEY; } });
var feature_flag_service_1 = require("./feature-flag.service");
Object.defineProperty(exports, "FeatureFlagService", { enumerable: true, get: function () { return feature_flag_service_1.FeatureFlagService; } });
var feature_flag_interceptor_1 = require("./feature-flag.interceptor");
Object.defineProperty(exports, "FeatureFlagInterceptor", { enumerable: true, get: function () { return feature_flag_interceptor_1.FeatureFlagInterceptor; } });
var feature_flag_module_1 = require("./feature-flag.module");
Object.defineProperty(exports, "FeatureFlagModule", { enumerable: true, get: function () { return feature_flag_module_1.FeatureFlagModule; } });
//# sourceMappingURL=index.js.map