import { describe, expect, it } from 'vitest';

import type { Task } from '@/data/types';

import { planRollover } from './rollover';
import { combineDateTime, timeOf } from './tasks';

type Row = Parameters<typeof planRollover>[0][number];

function row(p: Partial<Task> & { id: string }): Row {
  return { status: 'todo', scheduledDate: null, dueAt: null, carryCount: 0, deletedAt: null, ...p };
}

describe('planRollover', () => {
  const today = '2026-11-04';

  it('moves open tasks from earlier days to today and counts the carry', () => {
    const changes = planRollover(
      [
        row({ id: 'a', scheduledDate: '2026-11-03' }),
        row({ id: 'b', scheduledDate: '2026-10-28', status: 'doing', carryCount: 2 }),
      ],
      today,
    );
    expect(changes).toEqual([
      { id: 'a', patch: { scheduledDate: today, dueAt: null, carryCount: 1 } },
      { id: 'b', patch: { scheduledDate: today, dueAt: null, carryCount: 3 } },
    ]);
  });

  it('leaves alone tasks for today or later, done, dropped, deleted and unscheduled ones', () => {
    const changes = planRollover(
      [
        row({ id: 'today', scheduledDate: today }),
        row({ id: 'future', scheduledDate: '2026-11-05' }),
        row({ id: 'done', scheduledDate: '2026-11-03', status: 'done' }),
        row({ id: 'dropped', scheduledDate: '2026-11-03', status: 'dropped' }),
        row({ id: 'deleted', scheduledDate: '2026-11-03', deletedAt: '2026-11-03T12:00:00.000Z' }),
        row({ id: 'inbox' }),
      ],
      today,
    );
    expect(changes).toEqual([]);
  });

  it('keeps the clock time of a due time on the new day', () => {
    const [change] = planRollover(
      [row({ id: 'a', scheduledDate: '2026-11-02', dueAt: combineDateTime('2026-11-02', '10:30') })],
      today,
    );
    expect(change?.patch.dueAt).toBe(combineDateTime(today, '10:30'));
    expect(timeOf(change?.patch.dueAt ?? '')).toBe('10:30');
  });

  it('is safe to run twice: applying the changes leaves nothing to move', () => {
    let tasks = [row({ id: 'a', scheduledDate: '2026-11-03' })];
    const first = planRollover(tasks, today);
    tasks = tasks.map((t) => ({ ...t, ...first.find((c) => c.id === t.id)?.patch }));
    expect(planRollover(tasks, today)).toEqual([]);
    expect(tasks[0]?.carryCount).toBe(1);
  });

  it('crossing midnight moves the task again and counts it again', () => {
    let tasks = [row({ id: 'a', scheduledDate: '2026-11-03' })];
    for (const day of ['2026-11-04', '2026-11-05']) {
      const changes = planRollover(tasks, day);
      tasks = tasks.map((t) => ({ ...t, ...changes.find((c) => c.id === t.id)?.patch }));
    }
    expect(tasks[0]).toMatchObject({ scheduledDate: '2026-11-05', carryCount: 2 });
  });
});
