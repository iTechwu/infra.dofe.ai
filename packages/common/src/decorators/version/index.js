"use strict";
/**
 * Version Decorators Module Exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionDecoratorModule = exports.VersionInterceptor = exports.compareVersions = exports.getVersionFromRequest = exports.isSupportedVersion = exports.SUPPORTED_VERSIONS = exports.VERSION_METADATA_KEY = exports.DEFAULT_API_VERSION = exports.API_VERSION_HEADER = exports.DeprecatedVersion = exports.VersionNeutral = exports.ApiVersion = void 0;
var version_decorator_1 = require("./version.decorator");
// Decorators
Object.defineProperty(exports, "ApiVersion", { enumerable: true, get: function () { return version_decorator_1.ApiVersion; } });
Object.defineProperty(exports, "VersionNeutral", { enumerable: true, get: function () { return version_decorator_1.VersionNeutral; } });
Object.defineProperty(exports, "DeprecatedVersion", { enumerable: true, get: function () { return version_decorator_1.DeprecatedVersion; } });
// Constants
Object.defineProperty(exports, "API_VERSION_HEADER", { enumerable: true, get: function () { return version_decorator_1.API_VERSION_HEADER; } });
Object.defineProperty(exports, "DEFAULT_API_VERSION", { enumerable: true, get: function () { return version_decorator_1.DEFAULT_API_VERSION; } });
Object.defineProperty(exports, "VERSION_METADATA_KEY", { enumerable: true, get: function () { return version_decorator_1.VERSION_METADATA_KEY; } });
Object.defineProperty(exports, "SUPPORTED_VERSIONS", { enumerable: true, get: function () { return version_decorator_1.SUPPORTED_VERSIONS; } });
// Utilities
Object.defineProperty(exports, "isSupportedVersion", { enumerable: true, get: function () { return version_decorator_1.isSupportedVersion; } });
Object.defineProperty(exports, "getVersionFromRequest", { enumerable: true, get: function () { return version_decorator_1.getVersionFromRequest; } });
Object.defineProperty(exports, "compareVersions", { enumerable: true, get: function () { return version_decorator_1.compareVersions; } });
var version_interceptor_1 = require("./version.interceptor");
Object.defineProperty(exports, "VersionInterceptor", { enumerable: true, get: function () { return version_interceptor_1.VersionInterceptor; } });
var version_module_1 = require("./version.module");
Object.defineProperty(exports, "VersionDecoratorModule", { enumerable: true, get: function () { return version_module_1.VersionDecoratorModule; } });
//# sourceMappingURL=index.js.map