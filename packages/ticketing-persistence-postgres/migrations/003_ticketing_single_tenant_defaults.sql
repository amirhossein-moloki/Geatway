-- 003_ticketing_single_tenant_defaults.sql
-- Optional migration helpers for single-tenant default column fallbacks
-- and documentation for single-tenant / multi-tenant mode transitions.

ALTER TABLE ticket_categories ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE tickets ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE ticket_messages ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE ticket_attachments ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE ticket_assignments ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE ticket_events ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE ticket_read_states ALTER COLUMN tenant_id SET DEFAULT 'default';

-- Note on Tenancy Mode Migration:
-- 1. Upgrading from Single-Tenant to Multi-Tenant Mode:
--    - Backfill existing 'default' tenant records to their respective assigned tenant_id:
--      UPDATE tickets SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_categories SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_messages SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_attachments SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_assignments SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_events SET tenant_id = 'org_123' WHERE tenant_id = 'default';
--      UPDATE ticket_read_states SET tenant_id = 'org_123' WHERE tenant_id = 'default';
-- 2. Downgrading or initializing Single-Tenant Mode:
--    - The default tenantId ('default' or custom configured string) will isolate all single-store ticketing records.
