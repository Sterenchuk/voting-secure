import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SecurityAction } from '../types/audit.types';

export type AuditSecurityDocumentHydrated = HydratedDocument<AuditSecurity>;

@Schema({
  collection: 'audit_security',
  versionKey: false,
  timestamps: false,
})
export class AuditSecurity {
  @Prop({ required: true, type: String, enum: Object.values(SecurityAction) })
  action: SecurityAction;

  @Prop({ required: true, type: Object })
  payload: Record<string, unknown>;

  @Prop({ type: String, default: null, index: true })
  userId: string | null;

  @Prop({ required: true })
  createdAt: Date;
}

export const AuditSecuritySchema = SchemaFactory.createForClass(AuditSecurity);
