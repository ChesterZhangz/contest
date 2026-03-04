import { api, extractData } from './api'
import type { QuestionBank } from '@/types'

export interface CreateBankInput {
  name: string
  description?: string
  isPublic?: boolean
}

export const banksService = {
  list: async (): Promise<QuestionBank[]> => {
    const res = await api.get('/banks')
    return extractData(res)
  },

  listPublic: async (): Promise<QuestionBank[]> => {
    const res = await api.get('/banks/public')
    return extractData(res)
  },

  get: async (id: string): Promise<QuestionBank> => {
    const res = await api.get(`/banks/${id}`)
    return extractData(res)
  },

  create: async (input: CreateBankInput): Promise<QuestionBank> => {
    const res = await api.post('/banks', input)
    return extractData(res)
  },

  update: async (id: string, input: Partial<CreateBankInput>): Promise<QuestionBank> => {
    const res = await api.patch(`/banks/${id}`, input)
    return extractData(res)
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/banks/${id}`)
  },
}
