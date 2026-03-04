import type { Request, Response } from 'express';
import * as settingsService from '../services/settings.service';
import { sendSuccess } from '../utils/response';

/** GET /settings/public — no auth required */
export async function getPublicSettings(_req: Request, res: Response): Promise<void> {
  const data = await settingsService.getPublicSettings();
  sendSuccess(res, data);
}

/** GET /settings — super_admin only */
export async function getSettings(_req: Request, res: Response): Promise<void> {
  const data = await settingsService.getPublicSettings();
  sendSuccess(res, data);
}

/** PUT /settings — super_admin only */
export async function updateSettings(req: Request, res: Response): Promise<void> {
  const data = await settingsService.updateSettings({
    allowedEmailDomains: Array.isArray(req.body.allowedEmailDomains)
      ? (req.body.allowedEmailDomains as string[])
      : undefined,
    defaultBonusDelta:
      typeof req.body.defaultBonusDelta === 'number' ? Number(req.body.defaultBonusDelta) : undefined,
    defaultPenaltyDelta:
      typeof req.body.defaultPenaltyDelta === 'number' ? Number(req.body.defaultPenaltyDelta) : undefined,
  });
  sendSuccess(res, data, '设置已保存');
}
