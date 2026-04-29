import { FastifyRequest } from 'fastify';

export const AUTH_SERVICE_TOKEN = 'AUTH_SERVICE';

export interface IAuthService {
  extractTokenFromHeader(request: FastifyRequest): string | undefined;
}

export const TENANT_CONTEXT_SERVICE_TOKEN = 'TENANT_CONTEXT_SERVICE';

export interface ITenantContextService {
  resolveCurrentTenant(userId: string, headerTenantId?: string): Promise<string | null>;
  getTenantMember(userId: string, tenantId: string): Promise<any | null>;
}

export const PERMISSION_SERVICE_TOKEN = 'PERMISSION_SERVICE';

export interface IPermissionService {
  hasAllPermissions(options: {
    userId: string;
    tenantId: string | null;
    permissions: string[];
    isSystemAdmin: boolean;
  }): Promise<boolean>;
  resolveDataScope(options: {
    userId: string;
    tenantId: string;
    resourceType: string;
    isSystemAdmin: boolean;
  }): Promise<any>;
}

export const PUBLIC_ENDPOINT_KEY = 'PUBLIC_ENDPOINT_KEY';

export const REQUIRE_PERMISSIONS_KEY = 'REQUIRE_PERMISSIONS_KEY';

export const TENANT_SCOPE_KEY = 'TENANT_SCOPE_KEY';

export const ALLOW_API_KEY_KEY = 'ALLOW_API_KEY_KEY';

export const DATA_VISIBILITY_KEY = 'DATA_VISIBILITY_KEY';

export const CURRENT_TENANT_HEADER = 'x-current-tenant';

export const DEFAULT_TENANT_ID = 'default';