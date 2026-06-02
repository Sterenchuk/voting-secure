import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditVerificationDocument = HydratedDocument<AuditVerification>;

@Schema({
  collection: 'audit_verification',
  versionKey: false,
  timestamps: false,
})
export class AuditVerification {
  @Prop({ required: true, type: String, index: true })
  scope: 'global' | 'group' | 'voting' | 'survey';

  @Prop({ type: String, default: null, index: true })
  scopeId: string | null;

  @Prop({ required: true, type: Number })
  lastVerifiedSequence: number;

  @Prop({ type: Date, default: null })
  lastFullVerificationAt: Date | null;

  @Prop({ required: true })
  updatedAt: Date;
}

export const AuditVerificationSchema = SchemaFactory.createForClass(AuditVerification);
// Ensure uniqueness for (scope, scopeId)
AuditVerificationSchema.index({ scope: 1, scopeId: 1 }, { unique: true });
