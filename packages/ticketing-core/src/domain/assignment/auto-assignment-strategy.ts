import { TenantContext } from '../context/tenant-context.js';
import { Ticket } from '../entities/ticket.entity.js';

export interface IAutoAssignmentStrategy {
  selectAgent(
    ctx: TenantContext,
    ticket: Ticket,
    candidateAgentIds: string[],
  ): Promise<string | undefined>;
}

export class RoundRobinAutoAssignmentStrategy implements IAutoAssignmentStrategy {
  private counters = new Map<string, number>();

  async selectAgent(
    ctx: TenantContext,
    ticket: Ticket,
    candidateAgentIds: string[],
  ): Promise<string | undefined> {
    if (!candidateAgentIds || candidateAgentIds.length === 0) {
      return undefined;
    }

    const key = `${ctx.tenantId}:${ticket.assignedTeamId ?? 'default'}`;
    const currentIndex = this.counters.get(key) ?? 0;
    const selected = candidateAgentIds[currentIndex % candidateAgentIds.length];

    this.counters.set(key, currentIndex + 1);
    return selected;
  }
}
