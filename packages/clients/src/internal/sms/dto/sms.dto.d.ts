import { z } from 'zod';
export declare const SmsDefaultTemplateSchema: any;
export declare const SmsZxjcTemplateSchema: any;
export declare const SmsHttpTemplateSchema: any;
export declare const SmsVolcengineTemplateSchema: any;
export declare const SmsProviderConfigSchema: any;
export declare const AppSmsConfigSchema: any;
export type AppSmsConfig = z.infer<typeof AppSmsConfigSchema>;
export type SmsProviderConfig = z.infer<typeof SmsProviderConfigSchema>;
export type SmsDefaultTemplate = z.infer<typeof SmsDefaultTemplateSchema>;
export type SmsZxjcTemplate = z.infer<typeof SmsZxjcTemplateSchema>;
export type SmsHttpTemplate = z.infer<typeof SmsHttpTemplateSchema>;
export type SmsVolcengineTemplate = z.infer<typeof SmsVolcengineTemplateSchema>;
export declare enum VerifyCodeResult {
    SUCCESS = "0",
    INVALID_CODE = "1",
    EXPIRED = "2",
    USED = "3",
    NOT_FOUND = "4",
    EXCEEDED = "5"
}
export interface VerifyCodeResponse {
    success: boolean;
    result: VerifyCodeResult;
    message: string;
    data?: any;
}
