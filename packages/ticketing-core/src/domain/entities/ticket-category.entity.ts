export interface TicketCategoryProps {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TicketCategory {
  public readonly id: string;
  public readonly tenantId: string;
  public name: string;
  public description?: string;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: TicketCategoryProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.description = props.description;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(
    id: string,
    tenantId: string,
    name: string,
    description?: string,
  ): TicketCategory {
    const now = new Date();
    return new TicketCategory({
      id,
      tenantId,
      name,
      description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  public update(name?: string, description?: string, isActive?: boolean): void {
    if (name !== undefined) this.name = name;
    if (description !== undefined) this.description = description;
    if (isActive !== undefined) this.isActive = isActive;
    this.updatedAt = new Date();
  }
}
