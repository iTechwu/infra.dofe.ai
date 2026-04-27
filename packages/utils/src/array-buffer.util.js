"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    toString(arr) {
        if (typeof arr === 'string') {
            return arr;
        }
        return new TextDecoder().decode(arr);
    },
};
//# sourceMappingURL=array-buffer.util.js.map