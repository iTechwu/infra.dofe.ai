"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassthroughAdapter = void 0;
/**
 * 默认 Adapter (透传)
 * 用于当前版本的 Contract，不需要任何转换
 *
 * @template T 模型类型
 */
class PassthroughAdapter {
    toResponse(internal) {
        return internal;
    }
    fromRequest(external) {
        return external;
    }
}
exports.PassthroughAdapter = PassthroughAdapter;
//# sourceMappingURL=base.adapter.js.map