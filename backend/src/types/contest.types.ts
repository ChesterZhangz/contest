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

export interface DifficultyAllocation {
  difficulty: Difficulty;
  count: number;
}

export interface RoundSource {
  bankId: string;
  allocations: DifficultyAllocation[];
}

export interface DifficultyTiming {
  difficulty: Difficulty;
  timeSeconds: number;
}

export interface RoundConfig {
  roundNumber: number;
  name: string;
  questionsPerBatch: number;
  sources: RoundSource[];
  tagConstraints?: {
    required?: string[];
    forbidden?: string[];
    preferred?: string[];
  };
  timings: DifficultyTiming[];
  scoring: {
    correctScore: number;
    wrongScore: number;
    partialScore?: number;
  };
}
