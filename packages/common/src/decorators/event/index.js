"use strict";
/**
 * Event Decorators Module Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheEventHandler = exports.EventDecoratorModule = exports.EventInterceptor = exports.EMIT_EVENTS_METADATA_KEY = exports.EMIT_EVENT_METADATA_KEY = exports.cacheInvalidatePayloadGenerator = exports.userEventPayloadGenerator = exports.defaultPayloadGenerator = exports.EventNames = exports.EmitEvents = exports.EmitEvent = void 0;
var event_decorator_1 = require("./event.decorator");
// Decorators
Object.defineProperty(exports, "EmitEvent", { enumerable: true, get: function () { return event_decorator_1.EmitEvent; } });
Object.defineProperty(exports, "EmitEvents", { enumerable: true, get: function () { return event_decorator_1.EmitEvents; } });
// Event Names
Object.defineProperty(exports, "EventNames", { enumerable: true, get: function () { return event_decorator_1.EventNames; } });
// Payload Generators
Object.defineProperty(exports, "defaultPayloadGenerator", { enumerable: true, get: function () { return event_decorator_1.defaultPayloadGenerator; } });
Object.defineProperty(exports, "userEventPayloadGenerator", { enumerable: true, get: function () { return event_decorator_1.userEventPayloadGenerator; } });
Object.defineProperty(exports, "cacheInvalidatePayloadGenerator", { enumerable: true, get: function () { return event_decorator_1.cacheInvalidatePayloadGenerator; } });
// Metadata Keys
Object.defineProperty(exports, "EMIT_EVENT_METADATA_KEY", { enumerable: true, get: function () { return event_decorator_1.EMIT_EVENT_METADATA_KEY; } });
Object.defineProperty(exports, "EMIT_EVENTS_METADATA_KEY", { enumerable: true, get: function () { return event_decorator_1.EMIT_EVENTS_METADATA_KEY; } });
var event_interceptor_1 = require("./event.interceptor");
Object.defineProperty(exports, "EventInterceptor", { enumerable: true, get: function () { return event_interceptor_1.EventInterceptor; } });
var event_module_1 = require("./event.module");
Object.defineProperty(exports, "EventDecoratorModule", { enumerable: true, get: function () { return event_module_1.EventDecoratorModule; } });
var cache_event_handler_1 = require("./handlers/cache-event.handler");
Object.defineProperty(exports, "CacheEventHandler", { enumerable: true, get: function () { return cache_event_handler_1.CacheEventHandler; } });
//# sourceMappingURL=index.js.map