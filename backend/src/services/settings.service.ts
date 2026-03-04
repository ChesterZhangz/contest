import { SettingsModel } from '../models/Settings.model';
import { env } from '../config/env';

const KEY_ALLOWED_DOMAINS = 'allowedEmailDomains';
const KEY_DEFAULT_BONUS_DELTA = 'defaultBonusDelta';
const KEY_DEFAULT_PENALTY_DELTA = 'defaultPenaltyDelta';
const DEFAULT_DOMAIN = 'viquard.com';
const DEFAULT_BONUS_DELTA = 1;
const DEFAULT_PENALTY_DELTA = -1;

export interface AppSettings {
  allowedEmailDomains: string[];
  defaultBonusDelta: number;
  defaultPenaltyDelta: number;
}

async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const doc = await SettingsModel.findOne({ key }).lean();
  const parsed = Number(doc?.value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

/**
 * Read allowed email domains from the DB.
 * viquard.com is always included as the first/default domain.
 * Falls back to ALLOWED_EMAIL_DOMAINS env var if no DB record exists yet.
 */
export async function getAllowedEmailDomains(): Promise<string[]> {
  const doc = await SettingsModel.findOne({ key: KEY_ALLOWED_DOMAINS }).lean();
  const extra = doc !== null
    ? ((doc.value as string[]) ?? [])
    : env.allowedEmailDomains;
  // viquard.com is always first; merge without duplicates
  return [DEFAULT_DOMAIN, ...extra.filter((d) => d !== DEFAULT_DOMAIN)];
}

/**
 * Persist the allowed email domain list to the DB.
 * Normalises to lowercase, trims whitespace, removes duplicates.
 * viquard.com is always preserved as the first entry.
 */
export async function setAllowedEmailDomains(domains: string[]): Promise<string[]> {
  const normalized = [...new Set(
    domains.map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean),
  )];
  // Ensure viquard.com is always first
  const withDefault = [DEFAULT_DOMAIN, ...normalized.filter((d) => d !== DEFAULT_DOMAIN)];
  await SettingsModel.findOneAndUpdate(
    { key: KEY_ALLOWED_DOMAINS },
    { $set: { value: withDefault } },
    { upsert: true },
  );
  return withDefault;
}

export async function getDefaultBonusDelta(): Promise<number> {
  const value = await getNumberSetting(KEY_DEFAULT_BONUS_DELTA, DEFAULT_BONUS_DELTA);
  return value > 0 ? value : DEFAULT_BONUS_DELTA;
}

export async function getDefaultPenaltyDelta(): Promise<number> {
  const value = await getNumberSetting(KEY_DEFAULT_PENALTY_DELTA, DEFAULT_PENALTY_DELTA);
  return value < 0 ? value : DEFAULT_PENALTY_DELTA;
}

export async function setDefaultBonusDelta(delta: number): Promise<number> {
  const normalized = Math.max(1, Math.trunc(delta));
  await SettingsModel.findOneAndUpdate(
    { key: KEY_DEFAULT_BONUS_DELTA },
    { $set: { value: normalized } },
    { upsert: true },
  );
  return normalized;
}

export async function setDefaultPenaltyDelta(delta: number): Promise<number> {
  const normalized = Math.min(-1, Math.trunc(delta));
  await SettingsModel.findOneAndUpdate(
    { key: KEY_DEFAULT_PENALTY_DELTA },
    { $set: { value: normalized } },
    { upsert: true },
  );
  return normalized;
}

/** Shape returned to both admin and public callers. */
export async function getPublicSettings(): Promise<AppSettings> {
  const [allowedEmailDomains, defaultBonusDelta, defaultPenaltyDelta] = await Promise.all([
    getAllowedEmailDomains(),
    getDefaultBonusDelta(),
    getDefaultPenaltyDelta(),
  ]);
  return { allowedEmailDomains, defaultBonusDelta, defaultPenaltyDelta };
}

export async function updateSettings(input: {
  allowedEmailDomains?: string[];
  defaultBonusDelta?: number;
  defaultPenaltyDelta?: number;
}): Promise<AppSettings> {
  const tasks: Promise<unknown>[] = [];

  if (input.allowedEmailDomains !== undefined) {
    tasks.push(setAllowedEmailDomains(input.allowedEmailDomains));
  }
  if (input.defaultBonusDelta !== undefined) {
    tasks.push(setDefaultBonusDelta(input.defaultBonusDelta));
  }
  if (input.defaultPenaltyDelta !== undefined) {
    tasks.push(setDefaultPenaltyDelta(input.defaultPenaltyDelta));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }

  return getPublicSettings();
}
