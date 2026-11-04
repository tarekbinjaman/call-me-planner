import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { getRepos } from '@/data';
import { WEEKDAYS } from '@/domain/dates';
import {
  hoursToMinutes,
  minutesToHours,
  workspaceFormSchema,
  type WorkspaceFormValues,
} from '@/domain/schemas';
import { Button } from '@/ui/button';
import { ChoiceChips } from '@/ui/choice';
import { Field, TextField } from '@/ui/field';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { Spacing, WORKSPACE_COLORS } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';
import { useWorkspaceColor } from '@/ui/workspace-color';

const EMPTY: WorkspaceFormValues = {
  name: '',
  kind: 'company',
  color: 'wsTeal',
  dailyHours: '4',
  hasWorkHours: false,
  workHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
};

export default function EditWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const theme = useTheme();
  const colorOf = useWorkspaceColor();
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceFormValues>({ resolver: zodResolver(workspaceFormSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const ws = await (await getRepos()).workspaces.getById(id);
      if (!ws) return;
      reset({
        name: ws.name,
        kind: ws.kind,
        color: ws.color,
        dailyHours: minutesToHours(ws.dailyCapacityMin),
        hasWorkHours: ws.workHours !== null,
        workHours: ws.workHours ?? EMPTY.workHours,
      });
    })();
  }, [id, reset]);

  const onSave = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const repos = await getRepos();
      const data = {
        name: values.name.trim(),
        kind: values.kind,
        color: values.color,
        dailyCapacityMin: hoursToMinutes(values.dailyHours),
        workHours: values.hasWorkHours ? values.workHours : null,
      };
      if (id) {
        await repos.workspaces.update(id, data);
        router.back();
      } else {
        const all = await repos.workspaces.getAll();
        const created = await repos.workspaces.insert({ ...data, sortOrder: all.length });
        router.replace({ pathname: '/workspace/[id]', params: { id: created.id } });
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  });

  const hasWorkHours = useWatch({ control, name: 'hasWorkHours' });

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New workspace' : 'Edit workspace' }} />
      <Screen kind="stack" title={isNew ? 'New workspace' : 'Edit workspace'}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field label="Name" error={errors.name?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Company A"
                invalid={!!errors.name}
                autoFocus={isNew}
                accessibilityLabel="Name"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Field label="Type">
              <ChoiceChips
                options={[
                  { value: 'company', label: 'Company' },
                  { value: 'personal', label: 'Personal' },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v)}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <Field label="Color">
              <View style={styles.swatches} accessibilityRole="radiogroup">
                {WORKSPACE_COLORS.map((token) => {
                  const selected = field.value === token;
                  return (
                    <Pressable
                      key={token}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityLabel={token.replace('ws', '')}
                      onPress={() => field.onChange(token)}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: colorOf(token),
                          borderColor: selected ? theme.text : 'transparent',
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="dailyHours"
          render={({ field }) => (
            <Field
              label="Hours per day"
              hint="Today warns you when you plan more than this."
              error={errors.dailyHours?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                invalid={!!errors.dailyHours}
                accessibilityLabel="Hours per day"
                style={styles.short}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="hasWorkHours"
          render={({ field }) => (
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Working hours</Text>
                <Text variant="small" color="textMuted">
                  Used later for focus mode and to time reminders.
                </Text>
              </View>
              <Switch
                value={field.value}
                onValueChange={field.onChange}
                accessibilityLabel="Set working hours"
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            </View>
          )}
        />

        {hasWorkHours ? (
          <>
            <Controller
              control={control}
              name="workHours.days"
              render={({ field }) => (
                <Field label="Days" error={errors.workHours?.days?.message}>
                  <ChoiceChips
                    multiple
                    options={WEEKDAYS.map((d) => ({ value: d.value as number, label: d.short }))}
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                  />
                </Field>
              )}
            />
            <View style={styles.timeRow}>
              <Controller
                control={control}
                name="workHours.start"
                render={({ field }) => (
                  <View style={styles.flex}>
                    <Field label="Start" error={errors.workHours?.start?.message}>
                      <TextField
                        value={field.value}
                        onChangeText={field.onChange}
                        placeholder="09:00"
                        invalid={!!errors.workHours?.start}
                        accessibilityLabel="Start time"
                      />
                    </Field>
                  </View>
                )}
              />
              <Controller
                control={control}
                name="workHours.end"
                render={({ field }) => (
                  <View style={styles.flex}>
                    <Field label="End" error={errors.workHours?.end?.message}>
                      <TextField
                        value={field.value}
                        onChangeText={field.onChange}
                        placeholder="17:00"
                        invalid={!!errors.workHours?.end}
                        accessibilityLabel="End time"
                      />
                    </Field>
                  </View>
                )}
              />
            </View>
          </>
        ) : null}

        {saveError ? (
          <Text variant="small" color="alert">
            {`Couldn't save: ${saveError}`}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} style={styles.flex} />
          <Button
            label={isNew ? 'Create workspace' : 'Save'}
            variant="primary"
            onPress={() => void onSave()}
            disabled={isSubmitting}
            style={styles.flex}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  short: { maxWidth: 120 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  timeRow: { flexDirection: 'row', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
});
