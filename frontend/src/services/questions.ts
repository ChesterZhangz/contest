import { api, extractData } from './api'
import type { Question, QuestionType, Difficulty, QuestionChoice, PaginatedResponse } from '@/types'

export interface QuestionFilters {
  bankId: string
  page?: number
  pageSize?: number
  keyword?: string
  difficulty?: Difficulty[]
  tags?: string[]
  type?: QuestionType[]
  sortBy?: 'createdAt' | 'difficulty' | 'usageCount'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateQuestionInput {
  bankId: string
  content: string
  answer: string
  solution?: string
  type: QuestionType
  difficulty: Difficulty
  tags?: string[]
  choices?: QuestionChoice[]
  correctChoice?: string
  source?: string
}

export type UpdateQuestionInput = Partial<Omit<CreateQuestionInput, 'bankId'>>

export const questionsService = {
  list: async (filters: QuestionFilters): Promise<PaginatedResponse<Question>> => {
    const params: Record<string, unknown> = { ...filters }
    if (filters.difficulty?.length) params.difficulty = filters.difficulty.join(',')
    if (filters.tags?.length) params.tags = filters.tags.join(',')
    if (filters.type?.length) params.type = filters.type.join(',')
    const res = await api.get('/questions', { params })
    return extractData(res)
  },

  get: async (id: string): Promise<Question> => {
    const res = await api.get(`/questions/${id}`)
    return extractData(res)
  },

  create: async (input: CreateQuestionInput): Promise<Question> => {
    const res = await api.post('/questions', input)
    return extractData(res)
  },

  batchCreate: async (bankId: string, questions: Omit<CreateQuestionInput, 'bankId'>[]): Promise<Question[]> => {
    const res = await api.post('/questions/batch', { bankId, questions })
    return extractData(res)
  },

  update: async (id: string, input: UpdateQuestionInput): Promise<Question> => {
    const res = await api.patch(`/questions/${id}`, input)
    return extractData(res)
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/questions/${id}`)
  },

  import: async (bankId: string, format: 'json' | 'csv', content: string): Promise<{ total: number; success: number; failed: number; errors: Array<{ index: number; message: string }> }> => {
    const res = await api.post('/questions/import', { bankId, format, content })
    return extractData(res)
  },

  previewImport: async (bankId: string, format: 'json' | 'csv', content: string): Promise<{ total: number; valid: number; invalid: number; preview: Question[]; errors: Array<{ index: number; field?: string; message: string }> }> => {
    const res = await api.post('/questions/preview-import', { bankId, format, content })
    return extractData(res)
  },

  exportBank: async (bankId: string): Promise<unknown> => {
    const res = await api.get(`/questions/export/${bankId}`)
    return extractData(res)
  },
}
