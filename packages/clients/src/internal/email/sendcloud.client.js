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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendCloudClient = void 0;
const rxjs_1 = require("rxjs");
const nodemailer = __importStar(require("nodemailer"));
const nodemailer_sendcloud_transport_1 = __importDefault(require("nodemailer-sendcloud-transport"));
const _ = __importStar(require("lodash"));
// SendCloud API endpoints
const SENDCLOUD_API = {
    send: 'https://api.sendcloud.net/apiv2/mail/send',
    send_template: 'https://api.sendcloud.net/apiv2/mail/sendtemplate',
    list_get: 'https://api.sendcloud.net/apiv2/addresslist/list',
    list_create: 'https://api.sendcloud.net/apiv2/addresslist/add',
    list_update: 'https://api.sendcloud.net/apiv2/addresslist/update',
    list_delete: 'https://api.sendcloud.net/apiv2/addresslist/delete',
    member_get: 'https://api.sendcloud.net/apiv2/addressmember/get',
    member_add: 'https://api.sendcloud.net/apiv2/addressmember/add',
    member_update: 'https://api.sendcloud.net/apiv2/addressmember/update',
    member_delete: 'https://api.sendcloud.net/apiv2/addressmember/delete',
};
class SendCloudClient {
    config;
    httpService;
    logger;
    transporter;
    from;
    fromName;
    constructor(config, httpService, logger) {
        this.config = config;
        this.httpService = httpService;
        this.logger = logger;
        this.from = 'no-reply@' + config.domain;
        this.fromName = config.name;
        this.transporter = nodemailer.createTransport((0, nodemailer_sendcloud_transport_1.default)({
            auth: {
                apiUser: config.apiUser,
                apiKey: config.apiKey,
            },
        }));
    }
    /**
     * 通用 POST 请求方法
     */
    async postData(url, data) {
        data.apiKey = this.config.apiKey;
        data.apiUser = this.config.apiUser;
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, data));
            return response.data;
        }
        catch (error) {
            this.logger.error(`SendCloud API error: ${url}`, {
                error: error.message,
            });
            throw error;
        }
    }
    // ==================== Email Sending ====================
    /**
     * HTTP请求的方式发送Email
     * @param to 收件人地址. 多个地址使用';'分隔
     * @param subject 标题. 不能为空
     * @param html 邮件的内容
     * @param options 可选的参数
     */
    async send(to, subject, html, options) {
        if (!to || !subject || !html) {
            throw new Error('The params is missed!');
        }
        const data = {
            apiUser: this.config.apiUser,
            apiKey: this.config.apiKey,
            from: this.from,
            fromName: this.fromName,
            to: to,
            subject: subject,
            html: html,
        };
        const finalData = _.assign({}, data, _.cloneDeep(options));
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(SENDCLOUD_API.send, finalData));
            return response.data;
        }
        catch (err) {
            throw new Error('邮件发送失败: ' + err.message);
        }
    }
    /**
     * 使用 smtp 的方式发送邮件
     */
    async sendEmailSmtp(to, subject, data) {
        try {
            const mail = {
                from: this.from,
                fromName: this.fromName,
                to: to || [],
                subject: subject,
                html: data,
            };
            const info = await new Promise((resolve, reject) => {
                this.transporter.sendMail(mail, (err, info) => {
                    if (err) {
                        reject(new Error('邮件发送失败: ' + err.message));
                    }
                    else {
                        resolve(info);
                    }
                });
            });
            return info;
        }
        catch (error) {
            throw new Error('邮件发送过程中发生错误: ' + error.message);
        }
    }
    /**
     * 使用触发账号，发送邮件给某一个用户
     */
    async sendTemplateToOne(to, subject, templateName, sub, options) {
        try {
            const data = {
                apiUser: this.config.apiUser,
                apiKey: this.config.apiKey,
                from: this.from,
                fromName: this.fromName,
                templateInvokeName: templateName,
                subject: subject,
                xsmtpapi: JSON.stringify({
                    to: [to],
                    sub: sub || {},
                }),
            };
            if (options) {
                _.merge(data, options);
            }
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(SENDCLOUD_API.send_template, data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }));
            this.logger.info(`SendCloud email sent to ${to}`, {
                template: templateName,
                statusCode: response.data?.statusCode,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error(`SendCloud email failed to ${to}`, {
                template: templateName,
                error: error.message,
            });
            throw new Error('发送模板邮件失败: ' + error.message);
        }
    }
    /**
     * 根据模板发送邮件
     */
    async sendByTemplate(to, subject, templateName, sub = {}, options = {}) {
        const data = {
            apiUser: this.config.apiUser,
            apiKey: this.config.apiKey,
            from: this.from,
            fromName: this.fromName,
            templateInvokeName: templateName,
            subject: subject,
            xsmtpapi: JSON.stringify({
                to: to,
                sub: sub,
            }),
            ...options,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(SENDCLOUD_API.send_template, data));
            return response.data;
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * 利用邮件模板给maillist中的用户发送邮件
     */
    async sendByMailList(to, subject, templateName, options = {}) {
        const data = {
            apiUser: this.config.apiUser,
            apiKey: this.config.apiKey,
            from: this.from,
            fromName: this.fromName,
            templateInvokeName: templateName,
            subject: subject,
            useAddressList: 'true',
            to: to,
            ...options,
        };
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(SENDCLOUD_API.send_template, data));
            return response.data;
        }
        catch (err) {
            throw err;
        }
    }
    // ==================== Email List Management ====================
    /**
     * 获取邮件列表
     */
    async getEmailList(options = {}) {
        return this.postData(SENDCLOUD_API.list_get, options);
    }
    /**
     * 创建邮件列表
     */
    async createEmailList(options) {
        return this.postData(SENDCLOUD_API.list_create, options);
    }
    /**
     * 更新邮件列表
     */
    async updateEmailList(address, options = {}) {
        const data = { ...options, address };
        return this.postData(SENDCLOUD_API.list_update, data);
    }
    // ==================== List Member Management ====================
    /**
     * 获取邮件列表成员
     */
    async getListMember(mailListAddr, options = {}) {
        const data = { ...options, mail_list_addr: mailListAddr };
        return this.postData(SENDCLOUD_API.member_get, data);
    }
    /**
     * 添加邮件列表成员
     */
    async addListMember(mailListAddr, memberAddr, name, options = {}) {
        const data = {
            mail_list_addr: mailListAddr,
            member_addr: memberAddr,
            name: name,
            ...options,
        };
        if (data.vars) {
            data.vars = JSON.stringify(data.vars);
        }
        return this.postData(SENDCLOUD_API.member_add, data);
    }
    /**
     * 更新邮件列表成员
     */
    async updateListMember(mailListAddr, memberAddr, name, options = {}) {
        const data = {
            mail_list_addr: mailListAddr,
            member_addr: memberAddr,
            name: name,
            ...options,
        };
        if (data.vars) {
            data.vars = JSON.stringify(data.vars);
        }
        return this.postData(SENDCLOUD_API.member_update, data);
    }
    /**
     * 删除邮件列表成员
     */
    async deleteListMember(mailListAddr, memberAddr) {
        return this.postData(SENDCLOUD_API.member_delete, {
            mail_list_addr: mailListAddr,
            member_addr: memberAddr.join(';'),
        });
    }
    /**
     * 复制成员到另一个列表
     */
    async addToOtherList(sourceList, targetList) {
        const limitOptions = {
            start: 0,
            limit: 1000,
        };
        try {
            const data = await this.getListMember(sourceList, limitOptions);
            const wantList = data.members;
            const promises = wantList.map((member) => {
                const _name = member.vars['%name%'];
                const options = {
                    vars: {
                        domain: member.vars['%domain%'],
                        avatar: member.vars['%avatar%'],
                    },
                };
                return this.addListMember(targetList, member.address, _name, options);
            });
            return Promise.all(promises);
        }
        catch (err) {
            this.logger.error('addToOtherList failed', { error: err.message });
            throw err;
        }
    }
}
exports.SendCloudClient = SendCloudClient;
//# sourceMappingURL=sendcloud.client.js.map