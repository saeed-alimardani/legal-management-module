import { AuditAction, EntityType } from '@prisma/client';

export { AuditAction, EntityType };

export interface ActivityLogInput {
  actorId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}
