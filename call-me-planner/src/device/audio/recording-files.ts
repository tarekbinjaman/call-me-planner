import { Directory, File, Paths } from 'expo-file-system';

/**
 * Phone storage for voice notes: Documents/recordings/<task>-<time>.m4a.
 * The documents folder survives app updates and is never cleared by the system.
 */

function recordingsDir(): Directory {
  const dir = new Directory(Paths.document, 'recordings');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Moves a fresh recording out of the cache into permanent storage; returns its new uri. */
export async function persistRecording(tempUri: string, taskId: string): Promise<string> {
  const source = new File(tempUri);
  const target = new File(recordingsDir(), `${taskId}-${Date.now()}.m4a`);
  await source.move(target);
  return source.uri;
}

/** Deletes a stored or temporary recording. Missing files are fine. */
export function deleteRecordingFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Could not delete recording', uri, error);
  }
}
