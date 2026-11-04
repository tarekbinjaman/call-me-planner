import { planVoiceNoteSave, type VoiceNoteDraft } from '@/domain/voice-notes';

import type { Repositories } from './repositories';

/** Where recordings live on this platform (src/device/audio/recording-files). */
export type RecordingFiles = {
  persistRecording(tempUri: string, taskId: string): Promise<string>;
  deleteRecordingFile(uri: string): void;
};

/**
 * Applies the task form's voice note on Save: stores a new note (replacing the old one)
 * or removes it. The new file is stored before the old one is deleted, so a failure
 * halfway never leaves the task with no note at all.
 */
export async function saveVoiceNote(
  repos: Repositories,
  taskId: string,
  draft: VoiceNoteDraft,
  files: RecordingFiles,
): Promise<void> {
  const plan = planVoiceNoteSave(await repos.recordings.forTask(taskId), draft);
  if (plan.add) {
    const uri = await files.persistRecording(plan.add.tempUri, taskId);
    await repos.recordings.insert({ taskId, uri, durationS: plan.add.durationS });
  }
  for (const old of plan.remove) {
    await repos.recordings.softDelete(old.id);
    files.deleteRecordingFile(old.uri);
  }
}
