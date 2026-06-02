import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'audit_verification_jobs', timestamps: true })
export class AuditVerificationJob extends Document {
  @Prop({ required: true, enum: ['pending', 'processing', 'completed', 'failed'] })
  status: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ required: true })
  scope: string; // 'global' | 'group' | 'voting' | 'survey'

  @Prop()
  scopeId?: string;

  @Prop({ type: Object })
  result?: any;

  @Prop()
  error?: string;
}

export const AuditVerificationJobSchema = SchemaFactory.createForClass(AuditVerificationJob);
