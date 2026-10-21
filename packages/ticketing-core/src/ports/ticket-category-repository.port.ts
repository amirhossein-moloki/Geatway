import { TicketCategory } from '../domain/entities/ticket-category.entity.js';

export interface ITicketCategoryRepository {
  create(category: TicketCategory): Promise<TicketCategory>;
  findByTenantId(tenantId: string, activeOnly?: boolean): Promise<TicketCategory[]>;
  findById(tenantId: string, id: string): Promise<TicketCategory | null>;
  update(category: TicketCategory): Promise<TicketCategory>;
}
