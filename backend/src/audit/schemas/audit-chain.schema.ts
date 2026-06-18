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

  @Prop({ type: Number })
  groupSequence: number | null;

  @Prop({ type: Number })
  votingSequence: number | null;

  @Prop({ type: Number })
  surveySequence: number | null;

  @Prop({ required: true, type: String, enum: Object.values(ChainAction) })
  action: ChainAction;

  @Prop({ required: true, type: Object })
  payload: Record<string, unknown>;

  @Prop({ type: String, index: true })
  userId: string | null;

  @Prop({ type: String, index: true })
  groupId: string | null;

  @Prop({ type: String, index: true })
  votingId: string | null;

  @Prop({ type: String, index: true })
  surveyId: string | null;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  prevHash: string;

  @Prop({ type: String })
  groupPrevHash: string | null;

  @Prop({ type: String })
  votingPrevHash: string | null;

  @Prop({ type: String })
  surveyPrevHash: string | null;

  @Prop({ required: true, unique: true })
  hash: string;
}

export const AuditChainSchema = SchemaFactory.createForClass(AuditChain);

// ─── Scoped Uniqueness ────────────────────────────────────────────────────────
// Ensure that within a specific scope (group, voting, or survey), the sequence
// is unique. This prevents race conditions from resulting in duplicate entries.

AuditChainSchema.index(
  { groupId: 1, groupSequence: 1 },
  {
    unique: true,
    partialFilterExpression: { groupSequence: { $exists: true, $ne: null } },
  },
);

AuditChainSchema.index(
  { votingId: 1, votingSequence: 1 },
  {
    unique: true,
    partialFilterExpression: { votingSequence: { $exists: true, $ne: null } },
  },
);

AuditChainSchema.index(
  { surveyId: 1, surveySequence: 1 },
  {
    unique: true,
    partialFilterExpression: { surveySequence: { $exists: true, $ne: null } },
  },
);

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
