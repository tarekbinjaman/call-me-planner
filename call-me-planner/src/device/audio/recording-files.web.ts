/**
 * Browser storage for voice notes. expo-file-system has no web version, and a recording's
 * blob: URL dies on reload, so the audio is stored as a data: URL in the recording row
 * (a 60 s note at 64 kbps is about 0.6 MB). Phase 2 moves recordings to Supabase Storage.
 */

export async function persistRecording(tempUri: string, _taskId: string): Promise<string> {
  if (tempUri.startsWith('data:')) return tempUri;
  const blob = await (await fetch(tempUri)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording'));
    reader.readAsDataURL(blob);
  });
  URL.revokeObjectURL(tempUri);
  return dataUrl;
}

/** data: URLs live in the row itself; only blob: URLs need releasing. */
export function deleteRecordingFile(uri: string): void {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}
