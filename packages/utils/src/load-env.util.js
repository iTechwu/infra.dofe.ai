"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const dotenvExpand = __importStar(require("dotenv-expand"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 获取项目根目录路径
 * 处理 Windows 环境下 $(pwd) 未展开的问题
 */
function getProjectRoot() {
    let projectRoot = process.env.PROJECT_ROOT;
    // 如果 PROJECT_ROOT 包含 $(pwd)，则替换为实际的工作目录
    if (projectRoot && projectRoot.includes('$(pwd)')) {
        projectRoot = projectRoot.replace('$(pwd)', process.cwd());
    }
    // 如果 PROJECT_ROOT 未设置或为空，使用当前工作目录
    if (!projectRoot) {
        projectRoot = process.cwd();
    }
    return projectRoot;
}
exports.default = {
    loadEnvFile(filePath) {
        try {
            // 使用 dotenv 的 config 方法加载环境变量
            // 注意：不需要 { silent: true }，因为默认就会静默处理找不到文件的情况
            const result = dotenv.config({ path: filePath, override: true });
            // console.log('loadEnvFile start WM', filePath, result)
            if (result.error) {
                // 如果有错误且文件确实存在，则抛出错误
                if (fs.existsSync(filePath)) {
                    throw result.error;
                }
            }
            else if (result.parsed) {
                // 使用 dotenv-expand 展开变量引用（如 ${VAR} 或 $VAR）
                dotenvExpand.expand(result);
            }
        }
        catch (err) {
            // 你可以选择在这里记录错误或进行其他处理
            console.error(`Failed to load ${filePath}`, err);
        }
    },
    loadEnv(envPaths) {
        const root = getProjectRoot();
        for (const file of envPaths) {
            this.loadEnvFile(path.resolve(root, file));
        }
    },
};
//# sourceMappingURL=load-env.util.js.map