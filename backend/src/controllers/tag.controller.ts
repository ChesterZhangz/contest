import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import * as tagService from '../services/tag.service';

export async function listTags(_req: Request, res: Response): Promise<void> {
  const data = await tagService.listTags();
  sendSuccess(res, data);
}

export async function createTag(req: Request, res: Response): Promise<void> {
  const data = await tagService.createTag(req.body);
  sendSuccess(res, data, '标签创建成功', 201);
}

export async function deleteTag(req: Request, res: Response): Promise<void> {
  const name = String(req.params.name);
  await tagService.deleteTag(name);
  sendSuccess(res, null, '标签删除成功');
}
