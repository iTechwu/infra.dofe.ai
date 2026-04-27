import { z } from 'zod';
export declare const EmailKeysSchema: any;
export declare const EmailTemplateSchema: any;
export declare const EmailConfigSchema: any;
export declare const EmailSubValuesSchema: any;
export declare const SignalMessageSchema: any;
export declare const EmailAccountSchema: any;
export declare const EmailAccountInputSchema: any;
export type EmailKeys = z.infer<typeof EmailKeysSchema>;
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type EmailSubValues = z.infer<typeof EmailSubValuesSchema>;
export type SignalMessage = z.infer<typeof SignalMessageSchema>;
export type EmailAccount = z.infer<typeof EmailAccountSchema>;
export declare namespace DoFeEmailSender {
    type EmailKeys = z.infer<typeof EmailKeysSchema>;
    type Config = z.infer<typeof EmailConfigSchema>;
    type SignalMessage = z.infer<typeof SignalMessageSchema>;
    type RegisterEmailSub = z.infer<typeof EmailSubValuesSchema>;
    type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
}
