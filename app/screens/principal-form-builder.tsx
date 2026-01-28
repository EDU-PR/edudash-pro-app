import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCapability } from '@/hooks/useCapability';
import { useOrganizationTerminology } from '@/lib/hooks/useOrganizationTerminology';
import { extractOrganizationId } from '@/lib/tenant/compat';
import { FormBuilderService } from '@/features/forms/services/FormBuilderService';
import { FIELD_TYPE_VALUES } from '@/features/forms/types/form.types';
import type {
  CreateOrganizationFormInput,
  FormStatus,
  FieldType,
  FormAudience,
  FormField,
} from '@/features/forms/types/form.types';

type IoniconName = keyof typeof Ionicons.glyphMap;

const FIELD_TYPES: Array<{ id: FieldType; label: string; icon: IoniconName }> = [
  { id: 'short_text', label: 'Short Text', icon: 'text' },
  { id: 'long_text', label: 'Long Text', icon: 'document-text' },
  { id: 'number', label: 'Number', icon: 'calculator' },
  { id: 'date', label: 'Date', icon: 'calendar' },
  { id: 'dropdown', label: 'Dropdown', icon: 'list' },
  { id: 'multi_select', label: 'Multi‑select', icon: 'options' },
  { id: 'file', label: 'File Upload', icon: 'cloud-upload' },
  { id: 'consent', label: 'Consent', icon: 'checkbox' },
  { id: 'fee_item', label: 'Fee Item', icon: 'wallet' },
];

const createField = (label: string, type: FieldType, required = false, options?: string[]): FormField => ({
  id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  label,
  required,
  options,
});

const FormSchema = z.object({
  title: z.string().min(2, 'Add a form title.'),
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(2, 'Each field needs a label.'),
      type: z.enum(FIELD_TYPE_VALUES),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
    })
  ).min(1, 'Add at least one field.'),
});

type ProgressStep = { id: string; label: string; status: 'pending' | 'active' | 'done' };

