import { describe, expect, it } from 'vitest';

import { alarmDiff, alarmsToArm, alarmText, type AlarmReminder } from './alarms';

const now = new Date('2026-11-04T08:00:00.000Z');
const r = (id: string, fireAt: string, p: Partial<AlarmReminder> = {}): AlarmReminder => ({
  id,
  taskId: 't',
  channel: 'ring',
  fireAt,
  status: 'scheduled',
  ...p,
});

describe('alarmsToArm', () => {
  it('arms local steps that are waiting within the next 48 hours, soonest first', () => {
    const list = [
      r('later', '2026-11-04T12:00:00.000Z'),
      r('soon', '2026-11-04T09:00:00.000Z', { channel: 'heads_up' }),
      r('past', '2026-11-04T07:59:00.000Z'),
      r('far', '2026-11-06T08:00:01.000Z'),
      r('edge', '2026-11-06T08:00:00.000Z'),
      r('call', '2026-11-04T10:00:00.000Z', { channel: 'phone_call' }),
      r('sms', '2026-11-04T10:00:00.000Z', { channel: 'sms_buddy' }),
      r('done', '2026-11-04T10:00:00.000Z', { status: 'answered' }),
    ];
    expect(alarmsToArm(list, now).map((x) => x.id)).toEqual(['soon', 'later', 'edge']);
  });
});

describe('alarmDiff', () => {
  it('arms new or moved reminders and disarms ones that are gone', () => {
    const wanted = [
      r('a', '2026-11-04T09:00:00.000Z'),
      r('b', '2026-11-04T10:00:00.000Z'),
      r('c', '2026-11-04T11:00:00.000Z'),
    ];
    const armed = [
      { id: 'a', taskId: 't', fireAt: '2026-11-04T09:00:00.000Z' },
      { id: 'b', taskId: 't', fireAt: '2026-11-04T09:30:00.000Z' },
      { id: 'x', taskId: 't', fireAt: '2026-11-04T09:45:00.000Z' },
    ];
    const diff = alarmDiff(wanted, armed);
    expect(diff.arm.map((w) => w.id)).toEqual(['b', 'c']);
    expect(diff.disarm).toEqual(['x']);
  });
});

describe('alarmText', () => {
  it('says what is coming up, and how to answer a ring', () => {
    expect(alarmText('heads_up', { title: 'Call bank', mustDo: true }, '10:00')).toEqual({
      title: 'Call bank',
      body: 'Coming up · Due 10:00',
    });
    expect(alarmText('ring', { title: 'Call bank', mustDo: true }, '10:00')).toEqual({
      title: 'Call bank',
      body: 'Must do · Due 10:00 · tap to answer',
    });
    expect(alarmText('voice', { title: 'Water plants', mustDo: false }, null).body).toBe(
      'Due now · tap to answer',
    );
  });
});

describe('alarmDiff with titles', () => {
  it('re-arms an alarm when its title changed', () => {
    const at = '2026-11-04T09:00:00.000Z';
    const wanted = [{ ...r('a', at), title: 'New title' }];
    expect(alarmDiff(wanted, [{ id: 'a', taskId: 't', fireAt: at, title: 'Old title' }]).arm).toHaveLength(1);
    expect(alarmDiff(wanted, [{ id: 'a', taskId: 't', fireAt: at, title: 'New title' }]).arm).toHaveLength(0);
  });
});
