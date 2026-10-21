export type UserRole = 'CUSTOMER' | 'AGENT' | 'TENANT_ADMIN' | 'PLATFORM_ADMIN';

export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  teamIds?: string[];
}
