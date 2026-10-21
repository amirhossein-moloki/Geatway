-- 001_ticketing_initial_schema.sql

CREATE TABLE IF NOT EXISTS ticket_categories (
  id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT unq_ticket_categories_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  category_id VARCHAR(255),
  customer_id VARCHAR(255) NOT NULL,
  assigned_agent_id VARCHAR(255),
  assigned_team_id VARCHAR(255),
  related_entity_type VARCHAR(255),
  related_entity_id VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_response_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  author_id VARCHAR(255) NOT NULL,
  author_role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_ticket_messages_ticket FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_key VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_ticket_attachments_message FOREIGN KEY (tenant_id, message_id) REFERENCES ticket_messages(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_assignments (
  id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  assigned_agent_id VARCHAR(255),
  assigned_team_id VARCHAR(255),
  assigned_by VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  previous_agent_id VARCHAR(255),
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_ticket_assignments_ticket FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT fk_ticket_events_ticket FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id) ON DELETE CASCADE
);

-- Tenant isolation indexes
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_customer ON tickets(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_agent ON tickets(tenant_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_category ON tickets(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_created ON tickets(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_tenant_ticket ON ticket_messages(tenant_id, ticket_id, visibility, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_tenant_ticket ON ticket_attachments(tenant_id, ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_tenant_ticket ON ticket_assignments(tenant_id, ticket_id, assigned_at);
CREATE INDEX IF NOT EXISTS idx_ticket_events_tenant_ticket ON ticket_events(tenant_id, ticket_id, created_at);
