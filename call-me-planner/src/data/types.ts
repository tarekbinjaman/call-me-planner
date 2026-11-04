/**
 * App-side shapes of the database rows (camelCase, real booleans, parsed JSON).
 * Repositories convert between these and the snake_case SQLite rows.
 */

export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** Keys managed by the repository, never passed in by callers. */
export type BaseKeys = keyof BaseEntity;

/** A workspace color is a theme token name (wsPersonal, wsCompanyA, ...) or a hex color. */
export type WorkspaceColor = string;

export type WorkHours = {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** 'HH:mm', local time */
  start: string;
  end: string;
};

export type Workspace = BaseEntity & {
  name: string;
  kind: 'personal' | 'company';
  color: WorkspaceColor;
  dailyCapacityMin: number;
  workHours: WorkHours | null;
  sortOrder: number;
};

export type PlanStatus = 'active' | 'paused' | 'done';

export type Plan = BaseEntity & {
  workspaceId: string;
  name: string;
  goal: string | null;
  status: PlanStatus;
  /** 'YYYY-MM-DD' */
  targetDate: string | null;
  sortOrder: number;
};

export type TaskStatus = 'todo' | 'doing' | 'done' | 'dropped';
export type Priority = 1 | 2 | 3 | 4;

export type Task = BaseEntity & {
  /** null = Inbox */
  workspaceId: string | null;
  planId: string | null;
  parentId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  /** 1 = highest, 4 = lowest */
  priority: Priority;
  mustDo: boolean;
  critical: boolean;
  /** Day you plan to do it, 'YYYY-MM-DD' local */
  scheduledDate: string | null;
  /** Deadline / reminder time, ISO timestamp */
  dueAt: string | null;
  estimateMin: number | null;
  carryCount: number;
  snoozeCount: number;
  sortOrder: number;
  completedAt: string | null;
};

export type Recording = BaseEntity & {
  taskId: string;
  uri: string;
  durationS: number;
  transcript: string | null;
};

export type ReminderChannel = 'heads_up' | 'voice' | 'ring' | 'phone_call' | 'sms_buddy';

export type ReminderStep = {
  /** Minutes relative to the task's due time; negative = before */
  offsetMin: number;
  channel: ReminderChannel;
};

export type ReminderPolicy = BaseEntity & {
  /** null = the default policy for every workspace */
  workspaceId: string | null;
  steps: ReminderStep[];
  maxSnoozes: number;
  /** 'HH:mm' */
  quietStart: string;
  quietEnd: string;
};

export type ReminderStatus = 'scheduled' | 'fired' | 'answered' | 'missed' | 'cancelled';

export type Reminder = BaseEntity & {
  taskId: string;
  stepIndex: number;
  channel: ReminderChannel;
  fireAt: string;
  status: ReminderStatus;
  externalId: string | null;
};

export type ReminderEvent = BaseEntity & {
  reminderId: string;
  event: string;
  at: string;
};

export type DailyNote = BaseEntity & {
  /** 'YYYY-MM-DD' */
  date: string;
  workspaceId: string | null;
  wins: string | null;
  blockers: string | null;
  notes: string | null;
};
