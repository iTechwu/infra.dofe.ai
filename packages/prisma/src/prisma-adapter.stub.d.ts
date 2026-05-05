// Stub declarations for optional peer dependencies.
// These packages are provided by consuming apps; the stubs allow
// the infra-prisma package to compile without them installed.

declare module 'pg' {
  export class Pool {
    constructor(config?: { connectionString?: string; connectionTimeoutMillis?: number; idleTimeoutMillis?: number; max?: number });
    end(): Promise<void>;
    readonly ended: boolean;
    on(event: string, callback: (...args: any[]) => void): this;
    query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  }
}

declare module '@prisma/adapter-pg' {
  import type { DriverAdapter } from '@prisma/client';
  import type { Pool } from 'pg';
  export class PrismaPg implements DriverAdapter {
    constructor(poolOrOptions: Pool | { connectionString: string });
    readonly provider: string;
    readonly adapterName: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  }
}

declare module 'class-validator' {
  export function IsNotEmpty(options?: Record<string, unknown>): PropertyDecorator;
  export function IsString(options?: Record<string, unknown>): PropertyDecorator;
  export function IsOptional(options?: Record<string, unknown>): PropertyDecorator;
  export function ValidateNested(options?: Record<string, unknown>): PropertyDecorator;
  export function validate(object: unknown, options?: Record<string, unknown>): Promise<unknown[]>;
  export function isURL(value: string, options?: Record<string, unknown>): boolean;
  export function registerDecorator(options: Record<string, unknown>): PropertyDecorator;
  export interface ValidationArguments {
    value: any;
    constraints: any[];
    targetName?: string;
    object: Record<string, unknown>;
    property: string;
  }
}
