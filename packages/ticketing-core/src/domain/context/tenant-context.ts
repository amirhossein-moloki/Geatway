export type UserRole = 'CUSTOMER' | 'REQUESTER' | 'AGENT' | 'TENANT_ADMIN' | 'PLATFORM_ADMIN';

export type TenancyMode = 'SINGLE_TENANT' | 'MULTI_TENANT';

export interface TenancyConfig {
  mode: TenancyMode;
  defaultTenantId?: string;
}

export interface TenantContext {
  tenantId?: string;
  userId: string;
  userRole: UserRole;
  teamIds?: string[];
}
