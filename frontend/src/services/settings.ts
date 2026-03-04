import { api, extractData } from './api'

export interface AppSettings {
  allowedEmailDomains: string[]
  defaultBonusDelta: number
  defaultPenaltyDelta: number
}

export const settingsService = {
  /** Public — no auth required. Used by login page for domain hints. */
  getPublic: async (): Promise<AppSettings> => {
    const res = await api.get('/settings/public')
    return extractData(res)
  },

  /** Admin — super_admin only */
  get: async (): Promise<AppSettings> => {
    const res = await api.get('/settings')
    return extractData(res)
  },

  update: async (data: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await api.put('/settings', data)
    return extractData(res)
  },
}
