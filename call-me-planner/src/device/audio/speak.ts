import * as Speech from 'expo-speech';

/**
 * Fallback when a task has no voice note: read its title aloud with the phone's
 * text-to-speech. Note: iPhones in silent mode don't play speech.
 */
export function speakTaskTitle(title: string, onDone?: () => void): void {
  void Speech.stop();
  Speech.speak(title, { rate: 0.95, onDone, onStopped: onDone, onError: onDone });
}

export function stopSpeaking(): Promise<void> {
  return Speech.stop();
}
