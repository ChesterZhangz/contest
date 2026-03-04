import { Difficulty } from './question.types';

export enum ContestMode {
  TEAM = 'team',
  INDIVIDUAL = 'individual',
}

export enum SelectionMode {
  RANDOM = 'random',
  MANUAL = 'manual',
  BY_RULE = 'by_rule',
}

export enum ContestStatus {
  DRAFT = 'draft',
  READY = 'ready',
  ACTIVE = 'active',
  FINISHED = 'finished',
}

export interface TeamConfig {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  initialScore: number;
}

export interface RoundConfig {
  roundNumber: number;
  name: string;
  questionCount: number;
  timePerQuestion: number;
  bankId: string;
  selectionMode: SelectionMode;
  difficultyConstraint?: {
    min: Difficulty;
    max: Difficulty;
    distribution?: Array<{
      difficulty: Difficulty;
      count: number;
    }>;
  };
  tagConstraints?: {
    required?: string[];
    forbidden?: string[];
    preferred?: string[];
  };
  questionIds?: string[];
  scoring: {
    correctScore: number;
    wrongScore: number;
    partialScore?: number;
  };
}
