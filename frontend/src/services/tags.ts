import { api, extractData } from './api'
import type { Tag } from '@/types'

export const tagsService = {
  list: async (): Promise<Tag[]> => {
    const res = await api.get('/tags')
    return extractData(res)
  },

  create: async (input: { name: string; category?: string; color?: string }): Promise<Tag> => {
    const res = await api.post('/tags', input)
    return extractData(res)
  },

  delete: async (name: string): Promise<void> => {
    await api.delete(`/tags/${name}`)
  },
}
