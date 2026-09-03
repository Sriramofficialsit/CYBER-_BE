import mongoose from 'mongoose';

const { Schema } = mongoose;

export const FILE_TYPES = ['document', 'image', 'pdf', 'other'];

const evidenceSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
    fileName: { type: String, required: true },
    storedPath: { type: String, required: true },
    fileHash: { type: String, required: true }, // SHA-256, computed on upload
    fileType: { type: String, enum: FILE_TYPES, default: 'other' },
    sizeBytes: { type: Number },
    uploadedBy: { type: String, default: 'investigator' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Evidence', evidenceSchema);
