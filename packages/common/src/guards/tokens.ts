import { Inject } from '@nestjs/common';

/**
 * DI tokens for scaffold-side services.
 * The consuming app must register providers for these tokens.
 */

// --- OperateLogService (was @app/db) ---

export const OPERATE_LOG_SERVICE_TOKEN = 'OPERATE_LOG_SERVICE';

export interface IOperateLogService {
  create(data: any): Promise<any>;
}

// --- OrganizationPermissionService (was @app/tenant-management/organization-permission) ---

export const ORGANIZATION_PERMISSION_SERVICE_TOKEN =
  'ORGANIZATION_PERMISSION_SERVICE';

export interface IOrganizationPermissionService {
  resolveDataScope(params: {
    userId: string;
    tenantId: string;
    resourceType: string;
    isSystemAdmin: boolean;
  }): Promise<any>;
  hasAllPermissions(params: {
    userId: string;
    tenantId: string;
    permissions: any[];
    isSystemAdmin: boolean;
  }): Promise<boolean>;
}

// --- TenantContextService (was @app/tenant-management/tenant-context) ---

export const TENANT_CONTEXT_SERVICE_TOKEN = 'TENANT_CONTEXT_SERVICE';

export interface ITenantContextService {
  resolveCurrentTenant(
    userId: string,
    headerTenantId?: string,
  ): Promise<string>;
  getTenantMember(userId: string, tenantId: string): Promise<any>;
}
