import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditCheckpointDocument = HydratedDocument<AuditCheckpoint>;

@Schema({
  collection: 'audit_checkpoints',
  versionKey: false,
  timestamps: false,
})
export class AuditCheckpoint {
  @Prop({ required: true, type: String })
  scope: 'global' | 'group' | 'voting' | 'survey';

  @Prop({ type: String, default: null })
  scopeId: string | null;

  @Prop({ required: true, type: Number })
  sequence: number;

  @Prop({ required: true, type: String })
  hash: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const AuditCheckpointSchema = SchemaFactory.createForClass(AuditCheckpoint);

// Ensure unique checkpoint per scope/id/sequence combination
AuditCheckpointSchema.index({ scope: 1, scopeId: 1, sequence: 1 }, { unique: true });

// Prevent modifications
AuditCheckpointSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'deleteOne', 'deleteMany'],
  function () {
    throw new Error('audit_checkpoints are immutable.');
  },
);
