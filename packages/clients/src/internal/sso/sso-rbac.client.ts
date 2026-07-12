import { Injectable, OnModuleInit } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import {
  unwrapSsoResponse,
  type SsoApiResponse,
} from "./sso-response.util";

export interface SsoPermission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface SsoCustomRole {
  id: string;
  name: string;
  description: string | null;
  tenantId: string | null;
  isSystem: boolean;
  permissions: SsoPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface SsoMemberRoleAssignment {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  role: SsoCustomRole;
  assignedBy: string;
  assignedAt: string;
}

export interface SsoUserPermissions {
  userId: string;
  tenantId: string;
  permissions: SsoPermission[];
}

/**
 * SSO 列表端点的分页信封（对应 sso-contracts PaginatedResponseSchema）。
 *
 * 注意：`listRoles`/`listPermissions`/`listMemberAssignments` 命名为 `list*`，
 * 但 SSO 返回的是这个分页信封而非裸数组；client 对外仍以 `Promise<T[]>`
 * 暴露（自动摊平分页），此类型仅用于内部解包。
 */
export interface SsoPaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * SSO RBAC 客户端
 *
 * 通过 SSO Internal API 操作权限、自定义角色、成员角色分配和审批工作流。
 * 与 SsoAuthClient 使用相同的认证头 (Bearer + X-Service-Name)。
 *
 * 所有响应经 unwrapSsoResponse 解包：SSO 抖动或返回非标准信封时抛出
 * SsoInternalApiError，而非把 undefined 透传给调用方。
 */
@Injectable()
export class SsoRbacClient implements OnModuleInit {
  private ssoInternalUrl!: string;
  private serviceToken!: string;
  private serviceName!: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.ssoInternalUrl =
      this.configService.get<string>("SSO_INTERNAL_API_URL") ?? "";
    this.serviceToken =
      this.configService.get<string>("INTERNAL_API_SECRET") ?? "";
    this.serviceName = this.configService.get<string>("SSO_SERVICE_NAME") ?? "";

