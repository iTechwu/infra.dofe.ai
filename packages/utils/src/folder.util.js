"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    ensurePrefixEndsWithSlash(prefix) {
        if (!prefix.endsWith('/')) {
            prefix += '/';
        }
        return prefix;
    },
};
//# sourceMappingURL=folder.util.js.map