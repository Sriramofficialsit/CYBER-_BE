import mongoose from 'mongoose';

const { Schema } = mongoose;

export const FRAUD_TYPES = [
  'phishing',
  'UPI fraud',
  'investment scam',
  'sextortion',
  'other',
];

export const CASE_STATUS = ['open', 'under_review', 'linked', 'closed'];
export const CASE_STAGE = ['intake', 'notice_sent', 'analysis', 'reporting'];

const identifiersSchema = new Schema(
  {
    phones: { type: [String], default: [] },
    emails: { type: [String], default: [] },
    accountNumbers: { type: [String], default: [] },
    ifscCodes: { type: [String], default: [] },
    upiIds: { type: [String], default: [] },
    deviceIds: { type: [String], default: [] },
    urls: { type: [String], default: [] },
  },
  { _id: false }
);

const caseSchema = new Schema(
  {
    caseNumber: { type: String, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    complainantName: { type: String, trim: true },
    complainantContact: { type: String, trim: true },
    fraudType: { type: String, enum: FRAUD_TYPES, default: 'other' },
    narrative: { type: String, required: true },
    extractedIdentifiers: { type: identifiersSchema, default: () => ({}) },
    status: { type: String, enum: CASE_STATUS, default: 'open' },
    stage: { type: String, enum: CASE_STAGE, default: 'intake' },
    assignedOfficer: { type: String, trim: true, default: '' },
    // Bookkeeping for the async AI pipeline.
    analysis: {
      state: {
        type: String,
        enum: ['pending', 'running', 'done', 'error'],
        default: 'pending',
      },
      lastRunAt: { type: Date },
      error: { type: String },
    },
  },
  { timestamps: true }
);

// Auto-generate a human-friendly case number: CYB-YYYY-NNNN
caseSchema.pre('validate', async function assignCaseNumber(next) {
  if (this.caseNumber) return next();
  const year = new Date().getFullYear();
  const prefix = `CYB-${year}-`;
  const last = await this.constructor
    .findOne({ caseNumber: new RegExp(`^${prefix}`) })
    .sort({ caseNumber: -1 })
    .lean();
  let seq = 1;
  if (last) seq = parseInt(last.caseNumber.slice(prefix.length), 10) + 1;
  this.caseNumber = `${prefix}${String(seq).padStart(4, '0')}`;
  next();
});

export default mongoose.model('Case', caseSchema);
