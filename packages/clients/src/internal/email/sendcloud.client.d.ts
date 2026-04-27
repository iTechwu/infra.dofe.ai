/**
 * SendCloud Email Client
 *
 * 职责：仅负责与 SendCloud API 通信
 * - 不访问数据库
 * - 不包含业务逻辑
 */
import { Logger } from 'winston';
import { HttpService } from '@nestjs/axios';
import { SendCloudConfig } from "../../../../common/src/config/validation";
interface SendOptions {
    [key: string]: any;
}
interface EmailListOptions {
    start?: number;
    limit?: number;
}
interface CreateEmailListOptions {
    address: string;
    name: string;
    description?: string;
}
interface UpdateEmailListOptions {
    toAddress?: string;
    name?: string;
    description?: string;
    address?: string;
}
interface UpdateListMemberOptions {
    name?: string;
    vars?: Record<string, any>;
}
export declare class SendCloudClient {
    private readonly config;
    private readonly httpService;
    private readonly logger;
    private transporter;
    private from;
    private fromName;
    constructor(config: SendCloudConfig, httpService: HttpService, logger: Logger);
    /**
     * 通用 POST 请求方法
     */
    private postData;
    /**
     * HTTP请求的方式发送Email
     * @param to 收件人地址. 多个地址使用';'分隔
     * @param subject 标题. 不能为空
     * @param html 邮件的内容
     * @param options 可选的参数
     */
    send(to: string, subject: string, html: string, options?: SendOptions): Promise<any>;
    /**
     * 使用 smtp 的方式发送邮件
     */
    sendEmailSmtp(to: string, subject: string, data: string): Promise<any>;
    /**
     * 使用触发账号，发送邮件给某一个用户
     */
    sendTemplateToOne(to: string, subject: string, templateName: string, sub: any, options?: SendOptions): Promise<any>;
    /**
     * 根据模板发送邮件
     */
    sendByTemplate(to: string[], subject: string, templateName: string, sub?: Record<string, any>, options?: SendOptions): Promise<any>;
    /**
     * 利用邮件模板给maillist中的用户发送邮件
     */
    sendByMailList(to: string, subject: string, templateName: string, options?: SendOptions): Promise<any>;
    /**
     * 获取邮件列表
     */
    getEmailList(options?: EmailListOptions): Promise<any>;
    /**
     * 创建邮件列表
     */
    createEmailList(options: CreateEmailListOptions): Promise<any>;
    /**
     * 更新邮件列表
     */
    updateEmailList(address: string, options?: UpdateEmailListOptions): Promise<any>;
    /**
     * 获取邮件列表成员
     */
    getListMember(mailListAddr: string, options?: EmailListOptions): Promise<any>;
    /**
     * 添加邮件列表成员
     */
    addListMember(mailListAddr: string, memberAddr: string, name: string, options?: UpdateListMemberOptions): Promise<any>;
    /**
     * 更新邮件列表成员
     */
    updateListMember(mailListAddr: string, memberAddr: string, name: string, options?: UpdateListMemberOptions): Promise<any>;
    /**
     * 删除邮件列表成员
     */
    deleteListMember(mailListAddr: string, memberAddr: string[]): Promise<any>;
    /**
     * 复制成员到另一个列表
     */
    addToOtherList(sourceList: string, targetList: string): Promise<any[]>;
}
export {};
