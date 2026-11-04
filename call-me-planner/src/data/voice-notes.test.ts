import { afterEach, describe, expect, it } from 'vitest';

import { KEEP } from '@/domain/voice-notes';

import { createTestRepos } from './testing/node-db';
import { saveVoiceNote, type RecordingFiles } from './voice-notes';

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

function fakeFiles() {
  const deleted: string[] = [];
  const files: RecordingFiles = {
    persistRecording: async (tempUri, taskId) => `stored/${taskId}/${tempUri}`,
    deleteRecordingFile: (uri) => void deleted.push(uri),
  };
  return { files, deleted };
}

async function setup() {
  const t = await createTestRepos();
  cleanup = () => t.db.close();
  const task = await t.repos.tasks.insert({ title: 'Call bank' });
  return { ...t, task };
}

describe('saveVoiceNote on real SQLite', () => {
  it('stores a new note', async () => {
    const { repos, task } = await setup();
    const { files } = fakeFiles();
    await saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'a.m4a', durationS: 9 }, files);
    expect(await repos.recordings.forTask(task.id)).toMatchObject([
      { taskId: task.id, uri: `stored/${task.id}/a.m4a`, durationS: 9 },
    ]);
  });

  it('a new note replaces the old one and deletes its file', async () => {
    const { repos, task, tick } = await setup();
    const { files, deleted } = fakeFiles();
    await saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'a.m4a', durationS: 9 }, files);
    tick();
    await saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'b.m4a', durationS: 4 }, files);
    const notes = await repos.recordings.forTask(task.id);
    expect(notes.map((n) => n.uri)).toEqual([`stored/${task.id}/b.m4a`]);
    expect(deleted).toEqual([`stored/${task.id}/a.m4a`]);
  });

  it('remove deletes the note; keep leaves it alone', async () => {
    const { repos, task } = await setup();
    const { files, deleted } = fakeFiles();
    await saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'a.m4a', durationS: 9 }, files);
    await saveVoiceNote(repos, task.id, KEEP, files);
    expect(await repos.recordings.forTask(task.id)).toHaveLength(1);
    await saveVoiceNote(repos, task.id, { kind: 'remove' }, files);
    expect(await repos.recordings.forTask(task.id)).toEqual([]);
    expect(deleted).toHaveLength(1);
  });

  it('keeps the old note if storing the new one fails', async () => {
    const { repos, task } = await setup();
    const { files } = fakeFiles();
    await saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'a.m4a', durationS: 9 }, files);
    const failing = { ...files, persistRecording: async () => Promise.reject(new Error('disk full')) };
    await expect(
      saveVoiceNote(repos, task.id, { kind: 'new', tempUri: 'b.m4a', durationS: 4 }, failing),
    ).rejects.toThrow('disk full');
    expect(await repos.recordings.forTask(task.id)).toHaveLength(1);
  });
});
