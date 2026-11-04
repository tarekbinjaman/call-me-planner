import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { getRepos } from '@/data';
import { formatShortDate, quickDates } from '@/domain/dates';
import { planFormSchema, type PlanFormValues } from '@/domain/schemas';
import { Button, ConfirmDeleteButton } from '@/ui/button';
import { ChoiceChips } from '@/ui/choice';
import { Field, TextField } from '@/ui/field';
import { Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { Spacing } from '@/ui/theme';

const EMPTY: PlanFormValues = { name: '', goal: '', status: 'active', targetDate: '' };

/** New plan: /plan/edit?workspaceId=… · Edit plan: /plan/edit?id=… */
export default function EditPlanScreen() {
  const params = useLocalSearchParams<{ id?: string; workspaceId?: string }>();
  const id = params.id;
  const isNew = !id;
  const [workspaceId, setWorkspaceId] = useState(params.workspaceId ?? null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({ resolver: zodResolver(planFormSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const plan = await (await getRepos()).plans.getById(id);
      if (!plan) return;
      setWorkspaceId(plan.workspaceId);
      reset({
        name: plan.name,
        goal: plan.goal ?? '',
        status: plan.status,
        targetDate: plan.targetDate ?? '',
      });
    })();
  }, [id, reset]);

  const onSave = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const repos = await getRepos();
      const data = {
        name: values.name.trim(),
        goal: values.goal.trim() || null,
        status: values.status,
        targetDate: values.targetDate || null,
      };
      if (id) {
        await repos.plans.update(id, data);
        router.back();
      } else {
        if (!workspaceId) throw new Error('No workspace was chosen for this plan.');
        const existing = await repos.plans.getAll({ where: 'workspace_id = ?', params: [workspaceId] });
        const created = await repos.plans.insert({ ...data, workspaceId, sortOrder: existing.length });
        router.replace({ pathname: '/plan/[id]', params: { id: created.id } });
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  });

  async function onDelete() {
    if (!id) return;
    const repos = await getRepos();
    // Keep the plan's tasks: they stay in the workspace, just without a plan.
    const tasks = await repos.tasks.getAll({ where: 'plan_id = ?', params: [id] });
    for (const t of tasks) await repos.tasks.update(t.id, { planId: null });
    await repos.plans.softDelete(id);
    if (workspaceId) router.dismissTo({ pathname: '/workspace/[id]', params: { id: workspaceId } });
    else router.back();
  }

  const targetDate = useWatch({ control, name: 'targetDate' });

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New plan' : 'Edit plan' }} />
      <Screen kind="stack" title={isNew ? 'New plan' : 'Edit plan'}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Field label="Name" error={errors.name?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Launch the new website"
                invalid={!!errors.name}
                autoFocus={isNew}
                accessibilityLabel="Plan name"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="goal"
          render={({ field }) => (
            <Field label="Goal (optional)" hint="What does done look like?" error={errors.goal?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Site live with the new pricing page"
                multiline
                style={styles.multiline}
                accessibilityLabel="Goal"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Field label="Status" hint="Paused plans stay out of the way until you pick them up again.">
              <ChoiceChips
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'done', label: 'Done' },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v)}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="targetDate"
          render={({ field }) => (
            <Field
              label="Target date (optional)"
              hint={targetDate ? formatShortDate(targetDate) : 'YYYY-MM-DD, or pick one below.'}
              error={errors.targetDate?.message}>
              <TextField
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="2026-12-31"
                invalid={!!errors.targetDate}
                accessibilityLabel="Target date"
                style={styles.short}
              />
            </Field>
          )}
        />
        <View style={styles.quickRow}>
          {quickDates().map((q) => (
            <Button
              key={q.label}
              label={q.label}
              onPress={() => setValue('targetDate', q.value, { shouldValidate: true })}
            />
          ))}
          {targetDate ? (
            <Button
              label="No date"
              variant="ghost"
              onPress={() => setValue('targetDate', '', { shouldValidate: true })}
            />
          ) : null}
        </View>

        {saveError ? (
          <Text variant="small" color="alert">
            {`Couldn't save: ${saveError}`}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} style={styles.flex} />
          <Button
            label={isNew ? 'Create plan' : 'Save'}
            variant="primary"
            onPress={() => void onSave()}
            disabled={isSubmitting}
            style={styles.flex}
          />
        </View>

        {!isNew ? (
          <View style={styles.danger}>
            <Text variant="small" color="textMuted">
              Deleting the plan keeps its tasks in the workspace.
            </Text>
            <ConfirmDeleteButton label="Delete plan" onConfirm={onDelete} />
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  short: { maxWidth: 180 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: -Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  danger: { gap: Spacing.sm, marginTop: Spacing.lg },
  flex: { flex: 1, minWidth: 0 },
});
