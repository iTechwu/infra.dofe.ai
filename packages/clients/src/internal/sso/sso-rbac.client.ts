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

  // ============================================================================
  // Permissions
  // ============================================================================

  async listPermissions(): Promise<SsoPermission[]> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<SsoPermission[]>>(
        `${this.basePath()}/permissions`,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoPermission[]>(response, "sso.rbac.listPermissions");
  }

  // ============================================================================
  // Custom Roles
  // ============================================================================

  async listRoles(tenantId: string): Promise<SsoCustomRole[]> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<SsoCustomRole[]>>(
        `${this.basePath()}/roles`,
        { headers: this.getHeaders(), params: { tenantId }, timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<SsoCustomRole[]>(response, "sso.rbac.listRoles");
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
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<SsoMemberRoleAssignment[]>>(
        `${this.basePath()}/member-role-assignments`,
        {
          headers: this.getHeaders(),
          params: { tenantId, ...(userId ? { userId } : {}) },
          timeout: 5000,
        },
      ),
    );
    return unwrapSsoResponse<SsoMemberRoleAssignment[]>(
      response,
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

  // ============================================================================
  // Approval Workflow
  // ============================================================================

  async listApprovals(query?: {
    status?: string;
    type?: string;
    tenantId?: string;
  }): Promise<any[]> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<any[]>>(
        `${this.basePath()}/approvals`,
        { headers: this.getHeaders(), params: query, timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<any[]>(response, "sso.rbac.listApprovals");
  }

  async createApproval(params: {
    tenantId: string;
    requesterId: string;
    type: string;
    title: string;
    description?: string;
    payload?: Record<string, unknown>;
  }): Promise<any> {
    const response = await firstValueFrom(
      this.httpService.post<SsoApiResponse<any>>(
        `${this.basePath()}/approvals`,
        params,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<any>(response, "sso.rbac.createApproval");
  }

  async getApproval(id: string): Promise<any> {
    const response = await firstValueFrom(
      this.httpService.get<SsoApiResponse<any>>(
        `${this.basePath()}/approvals/${id}`,
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<any>(response, "sso.rbac.getApproval");
  }

  async resolveApproval(params: {
    id: string;
    approverId: string;
    approved: boolean;
    comment?: string;
  }): Promise<any> {
    const response = await firstValueFrom(
      this.httpService.put<SsoApiResponse<any>>(
        `${this.basePath()}/approvals/${params.id}/resolve`,
        {
          approverId: params.approverId,
          approved: params.approved,
          comment: params.comment,
        },
        { headers: this.getHeaders(), timeout: 5000 },
      ),
    );
    return unwrapSsoResponse<any>(response, "sso.rbac.resolveApproval");
  }
}
