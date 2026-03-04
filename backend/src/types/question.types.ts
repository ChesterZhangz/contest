export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SHORT_ANSWER = 'short_answer',
}

export enum Difficulty {
  EASY = 1,
  MEDIUM = 2,
  HARD = 3,
  EXPERT = 4,
  EXTREME = 5,
}

export interface QuestionChoice {
  label: string;
  content: string;
}

export interface CreateQuestionDto {
  bankId: string;
  content: string;
  answer: string;
  solution?: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  choices?: QuestionChoice[];
  correctChoice?: string;
  source?: string;
}

export interface UpdateQuestionDto extends Partial<Omit<CreateQuestionDto, 'bankId'>> {}

export interface QuestionQueryParams {
  bankId: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  difficulty?: number[];
  tags?: string[];
  type?: QuestionType[];
  sortBy?: 'createdAt' | 'difficulty' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
}
