import { moveToDayPatch, moveToWorkspacePatch, statusPatch, type TaskPatch } from '@/domain/tasks';
import { useUndo } from '@/stores/undo';

import { getRepos } from '.';
import type { Task, TaskStatus } from './types';

/**
 * Task changes made from screens. Each one shows a toast with Undo,
 * so a wrong tap on the phone is never permanent.
 */

const STATUS_MESSAGES: Record<TaskStatus, string> = {
  done: 'Marked done',
  doing: 'Marked in progress',
  todo: 'Moved back to to-do',
  dropped: 'Task dropped',
};

async function patchWithUndo(task: Task, patch: TaskPatch, message: string) {
  const repos = await getRepos();
  const previous: TaskPatch = {};
  for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
    (previous as Record<string, unknown>)[key] = task[key];
  }
  await repos.tasks.update(task.id, patch);
  useUndo.getState().show(message, async () => {
    await (await getRepos()).tasks.update(task.id, previous);
  });
}

export function setTaskStatus(task: Task, status: TaskStatus) {
  return patchWithUndo(task, statusPatch(status), STATUS_MESSAGES[status]);
}

export function toggleTaskDone(task: Task) {
  return setTaskStatus(task, task.status === 'done' ? 'todo' : 'done');
}

export function moveTaskToDay(task: Task, day: string | null, label: string) {
  return patchWithUndo(task, moveToDayPatch(task, day), day ? `Moved to ${label}` : 'Day removed');
}

export function moveTaskToWorkspace(task: Task, workspaceId: string | null, name: string) {
  const patch = moveToWorkspacePatch(task, workspaceId);
  if (Object.keys(patch).length === 0) return Promise.resolve();
  return patchWithUndo(task, patch, workspaceId ? `Moved to ${name}` : 'Moved to Inbox');
}

/** Soft-deletes the task and its subtasks; Undo brings them all back. */
export async function deleteTask(task: Task) {
  const repos = await getRepos();
  const subtasks = await repos.tasks.subtasks(task.id);
  for (const s of subtasks) await repos.tasks.softDelete(s.id);
  await repos.tasks.softDelete(task.id);
  useUndo.getState().show('Task deleted', async () => {
    const r = await getRepos();
    await r.tasks.restore(task.id);
    for (const s of subtasks) await r.tasks.restore(s.id);
  });
}

/** Saves a new manual order (from domain `reorder`). */
export async function saveOrder(updates: { id: string; sortOrder: number }[]) {
  const repos = await getRepos();
  for (const u of updates) await repos.tasks.update(u.id, { sortOrder: u.sortOrder });
}

/** Quick add for a specific day (Today / Tomorrow screens): no workspace yet. */
export async function quickAddForDay(title: string, day: string, sortOrder: number) {
  const repos = await getRepos();
  return repos.tasks.insert({ title: title.trim(), scheduledDate: day, sortOrder });
}

/** Quick add: title only, lands in the Inbox. */
export async function quickAddTask(title: string) {
  const repos = await getRepos();
  return repos.tasks.insert({ title: title.trim() });
}

export async function addSubtask(parent: Task, title: string, sortOrder: number) {
  const repos = await getRepos();
  return repos.tasks.insert({
    title: title.trim(),
    parentId: parent.id,
    workspaceId: parent.workspaceId,
    planId: parent.planId,
    sortOrder,
  });
}
