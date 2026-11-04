import type { RepoDeps } from '../sql';
import type {
  DailyNote,
  Plan,
  Recording,
  Reminder,
  ReminderEvent,
  ReminderPolicy,
  Task,
  Workspace,
} from '../types';
import { createRepository } from './create-repository';
import { createSettingsRepository } from './settings';

export function createRepositories(deps: RepoDeps) {
  const workspaces = createRepository<Workspace, 'dailyCapacityMin' | 'workHours' | 'sortOrder'>(deps, {
    table: 'workspace',
    fields: {
      name: 'text',
      kind: 'text',
      color: 'text',
      dailyCapacityMin: 'number',
      workHours: 'json',
      sortOrder: 'number',
    },
    defaults: { dailyCapacityMin: 240, workHours: null, sortOrder: 0 },
    orderBy: 'sort_order, created_at',
  });

  const plans = createRepository<Plan, 'goal' | 'status' | 'targetDate' | 'sortOrder'>(deps, {
    table: 'plan',
    fields: {
      workspaceId: 'text',
      name: 'text',
      goal: 'text',
      status: 'text',
      targetDate: 'text',
      sortOrder: 'number',
    },
    defaults: { goal: null, status: 'active', targetDate: null, sortOrder: 0 },
    orderBy: 'sort_order, created_at',
  });

  const tasks = createRepository<
    Task,
    | 'workspaceId'
    | 'planId'
    | 'parentId'
    | 'notes'
    | 'status'
    | 'priority'
    | 'mustDo'
    | 'critical'
    | 'scheduledDate'
    | 'dueAt'
    | 'estimateMin'
    | 'carryCount'
    | 'snoozeCount'
    | 'snoozedUntil'
    | 'sortOrder'
    | 'completedAt'
  >(deps, {
    table: 'task',
    fields: {
      workspaceId: 'text',
      planId: 'text',
      parentId: 'text',
      title: 'text',
      notes: 'text',
      status: 'text',
      priority: 'number',
      mustDo: 'bool',
      critical: 'bool',
      scheduledDate: 'text',
      dueAt: 'text',
      estimateMin: 'number',
      carryCount: 'number',
      snoozeCount: 'number',
      snoozedUntil: 'text',
      sortOrder: 'number',
      completedAt: 'text',
    },
    defaults: {
      workspaceId: null,
      planId: null,
      parentId: null,
      notes: null,
      status: 'todo',
      priority: 3,
      mustDo: false,
      critical: false,
      scheduledDate: null,
      dueAt: null,
      estimateMin: null,
      carryCount: 0,
      snoozeCount: 0,
      snoozedUntil: null,
      sortOrder: 0,
      completedAt: null,
    },
    orderBy: 'sort_order, created_at',
  });

  const recordings = createRepository<Recording, 'transcript'>(deps, {
    table: 'recording',
    fields: { taskId: 'text', uri: 'text', durationS: 'number', transcript: 'text' },
    defaults: { transcript: null },
  });

  const reminderPolicies = createRepository<
    ReminderPolicy,
    'workspaceId' | 'maxSnoozes' | 'quietStart' | 'quietEnd'
  >(deps, {
    table: 'reminder_policy',
    fields: {
      workspaceId: 'text',
      steps: 'json',
      maxSnoozes: 'number',
      quietStart: 'text',
      quietEnd: 'text',
    },
    defaults: { workspaceId: null, maxSnoozes: 3, quietStart: '22:00', quietEnd: '07:00' },
  });

  const reminders = createRepository<Reminder, 'status' | 'externalId'>(deps, {
    table: 'reminder',
    fields: {
      taskId: 'text',
      stepIndex: 'number',
      channel: 'text',
      fireAt: 'text',
      status: 'text',
      externalId: 'text',
    },
    defaults: { status: 'scheduled', externalId: null },
    orderBy: 'fire_at',
  });

  const reminderEvents = createRepository<ReminderEvent, never>(deps, {
    table: 'reminder_event',
    fields: { reminderId: 'text', event: 'text', at: 'text' },
    defaults: {},
    orderBy: 'at',
  });

  const dailyNotes = createRepository<DailyNote, 'workspaceId' | 'wins' | 'blockers' | 'notes'>(deps, {
    table: 'daily_note',
    fields: { date: 'text', workspaceId: 'text', wins: 'text', blockers: 'text', notes: 'text' },
    defaults: { workspaceId: null, wins: null, blockers: null, notes: null },
    orderBy: 'date',
  });

  return {
    workspaces,
    plans,
    tasks: {
      ...tasks,
      /**
       * Open top-level tasks scheduled for `date` or earlier (overdue ones roll into Today).
       * Subtasks are shown under their parent, never on their own.
       */
      forDay(date: string) {
        return tasks.getAll({
          where:
            "parent_id IS NULL AND scheduled_date IS NOT NULL AND scheduled_date <= ? AND status IN ('todo', 'doing')",
          params: [date],
          orderBy: 'workspace_id, sort_order, created_at',
        });
      },
      /** Open top-level tasks scheduled for exactly `date` (used by Tomorrow). */
      onDay(date: string) {
        return tasks.getAll({
          where: "parent_id IS NULL AND scheduled_date = ? AND status IN ('todo', 'doing')",
          params: [date],
          orderBy: 'workspace_id, sort_order, created_at',
        });
      },
      /** Open tasks (subtasks too) planned for a day before `date`: the ones rollover moves. */
      beforeDay(date: string) {
        return tasks.getAll({
          where: "scheduled_date IS NOT NULL AND scheduled_date < ? AND status IN ('todo', 'doing')",
          params: [date],
        });
      },
      /** Open top-level tasks with no workspace yet, newest first. */
      inbox() {
        return tasks.getAll({
          where: "parent_id IS NULL AND workspace_id IS NULL AND status IN ('todo', 'doing')",
          orderBy: 'created_at DESC',
        });
      },
      /** Open top-level tasks that have a workspace but no day ("Someday"), by workspace. */
      someday() {
        return tasks.getAll({
          where:
            "parent_id IS NULL AND workspace_id IS NOT NULL AND scheduled_date IS NULL AND status IN ('todo', 'doing')",
          orderBy: 'workspace_id, sort_order, created_at',
        });
      },
      /** Top-level tasks finished at or after `sinceIso`, newest first (Review). */
      doneSince(sinceIso: string) {
        return tasks.getAll({
          where: "parent_id IS NULL AND status = 'done' AND completed_at >= ?",
          params: [sinceIso],
          orderBy: 'completed_at DESC',
        });
      },
      subtasks(parentId: string) {
        return tasks.getAll({ where: 'parent_id = ?', params: [parentId] });
      },
    },
    recordings,
    reminderPolicies,
    reminders,
    reminderEvents,
    dailyNotes,
    settings: createSettingsRepository(deps),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
