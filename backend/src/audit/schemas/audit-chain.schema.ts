import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ChainAction } from '../types/audit.types';

export type AuditChainDocumentHydrated = HydratedDocument<AuditChain>;

@Schema({
  collection: 'audit_chain',
  versionKey: false,
  timestamps: false,
})
export class AuditChain {
  @Prop({ required: true, unique: true, index: true })
  sequence: number;

  @Prop({ required: true, type: String, enum: Object.values(ChainAction) })
  action: ChainAction;

  @Prop({ required: true, type: Object })
  payload: Record<string, unknown>;

  @Prop({ type: String, default: null, index: true })
  userId: string | null;

  @Prop({ type: String, default: null, index: true })
  groupId: string | null;

  @Prop({ type: String, default: null, index: true })
  votingId: string | null;

  @Prop({ type: String, default: null, index: true })
  surveyId: string | null;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  prevHash: string;

  @Prop({ required: true, unique: true })
  hash: string;
}

export const AuditChainSchema = SchemaFactory.createForClass(AuditChain);

AuditChainSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'findOneAndDelete',
    'deleteOne',
    'deleteMany',
  ],
  function () {
    throw new Error(
      'audit_chain is append-only. Updates and deletes are forbidden.',
    );
  },
);
