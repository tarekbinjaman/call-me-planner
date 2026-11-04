import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './button';
import { TextField } from './field';
import { Text } from './text';
import { Spacing } from './theme';

/** Single-line add bar: type, press Enter or Add. Keeps focus so you can add several in a row. */
export function QuickAdd({
  placeholder,
  onAdd,
  label = 'New task title',
}: {
  placeholder: string;
  onAdd: (title: string) => Promise<unknown>;
  label?: string;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(value);
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => void submit()}
            submitBehavior="submit"
            placeholder={placeholder}
            returnKeyType="done"
            accessibilityLabel={label}
            maxLength={200}
          />
        </View>
        <Button
          label="Add"
          variant="primary"
          onPress={() => void submit()}
          disabled={!title.trim() || busy}
        />
      </View>
      {error ? (
        <Text variant="small" color="alert">
          {`Couldn't add the task: ${error}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
