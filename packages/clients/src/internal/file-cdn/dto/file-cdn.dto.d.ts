/**
 * @fileoverview File CDN 类型定义
 *
 * @module file-cdn/dto
 */
import { z } from 'zod';
export declare const QueryDataSchema: any;
export declare const CdnConfigSchema: any;
export declare const CdnConfigsSchema: any;
export declare const CdnUrlResponseSchema: any;
export declare const ImageTemplateIdSchema: any;
export declare const CloudFlareTemplateSchema: any;
export declare const CdnRegionSchema: any;
export declare const CdnUrlTypeSchema: any;
export declare const SignedUrlParamsSchema: any;
export declare const AwsSignatureV4ParamsSchema: any;
export type QueryData = z.infer<typeof QueryDataSchema>;
export type CdnConfig = z.infer<typeof CdnConfigSchema>;
export type CdnConfigs = z.infer<typeof CdnConfigsSchema>;
export type CdnUrlResponse = z.infer<typeof CdnUrlResponseSchema>;
export type ImageTemplateId = z.infer<typeof ImageTemplateIdSchema>;
export type CloudFlareTemplate = z.infer<typeof CloudFlareTemplateSchema>;
export type CdnRegion = z.infer<typeof CdnRegionSchema>;
export type CdnUrlType = z.infer<typeof CdnUrlTypeSchema>;
export type SignedUrlParams = z.infer<typeof SignedUrlParamsSchema>;
export type AwsSignatureV4Params = z.infer<typeof AwsSignatureV4ParamsSchema>;
export declare namespace DoFeFileCdn {
    type QueryData = z.infer<typeof QueryDataSchema>;
    type Config = z.infer<typeof CdnConfigSchema>;
    type Configs = z.infer<typeof CdnConfigsSchema>;
}
