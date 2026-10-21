-- 002_ticketing_read_states_and_sla.sql

CREATE TABLE IF NOT EXISTS ticket_read_states (
  tenant_id VARCHAR(255) NOT NULL,
  ticket_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, ticket_id, user_id),
  CONSTRAINT fk_ticket_read_states_ticket FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ticket_read_states_tenant_user ON ticket_read_states(tenant_id, user_id, last_read_at);
