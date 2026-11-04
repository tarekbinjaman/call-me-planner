/**
 * Table-change bus. expo-sqlite's change listener feeds it (one event per changed row);
 * stores subscribe to the tables they show and reload once per burst of changes.
 */
type Listener = () => void;

const subscribers = new Map<string, Set<Listener>>();
const pending = new Set<Listener>();
let flushScheduled = false;

function flush() {
  flushScheduled = false;
  const listeners = [...pending];
  pending.clear();
  for (const listener of listeners) listener();
}

/** Call when a row in `table` changed. Many changes in one tick cause one reload per subscriber. */
export function notifyTableChanged(table: string) {
  const listeners = subscribers.get(table);
  if (!listeners) return;
  for (const l of listeners) pending.add(l);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(flush, 0);
  }
}

export function subscribeToTables(tables: string[], listener: Listener): () => void {
  for (const table of tables) {
    if (!subscribers.has(table)) subscribers.set(table, new Set());
    subscribers.get(table)!.add(listener);
  }
  return () => {
    for (const table of tables) subscribers.get(table)?.delete(listener);
  };
}
