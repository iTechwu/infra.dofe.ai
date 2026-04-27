"use strict";
/**
 * Cache Decorators Module Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheDecoratorModule = exports.CacheInterceptor = exports.CACHE_PUT_METADATA_KEY = exports.CACHE_EVICT_METADATA_KEY = exports.CACHE_METADATA_KEY = exports.hashParams = exports.hashObject = exports.spaceKeyGenerator = exports.userKeyGenerator = exports.simpleHierarchicalKeyGenerator = exports.hierarchicalKeyGenerator = exports.compositeKeyGenerator = exports.objectKeyGenerator = exports.defaultKeyGenerator = exports.CachePut = exports.CacheEvict = exports.Cacheable = void 0;
var cache_decorator_1 = require("./cache.decorator");
// Decorators
Object.defineProperty(exports, "Cacheable", { enumerable: true, get: function () { return cache_decorator_1.Cacheable; } });
Object.defineProperty(exports, "CacheEvict", { enumerable: true, get: function () { return cache_decorator_1.CacheEvict; } });
Object.defineProperty(exports, "CachePut", { enumerable: true, get: function () { return cache_decorator_1.CachePut; } });
// Key Generators - Basic
Object.defineProperty(exports, "defaultKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.defaultKeyGenerator; } });
Object.defineProperty(exports, "objectKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.objectKeyGenerator; } });
Object.defineProperty(exports, "compositeKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.compositeKeyGenerator; } });
// Key Generators - Hierarchical (支持分层缓存)
Object.defineProperty(exports, "hierarchicalKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.hierarchicalKeyGenerator; } });
Object.defineProperty(exports, "simpleHierarchicalKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.simpleHierarchicalKeyGenerator; } });
Object.defineProperty(exports, "userKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.userKeyGenerator; } });
Object.defineProperty(exports, "spaceKeyGenerator", { enumerable: true, get: function () { return cache_decorator_1.spaceKeyGenerator; } });
// Hash Utilities
Object.defineProperty(exports, "hashObject", { enumerable: true, get: function () { return cache_decorator_1.hashObject; } });
Object.defineProperty(exports, "hashParams", { enumerable: true, get: function () { return cache_decorator_1.hashParams; } });
// Metadata Keys
Object.defineProperty(exports, "CACHE_METADATA_KEY", { enumerable: true, get: function () { return cache_decorator_1.CACHE_METADATA_KEY; } });
Object.defineProperty(exports, "CACHE_EVICT_METADATA_KEY", { enumerable: true, get: function () { return cache_decorator_1.CACHE_EVICT_METADATA_KEY; } });
Object.defineProperty(exports, "CACHE_PUT_METADATA_KEY", { enumerable: true, get: function () { return cache_decorator_1.CACHE_PUT_METADATA_KEY; } });
var cache_interceptor_1 = require("./cache.interceptor");
Object.defineProperty(exports, "CacheInterceptor", { enumerable: true, get: function () { return cache_interceptor_1.CacheInterceptor; } });
var cache_module_1 = require("./cache.module");
Object.defineProperty(exports, "CacheDecoratorModule", { enumerable: true, get: function () { return cache_module_1.CacheDecoratorModule; } });
//# sourceMappingURL=index.js.map