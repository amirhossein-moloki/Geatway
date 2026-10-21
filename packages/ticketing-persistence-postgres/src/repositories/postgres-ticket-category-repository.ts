import { ITicketCategoryRepository, TicketCategory } from '@amirhossein-moloki/ticketing-core';
import { PgExecutor } from '../migrator.js';

export interface TicketCategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PostgresTicketCategoryRepository implements ITicketCategoryRepository {
  constructor(private readonly db: PgExecutor) {}

  private mapRowToCategory(row: TicketCategoryRow): TicketCategory {
    return new TicketCategory({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async create(category: TicketCategory): Promise<TicketCategory> {
    const res = await this.db.query<TicketCategoryRow>(
      `INSERT INTO ticket_categories (
        id, tenant_id, name, description, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        category.id,
        category.tenantId,
        category.name,
        category.description ?? null,
        category.isActive,
        category.createdAt,
        category.updatedAt,
      ],
    );
    return this.mapRowToCategory(res.rows[0]!);
  }

  async findByTenantId(tenantId: string, activeOnly = true): Promise<TicketCategory[]> {
    let sql = `SELECT * FROM ticket_categories WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    if (activeOnly) {
      sql += ` AND is_active = true`;
    }
    sql += ` ORDER BY name ASC`;

    const res = await this.db.query<TicketCategoryRow>(sql, params);
    return res.rows.map((r) => this.mapRowToCategory(r));
  }

  async findById(tenantId: string, id: string): Promise<TicketCategory | null> {
    const res = await this.db.query<TicketCategoryRow>(
      `SELECT * FROM ticket_categories WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToCategory(res.rows[0]!);
  }

  async update(category: TicketCategory): Promise<TicketCategory> {
    const res = await this.db.query<TicketCategoryRow>(
      `UPDATE ticket_categories
       SET name = $3, description = $4, is_active = $5, updated_at = $6
       WHERE tenant_id = $1 AND id = $2
       RETURNING *`,
      [
        category.tenantId,
        category.id,
        category.name,
        category.description ?? null,
        category.isActive,
        category.updatedAt,
      ],
    );
    if (res.rows.length === 0) {
      throw new Error(
        `TicketCategory '${category.id}' not found for tenant '${category.tenantId}'`,
      );
    }
    return this.mapRowToCategory(res.rows[0]!);
  }
}
