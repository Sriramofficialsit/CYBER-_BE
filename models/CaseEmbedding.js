import mongoose from 'mongoose';

const { Schema } = mongoose;

const caseEmbeddingSchema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      unique: true,
      index: true,
    },
    vector: { type: [Number], required: true },
    model: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('CaseEmbedding', caseEmbeddingSchema);
