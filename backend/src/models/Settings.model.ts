import { Schema, model } from 'mongoose';

/**
 * Generic key-value settings store.
 * Each document stores one setting by its unique key.
 */
const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, versionKey: false },
);

export const SettingsModel = model('Settings', settingsSchema);
