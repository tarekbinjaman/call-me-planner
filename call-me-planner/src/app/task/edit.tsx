import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';

import { getRepos } from '@/data';
import {
  EMPTY_TASK_FORM,
  ESTIMATE_CHOICES,
  PRIORITIES,
  describeDay,
  formToTask,
  formatEstimate,
  quickDays,
  taskFormSchema,
  taskToForm,
  type TaskFormValues,
} from '@/domain/tasks';
import { useLiveQuery } from '@/stores/use-live-query';
import { useWorkspaces } from '@/stores/workspaces';
import { Button } from '@/ui/button';
import { ChoiceChips } from '@/ui/choice';
import { Field, TextField } from '@/ui/field';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';
import { useTheme } from '@/ui/use-theme';

const NONE = '__none__';

/**
 * New task: /task/edit (optional workspaceId, planId, scheduledDate to prefill)
 * Edit task: /task/edit?id=…
 */
export default function EditTaskScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    workspaceId?: string;
    planId?: string;
    scheduledDate?: string;
  }>();
  const id = params.id;
  const isNew = !id;
  const theme = useTheme();
  const workspaces = useWorkspaces((s) => s.items);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      ...EMPTY_TASK_FORM,
      workspaceId: params.workspaceId ?? null,
      planId: params.planId ?? null,
      scheduledDate: params.scheduledDate ?? '',
    },
  });

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const task = await (await getRepos()).tasks.getById(id);
      if (task) reset(taskToForm(task));
    })();
  }, [id, reset]);

  const workspaceId = useWatch({ control, name: 'workspaceId' });
  const scheduledDate = useWatch({ control, name: 'scheduledDate' });
  const mustDo = useWatch({ control, name: 'mustDo' });

  const plans = useLiveQuery(
    ['plan'],
    (r) =>
      workspaceId
        ? r.plans.getAll({ where: "workspace_id = ? AND status != 'done'", params: [workspaceId] })
        : Promise.resolve([]),
    [workspaceId],
  );

  const onSave = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const repos = await getRepos();
      const data = formToTask(values);
      if (id) {
        await repos.tasks.update(id, data);
        router.back();
      } else {
        const created = await repos.tasks.insert(data);
        router.replace({ pathname: '/task/[id]', params: { id: created.id } });
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  });

  const days = quickDays();

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New task' : 'Edit task' }} />
      <Screen kind="stack" title={isNew ? 'New task' : 'Edit task'}>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <Field label="Title" error={errors.title?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Send March invoice to client"
                invalid={!!errors.title}
                autoFocus={isNew}
                accessibilityLabel="Title"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="workspaceId"
          render={({ field }) => (
            <Field label="Workspace">
              <ChoiceChips
                options={[
                  ...workspaces.map((w) => ({ value: w.id, label: w.name })),
                  { value: NONE, label: 'Inbox' },
                ]}
                value={field.value ?? NONE}
                onChange={(v) => {
                  field.onChange(v === NONE ? null : v);
                  setValue('planId', null);
                }}
              />
            </Field>
          )}
        />

        {workspaceId && (plans.data?.length ?? 0) > 0 ? (
          <Controller
            control={control}
            name="planId"
            render={({ field }) => (
              <Field label="Plan (optional)">
                <ChoiceChips
                  options={[
                    { value: NONE, label: 'No plan' },
                    ...(plans.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  value={field.value ?? NONE}
                  onChange={(v) => field.onChange(v === NONE ? null : v)}
                />
              </Field>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="scheduledDate"
          render={({ field }) => (
            <Field
              label="Day"
              hint={field.value ? describeDay(field.value) : 'No day: the task waits until you schedule it.'}
              error={errors.scheduledDate?.message}>
              <ChoiceChips
                options={[
                  ...days.map((d) => ({ value: d.value, label: d.label })),
                  { value: NONE, label: 'No day' },
                ]}
                value={days.some((d) => d.value === field.value) ? field.value : field.value ? '' : NONE}
                onChange={(v) => {
                  field.onChange(v === NONE ? '' : v);
                  if (v === NONE) setValue('dueTime', '');
                }}
              />
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Or type a date: 2026-11-20"
                invalid={!!errors.scheduledDate}
                accessibilityLabel="Day"
                style={styles.medium}
              />
            </Field>
          )}
        />

        {scheduledDate ? (
          <Controller
            control={control}
            name="dueTime"
            render={({ field }) => (
              <Field
                label="Time (optional)"
                hint="Reminders ring around this time."
                error={errors.dueTime?.message}>
                <TextField
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="10:00"
                  invalid={!!errors.dueTime}
                  accessibilityLabel="Time"
                  style={styles.short}
                />
              </Field>
            )}
          />
        ) : errors.dueTime ? (
          <Text variant="small" color="alert">
            {errors.dueTime.message}
          </Text>
        ) : null}

        <Controller
          control={control}
          name="mustDo"
          render={({ field }) => (
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">Must do</Text>
                <Text variant="small" color="textMuted">
                  Must-do tasks get the full reminder ladder, up to the ring screen.
                </Text>
              </View>
              <Switch
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  if (!v) setValue('critical', false);
                }}
                accessibilityLabel="Must do"
                trackColor={{ true: theme.alert, false: theme.border }}
              />
            </View>
          )}
        />

        {mustDo ? (
          <Controller
            control={control}
            name="critical"
            render={({ field }) => (
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">Critical</Text>
                  <Text variant="small" color="textMuted">
                    Rings even during quiet hours (22:00–07:00).
                  </Text>
                </View>
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  accessibilityLabel="Critical"
                  trackColor={{ true: theme.alert, false: theme.border }}
                />
              </View>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Field label="Priority">
              <ChoiceChips options={PRIORITIES} value={field.value} onChange={(v) => field.onChange(v)} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="estimate"
          render={({ field }) => (
            <Field
              label="Estimate (minutes)"
              hint="Used for the daily hour budget."
              error={errors.estimate?.message}>
              <ChoiceChips
                options={[
                  ...ESTIMATE_CHOICES.map((m) => ({ value: String(m), label: formatEstimate(m) ?? '' })),
                  { value: NONE, label: 'None' },
                ]}
                value={field.value === '' ? NONE : field.value}
                onChange={(v) => field.onChange(v === NONE ? '' : v)}
              />
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="number-pad"
                placeholder="Or type minutes"
                invalid={!!errors.estimate}
                accessibilityLabel="Estimate in minutes"
                style={styles.short}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Field label="Notes (optional)" error={errors.notes?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                multiline
                placeholder="Links, details, who to call…"
                style={styles.multiline}
                accessibilityLabel="Notes"
              />
            </Field>
          )}
        />

        {saveError ? (
          <Text variant="small" color="alert">
            {`Couldn't save: ${saveError}`}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} style={styles.flex} />
          <Button
            label={isNew ? 'Create task' : 'Save'}
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
  short: { maxWidth: 140 },
  medium: { maxWidth: 240 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  flex: { flex: 1, minWidth: 0 },
});
