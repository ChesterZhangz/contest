import { Types } from 'mongoose';
import { ApiError } from './api-error';

export function toObjectId(value: string, fieldName: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(400, 'INVALID_OBJECT_ID', `${fieldName} 不是合法的 ObjectId`);
  }
  return new Types.ObjectId(value);
}