    if (!this.ssoInternalUrl) {
      throw new Error(
        "SSO_INTERNAL_API_URL is required but not configured.",
      );
    }
    if (!this.serviceToken) {
      throw new Error(
        "INTERNAL_API_SECRET is required but not configured.",
      );
    }
    if (!this.serviceName) {
      throw new Error(
        "SSO_SERVICE_NAME is required but not configured.",
      );
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceToken}`,
      "X-Service-Name": this.serviceName,
      "Content-Type": "application/json",
    };
  }

  private basePath(versioned = false): string {
    return `${this.ssoInternalUrl}/internal${versioned ? "/v1" : ""}`;
  }

  /**
   * 分页拉取 SSO 列表端点的全部条目并摊平为 `T[]`。
   *
   * SSO 的 `list*` 端点返回分页信封 `{ list, total, page, limit }`
   * （PaginatedResponseSchema），默认 `limit=20`。直接透传 `data` 会让下游
   * 对对象执行 `.map()` → `TypeError: (intermediate value).map is not a function`
   * （见 models 侧 `/rbac/permissions`、`/rbac/roles` 500）。这里：
   *   1) 解包分页信封取 `list`，让 client 对外真正返回 `T[]`（与签名一致）；
   *   2) 按 `limit=100` 循环至 `total`，避免默认 20 条静默截断；
   *   3) 兼容历史裸数组返回（`Array.isArray(data)` 时直接返回）；
   *   4) 带 100 页（≈1e4 条）安全上限，防 `total` 异常导致死循环。
   */
  private async listAllPaginated<T>(
    url: string,
    params: Record<string, string | number | undefined>,
    operation: string,
  ): Promise<T[]> {
    const limit = 100;
    const items: T[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    for (let i = 0; i < 100 && items.length < total; i++) {
      const response = await firstValueFrom(
        this.httpService.get<SsoApiResponse<SsoPaginatedResponse<T> | T[]>>(
          url,
          {
            headers: this.getHeaders(),
            params: { ...params, page, limit },
            timeout: 5000,
          },
        ),
      );
      const data = unwrapSsoResponse<SsoPaginatedResponse<T> | T[]>(
        response,
        operation,
      );

      // 兼容历史裸数组返回
      if (Array.isArray(data)) return data;

      const batch = data?.list ?? [];
      if (typeof data?.total === "number") total = data.total;
      if (batch.length === 0) break;
      items.push(...batch);
      if (batch.length < limit) break; // 末页
      page += 1;
    }

    return items;
  }

  // ============================================================================
  // Permissions
  // ============================================================================

  async listPermissions(): Promise<SsoPermission[]> {
    return this.listAllPaginated<SsoPermission>(
      `${this.basePath()}/permissions`,
      {},
      "sso.rbac.listPermissions",
    );
  }

  // ============================================================================
  // Custom Roles
  // ============================================================================

  async listRoles(tenantId: string): Promise<SsoCustomRole[]> {
    return this.listAllPaginated<SsoCustomRole>(
      `${this.basePath()}/roles`,
      { tenantId },
      "sso.rbac.listRoles",
    );
  }

  async createRole(params: {
    tenantId: string;
    name: string;
    description?: string;
    permissionIds: string[];
  }): Promise<SsoCustomRole> {
    const response = await firstValueFrom(
      this.httpService.post<SsoApiResponse<SsoCustomRole>>(
        `${this.basePath()}/roles`,
        params,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoCustomRole>(response, "sso.rbac.createRole");
  }

  async getRole(id: string): Promise<SsoCustomRole> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<SsoCustomRole>>(
        `${this.basePath()}/roles/${id}`,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoCustomRole>(response, "sso.rbac.getRole");
  }

  async updateRole(
    id: string,
    params: { name?: string; description?: string; permissionIds?: string[] },
  ): Promise<SsoCustomRole> {
    const response = await firstValueFrom(
      this.httpService.put<SsoApiResponse<SsoCustomRole>>(
        `${this.basePath()}/roles/${id}`,
        params,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoCustomRole>(response, "sso.rbac.updateRole");
  }

  async deleteRole(id: string): Promise<{ success: boolean }> {
    const response = await firstValueFrom(
      this.httpService.delete<SsoApiResponse<{ success: boolean }>>(
        `${this.basePath()}/roles/${id}`,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<{ success: boolean }>(response, "sso.rbac.deleteRole");
  }

  // ============================================================================
  // Member Role Assignments
  // ============================================================================

  async listMemberAssignments(
    tenantId: string,
    userId?: string,
  ): Promise<SsoMemberRoleAssignment[]> {
    return this.listAllPaginated<SsoMemberRoleAssignment>(
      `${this.basePath()}/member-role-assignments`,
      { tenantId, userId },
      "sso.rbac.listMemberAssignments",
    );
  }

  async assignRole(params: {
    tenantId: string;
    userId: string;
    roleId: string;
    assignedBy: string;
  }): Promise<SsoMemberRoleAssignment> {
    const response = await firstValueFrom(
      this.httpService.post<SsoApiResponse<SsoMemberRoleAssignment>>(
        `${this.basePath()}/member-role-assignments`,
        params,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoMemberRoleAssignment>(response, "sso.rbac.assignRole");
  }

  async removeRole(assignmentId: string): Promise<{ success: boolean }> {
    const response = await firstValueFrom(
      this.httpService.delete<SsoApiResponse<{ success: boolean }>>(
        `${this.basePath()}/member-role-assignments/${assignmentId}`,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<{ success: boolean }>(response, "sso.rbac.removeRole");
  }

  // ============================================================================
  // User Effective Permissions
  // ============================================================================

  async getUserEffectivePermissions(
    userId: string,
    tenantId: string,
  ): Promise<SsoUserPermissions> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<SsoUserPermissions>>(
        `${this.basePath()}/users/${userId}/permissions`,
        {
          headers: this.getHeaders(),
          params: { tenantId },
          timeout: 5000,
        },
      ),
    );
    return unwrapSsoResponse<SsoUserPermissions>(
      response,
      "sso.rbac.getUserEffectivePermissions",
    );
  }
}