export default function PrincipalFormBuilderScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { can, ready } = useCapability();
  const canUseBuilder = ready ? can('agent.workflows') : false;
  const { terminology } = useOrganizationTerminology();
  const { profile } = useAuth();
  const organizationId = extractOrganizationId(profile);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<FormAudience[]>(['parents']);
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [formId, setFormId] = useState<string | null>(null);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audienceLabels: Record<FormAudience, string> = useMemo(
    () => ({
      parents: terminology.guardians,
      teachers: terminology.instructors,
      staff: 'Staff',
    }),
    [terminology.guardians, terminology.instructors]
  );

  const toggleAudience = (target: FormAudience) => {
    setAudience((prev) => (
      prev.includes(target) ? prev.filter((item) => item !== target) : [...prev, target]
    ));
  };

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: '',
      required: false,
      options: type === 'dropdown' || type === 'multi_select' ? ['Option 1'] : undefined,
    };
    setFields((prev) => [...prev, newField]);
  };

  const templates = useMemo(
    () => [
      {
        id: 'excursion',
        title: 'Excursion Consent',
        description: 'Capture consent, allergies, emergency contact details, and payment.',
        audience: ['parents'] as FormAudience[],
        fields: [
          createField('Excursion date', 'date', true),
          createField('Emergency contact', 'short_text', true),
          createField('Allergies / medical notes', 'long_text'),
          createField('Consent approval', 'consent', true),
          createField('Excursion fee', 'fee_item'),
        ],
      },
      {
        id: 'parent_workshop',
        title: `${terminology.guardians} Workshop RSVP`,
        description: `Plan a workshop and capture attendance preferences and questions.`,
        audience: ['parents'] as FormAudience[],
        fields: [
          createField('Workshop date', 'date', true),
          createField('Number of attendees', 'number', true),
          createField('Topics you want covered', 'multi_select', false, ['Behaviour', 'Literacy', 'Numeracy', 'Other']),
          createField('Questions for the facilitator', 'long_text'),
        ],
      },
      {
        id: 'staff_training',
        title: `${terminology.instructors} Training RSVP`,
        description: `Collect training attendance, feedback, and availability.`,
        audience: ['teachers', 'staff'] as FormAudience[],
        fields: [
          createField('Training date', 'date', true),
          createField('Preferred session', 'dropdown', true, ['Morning', 'Afternoon']),
          createField('Questions or focus areas', 'long_text'),
        ],
      },
    ],
    [terminology.guardians, terminology.instructors]
  );

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.title);
    setDescription(template.description);
    setAudience(template.audience);
    setFields(template.fields);
  };

  const suggestedFields = useMemo(() => {
    const text = `${title} ${description}`.toLowerCase();
    const suggestions: FormField[] = [];
    if (text.includes('excursion') || text.includes('trip')) {
      suggestions.push(createField('Emergency contact', 'short_text', true));
      suggestions.push(createField('Consent approval', 'consent', true));
      suggestions.push(createField('Excursion fee', 'fee_item'));
    }
    if (text.includes('workshop') || text.includes('meeting')) {
      suggestions.push(createField('Preferred time', 'dropdown', true, ['Morning', 'Afternoon', 'Evening']));
      suggestions.push(createField('Questions for the host', 'long_text'));
    }
    if (text.includes('uniform')) {
      suggestions.push(createField('Uniform size', 'dropdown', true, ['XS', 'S', 'M', 'L', 'XL']));
      suggestions.push(createField('Uniform quantity', 'number'));
    }
    return suggestions;
  }, [title, description]);

  const insights = useMemo(() => {
    const notes: string[] = [];
    if (fields.length === 0) {
      notes.push('Add at least one field so people know what to respond to.');
    }
    if (fields.length > 0 && !fields.some((field) => field.required)) {
      notes.push('Mark at least one field as required to prevent empty submissions.');
    }
    if (description.toLowerCase().includes('fee') && !fields.some((field) => field.type === 'fee_item')) {
      notes.push('Consider adding a Fee Item field to capture payment details.');
    }
    if (audience.length === 0) {
      notes.push('Select at least one audience so we know who should receive the form.');
    }
    return notes;
  }, [fields, description, audience.length]);

  const applySuggestions = () => {
    if (suggestedFields.length === 0) return;
    const existingLabels = new Set(fields.map((field) => field.label.toLowerCase().trim()));
    const next = suggestedFields.filter((field) => !existingLabels.has(field.label.toLowerCase().trim()));
    if (next.length === 0) return;
    setFields((prev) => [...prev, ...next]);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((field) => field.id !== id));
  };

  const startProgress = () => {
    setProgressSteps([
      { id: 'validate', label: 'Validating form', status: 'active' },
      { id: 'save', label: 'Saving draft', status: 'pending' },
      { id: 'notify', label: 'Preparing notifications', status: 'pending' },
    ]);

    progressTimerRef.current = setInterval(() => {
      setProgressSteps((prev) => {
        const next = [...prev];
        const activeIndex = next.findIndex((step) => step.status === 'active');
        if (activeIndex === -1) return next;
        next[activeIndex] = { ...next[activeIndex], status: 'done' };
        if (activeIndex + 1 < next.length) {
          next[activeIndex + 1] = { ...next[activeIndex + 1], status: 'active' };
        }
        return next;
      });
    }, 1800);
  };

  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopProgress();
  }, []);

  const validateForm = useCallback(() => {
    const result = FormSchema.safeParse({ title, fields });
    if (!result.success) {
      Alert.alert('Validation', result.error.errors[0]?.message || 'Please complete the form.');
      return false;
    }
    if (audience.length === 0) {
      Alert.alert('Validation', 'Select at least one audience.');
      return false;
    }
    if (!organizationId) {
      Alert.alert('Validation', 'Organization not found. Please refresh and try again.');
      return false;
    }
    return true;
  }, [title, fields, audience.length, organizationId]);

  const buildPayload = (status: FormStatus): CreateOrganizationFormInput => ({
    organizationId: organizationId || '',
    title: title.trim(),
    description: description.trim() ? description.trim() : null,
    audience,
    fields,
    status,
  });

  const persistForm = async (status: FormStatus) => {
    if (!canUseBuilder) {
      Alert.alert('Premium Feature', 'Form Builder is available on Premium/Pro tiers.');
      return;
    }
    if (!validateForm()) return;

    setSaving(true);
    startProgress();

    try {
      const payload = buildPayload(status);
      const savedForm = formId
        ? await FormBuilderService.updateForm(formId, payload)
        : await FormBuilderService.createForm(payload);

      setFormId(savedForm.id);

      if (status === 'published') {
        await FormBuilderService.notifyFormPublished({
          organizationId: savedForm.organization_id,
          formId: savedForm.id,
          title: savedForm.title,
          audience: payload.audience,
        });
      }

      stopProgress();
      setProgressSteps((prev) => prev.map((step) => ({ ...step, status: 'done' })));
      setSaving(false);

      if (status === 'published') {
        Alert.alert('Published', `${terminology.guardians} and ${terminology.instructors} will see the form in their dashboards.`);
      } else {
        Alert.alert('Draft Saved', 'Your form draft is ready.');
      }
    } catch (error) {
      stopProgress();
      setSaving(false);
      const message = error instanceof Error ? error.message : 'Failed to save the form.';
      Alert.alert('Error', message);
    }
  };

  const handleSaveDraft = async () => persistForm('draft');
  const handlePublish = async () => persistForm('published');

  const openDashAdvisor = () => {
    const summary = `Help me refine this form.\nTitle: ${title}\nAudience: ${audience.map((role) => audienceLabels[role]).join(', ')}\nFields: ${fields.map((f) => `${f.label || '(unlabeled)'} (${f.type})`).join(', ')}`;
    router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: summary } });
  };

  if (!ready) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Form Builder', headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Form Builder</Text>
        <TouchableOpacity onPress={openDashAdvisor} style={styles.askDash}>
          <Ionicons name="sparkles" size={16} color={theme.primary} />
          <Text style={[styles.askDashText, { color: theme.primary }]}>Ask Dash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!canUseBuilder && (
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Premium Feature</Text>
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Form Builder is available on Premium/Pro tiers.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/screens/subscription-setup')}
            >
              <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Start from a template</Text>
          <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Kick‑start common workflows and customize from there.</Text>
          <View style={styles.templateRow}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateChip, { borderColor: theme.border }]}
                onPress={() => applyTemplate(template.id)}
              >
                <Text style={[styles.templateTitle, { color: theme.text }]}>{template.title}</Text>
                <Text style={[styles.templateBody, { color: theme.textSecondary }]}>{template.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Dash suggestions</Text>
          {suggestedFields.length === 0 ? (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Add a title or description to get smarter suggestions.</Text>
          ) : (
            <>
              <View style={styles.suggestionRow}>
                {suggestedFields.map((field) => (
                  <View key={field.id} style={[styles.suggestionPill, { borderColor: theme.border }]}>
                    <Text style={[styles.suggestionText, { color: theme.text }]}>{field.label}</Text>
                    <Text style={[styles.suggestionMeta, { color: theme.textSecondary }]}>{field.type}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.border, alignSelf: 'flex-start' }]}
                onPress={applySuggestions}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Add suggestions</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Form health</Text>
          {insights.length === 0 ? (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Your form looks solid. Ready to publish.</Text>
          ) : (
            insights.map((note, index) => (
              <View key={`${note}-${index}`} style={styles.insightRow}>
                <Ionicons name="bulb-outline" size={16} color={theme.primary} />
                <Text style={[styles.insightText, { color: theme.text }]}>{note}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>Form details</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Excursion Consent"
            placeholderTextColor={theme.textSecondary}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details"
            placeholderTextColor={theme.textSecondary}
            multiline
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Audience</Text>
          <View style={styles.chipRow}>
            {(['parents', 'teachers', 'staff'] as Audience[]).map((role) => {
              const active = audience.includes(role);
              return (
                <TouchableOpacity
                  key={role}
                  style={[styles.chip, { backgroundColor: active ? theme.primary : theme.surface, borderColor: theme.border }]}
                  onPress={() => toggleAudience(role)}
                >
                  <Text style={{ color: active ? theme.onPrimary : theme.text }}>{audienceLabels[role]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>Add fields</Text>
          <View style={styles.fieldPalette}>
            {FIELD_TYPES.map((field) => (
              <TouchableOpacity
                key={field.id}
                style={[styles.paletteChip, { borderColor: theme.border }]}
                onPress={() => addField(field.id)}
              >
                <Ionicons name={field.icon} size={14} color={theme.primary} />
                <Text style={[styles.paletteText, { color: theme.text }]}>{field.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>Fields</Text>
          {fields.length === 0 ? (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Add fields to build your form.</Text>
          ) : (
            fields.map((field) => (
              <View key={field.id} style={[styles.fieldRow, { borderColor: theme.border }]}> 
                <View style={styles.fieldHeader}>
                  <Text style={[styles.fieldType, { color: theme.primary }]}>{field.type.replace('_', ' ')}</Text>
                  <TouchableOpacity onPress={() => removeField(field.id)}>
                    <Ionicons name="trash" size={16} color={theme.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  value={field.label}
                  onChangeText={(value) => updateField(field.id, { label: value })}
                  placeholder="Field label"
                  placeholderTextColor={theme.textSecondary}
                />

                {(field.type === 'dropdown' || field.type === 'multi_select') && (
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    value={(field.options || []).join(', ')}
                    onChangeText={(value) =>
                      updateField(field.id, {
                        options: value.split(',').map((v) => v.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Options, comma separated"
                    placeholderTextColor={theme.textSecondary}
                  />
                )}

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => updateField(field.id, { required: !field.required })}
                >
                  <Ionicons
                    name={field.required ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={field.required ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.checkboxLabel, { color: theme.text }]}>Required</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>Preview</Text>
          {fields.length === 0 ? (
            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>Your preview will appear here.</Text>
          ) : (
            fields.map((field) => (
              <View key={`preview_${field.id}`} style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: theme.text }]}>{field.label || 'Untitled field'}</Text>
                <Text style={[styles.previewType, { color: theme.textSecondary }]}>{field.type}</Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}> 
          <Text style={[styles.cardTitle, { color: theme.text }]}>Publishing</Text>
          {progressSteps.length > 0 && (
            <View style={styles.progressBlock}>
              {progressSteps.map((step) => (
                <View key={step.id} style={styles.progressRow}>
                  <Ionicons
                    name={step.status === 'done' ? 'checkmark-circle' : 'ellipse'}
                    size={16}
                    color={step.status === 'done' ? theme.success : theme.textSecondary}
                  />
                  <Text style={[styles.progressText, { color: theme.text }]}>{step.label}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={handleSaveDraft}
              disabled={saving}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handlePublish}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={theme.onPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Publish</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: { marginRight: 12 },
    title: { fontSize: 18, fontWeight: '700', flex: 1 },
    askDash: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    askDashText: { fontSize: 12, fontWeight: '700' },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    cardBody: { fontSize: 13, lineHeight: 18 },
    label: { marginTop: 10, marginBottom: 4, fontSize: 12 },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
    },
    textArea: { minHeight: 70, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    templateRow: { gap: 10, marginTop: 10 },
    templateChip: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
    },
    templateTitle: { fontSize: 13, fontWeight: '700' },
    templateBody: { fontSize: 12, marginTop: 4 },
    suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    suggestionPill: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    suggestionText: { fontSize: 12, fontWeight: '600' },
    suggestionMeta: { fontSize: 11, marginTop: 2 },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 8,
    },
    insightText: { fontSize: 12, lineHeight: 18 },
    fieldPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    paletteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    paletteText: { fontSize: 12, fontWeight: '600' },
    fieldRow: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      gap: 8,
    },
    fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fieldType: { fontSize: 12, fontWeight: '700' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    checkboxLabel: { fontSize: 12, fontWeight: '600' },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    previewLabel: { fontSize: 13, fontWeight: '600' },
    previewType: { fontSize: 12 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
    primaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
    },
    primaryButtonText: { fontWeight: '700' },
    secondaryButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
    },
    secondaryButtonText: { fontWeight: '600' },
    progressBlock: { marginTop: 8 },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    progressText: { fontSize: 12 },
  });
