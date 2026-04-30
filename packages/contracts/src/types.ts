/**
 * Core types for @dofe/infra-contracts
 * Extracted from @repo/types and @repo/contracts — zero dependencies.
 */

// ============================================================================
// Data visibility types (from @repo/types/permission)
// ============================================================================

export type DataScopeType =
  | 'tenant'
  | 'department_tree'
  | 'department'
  | 'team'
  | 'user';

export interface DataScope {
  type: DataScopeType;
  tenantId: string;
  departmentIds?: string[];
  teamIds?: string[];
  userId?: string;
}

export type ResourceType =
  | 'bot'
  | 'gateway'
  | 'department'
  | 'team'
  | 'audit'
  | 'finance'
  | 'problem'
  | 'all';

// ============================================================================
// Pagination types (from @repo/contracts)
// ============================================================================

export interface PaginatedResponse<T = any> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ExtendedPaginatedResponse<T = any> {
  list: T[];
  total: number;
  page?: number;
  limit?: number;
  totalSize?: number;
  permission?: string[];
  role?: string;
  nowTime?: Date;
}

// ============================================================================
// Skill-related types (from @repo/contracts)
// ============================================================================

export interface SkillConfigRequirements {
  [key: string]: any;
}

export interface SkillEligibility {
  [key: string]: any;
}

export interface SkillFrontmatter {
  name: string;
  version?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  invocationMode?: SkillInvocationMode;
  [key: string]: any;
}

export type SkillInvocationMode = 'manual' | 'model' | 'both';

export interface ContainerSkillItem {
  name: string;
  enabled: boolean;
  description?: string | null;
  version?: string | null;
  content?: string | null;
  installSource?: any;
  isManualInstalled?: boolean;
  requiredEnv?: string[];
}

// ============================================================================
// SSE Event types (from @repo/contracts)
// ============================================================================

export interface MeetingSSEEvent {
  type: 'transcription' | 'summary';
  meetingId: string;
  status: 'processing' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp: number;
  taskId?: string;
  progress?: number;
  currentStep?: string;
}

// ============================================================================
// Provider verify types (from @repo/contracts)
// ============================================================================

export interface VerifyProviderKeyInput {
  vendor: string;
  apiKey: string;
  baseUrl?: string;
  apiType?: string;
  models?: string[];
  extraConfig?: Record<string, any>;
}

export interface ProviderModel {
  id: string;
  name?: string;
  created?: number;
  owned_by?: string;
}

export interface VerifyProviderKeyResponse {
  valid: boolean;
  latency?: number;
  models?: ProviderModel[];
  error?: string;
}
