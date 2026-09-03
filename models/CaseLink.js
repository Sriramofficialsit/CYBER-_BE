import mongoose from 'mongoose';

const { Schema } = mongoose;

export const LINK_TYPES = ['shared_identifier', 'semantic_similarity', 'ai_hypothesis'];
export const VERDICTS = ['pending', 'confirmed', 'dismissed'];

const caseLinkSchema = new Schema(
  {
    caseA: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    caseB: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    linkType: { type: String, enum: LINK_TYPES, required: true },
    matchedOn: { type: [String], default: [] }, // e.g. ["phone: 98xxxxxxxx", "IFSC: HDFC0001234"]
    similarityScore: { type: Number }, // 0-1, for semantic links
    aiRationale: { type: String, default: '' }, // plain-language explanation
    aiConfidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    suggestedNextStep: { type: String, default: '' },
    aiConnected: { type: Boolean, default: true }, // GPT's "connected" verdict
    officerReviewed: { type: Boolean, default: false },
    officerVerdict: { type: String, enum: VERDICTS, default: 'pending' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// One link record per unordered pair + type. Store the pair with caseA < caseB
// (string compare on ObjectId) so the unique index is stable.
caseLinkSchema.index({ caseA: 1, caseB: 1, linkType: 1 }, { unique: true });

export function orderPair(id1, id2) {
  const a = String(id1);
  const b = String(id2);
  return a < b ? [id1, id2] : [id2, id1];
}

export default mongoose.model('CaseLink', caseLinkSchema);
