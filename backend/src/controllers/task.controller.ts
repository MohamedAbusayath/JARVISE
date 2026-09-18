import { Request, Response } from "express";
import { getAuthenticatedUser } from "../middleware/auth.middleware";
import * as service from "../services/task.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { isUuid, parseCreateTask, parseTaskFilters, parseUpdateTask } from "../security/taskValidators";

const auth = (res: Response) => getAuthenticatedUser(res);
const taskId = (req: Request): string => {
    const value = req.params.taskId;
    if (typeof value !== "string" || !isUuid(value)) throw new AppError("Task ID is invalid", 400, "TASK_ID_INVALID");
    return value;
};

export const create = async (req: Request, res: Response) => {
    const parsed = parseCreateTask(req.body);
    if (!parsed.success) throw new AppError("Task input is invalid", 400, "TASK_INPUT_INVALID");
    const a = auth(res);
    sendSuccess(res, { task: await service.createTask(a.accessToken, a.user.id, parsed.data) }, 201);
};
export const list = async (req: Request, res: Response) => {
    const a = auth(res);
    sendSuccess(res, { tasks: await service.listTasks(a.accessToken, a.user.id, parseTaskFilters(req.query as Record<string, unknown>)) });
};
export const get = async (req: Request, res: Response) => {
    const a = auth(res);
    sendSuccess(res, { task: await service.getTask(a.accessToken, a.user.id, taskId(req)) });
};
export const update = async (req: Request, res: Response) => {
    const parsed = parseUpdateTask(req.body);
    if (!parsed.success) throw new AppError("Task update is invalid", 400, "TASK_INPUT_INVALID");
    const a = auth(res);
    sendSuccess(res, { task: await service.updateTask(a.accessToken, a.user.id, taskId(req), parsed.data) });
};
export const complete = async (req: Request, res: Response) => {
    const a = auth(res);
    sendSuccess(res, { task: await service.completeTask(a.accessToken, a.user.id, taskId(req)) });
};
export const reopen = async (req: Request, res: Response) => {
    const a = auth(res);
    sendSuccess(res, { task: await service.reopenTask(a.accessToken, a.user.id, taskId(req)) });
};
export const remove = async (req: Request, res: Response) => {
    const a = auth(res);
    sendSuccess(res, await service.deleteTask(a.accessToken, a.user.id, taskId(req)));
};
