// Individual step components for onboarding wizard

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { OnboardingStep, SchoolType, PlanTier, InviteResult, TemplateOption } from './types';
import { SCHOOL_TYPES, PLAN_TIERS, AVAILABLE_TEMPLATES } from './types';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface TypeSelectionStepProps {
  schoolType: SchoolType;
  onSelectType: (type: SchoolType) => void;
  onContinue: () => void;
}

export function TypeSelectionStep({ schoolType, onSelectType, onContinue }: TypeSelectionStepProps) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>What type of educational institution do you run?</Text>
      <View style={styles.typeContainer}>
        {SCHOOL_TYPES.map(type => (
          <TouchableOpacity key={type.id} style={[styles.typeOption, schoolType === type.id && styles.typeOptionActive]}
            onPress={() => onSelectType(type.id)}>
            <View style={[styles.typeRadio, schoolType === type.id && styles.typeRadioActive]} />
            <View style={styles.typeContent}>
              <Text style={[styles.typeName, schoolType === type.id && styles.typeNameActive]}>{type.name}</Text>
              <Text style={styles.typeDesc}>{type.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

interface DetailsStepProps {
  schoolName: string; adminName: string; phone: string; planTier: PlanTier;
  onChangeSchoolName: (v: string) => void; onChangeAdminName: (v: string) => void;
  onChangePhone: (v: string) => void; onChangePlanTier: (t: PlanTier) => void;
  canCreate: boolean; creating: boolean; onCreate: () => void;
}

export function DetailsStep({ schoolName, adminName, phone, planTier, onChangeSchoolName, onChangeAdminName, onChangePhone, onChangePlanTier, canCreate, creating, onCreate }: DetailsStepProps) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>School name</Text>
      <TextInput style={styles.input} value={schoolName} onChangeText={onChangeSchoolName} placeholder="e.g. Bright Beginnings School" autoCapitalize="words" />
      <Text style={styles.label}>Your name</Text>
      <TextInput style={styles.input} value={adminName} onChangeText={onChangeAdminName} placeholder="Principal full name" autoCapitalize="words" />
      <Text style={styles.label}>School phone (optional)</Text>
      <TextInput style={styles.input} value={phone} onChangeText={onChangePhone} placeholder="+27-.." keyboardType="phone-pad" />
      <View style={{ marginTop: 12 }}>
        <Text style={styles.label}>Plan tier</Text>
        <View style={styles.pillRow}>
          {PLAN_TIERS.map(t => (
            <TouchableOpacity key={t} style={[styles.pill, planTier === t && styles.pillActive]} onPress={() => onChangePlanTier(t)}>
              <Text style={[styles.pillText, planTier === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity disabled={!canCreate || creating} style={[styles.button, (!canCreate || creating) && styles.buttonDisabled]} onPress={onCreate}>
        {creating ? <EduDashSpinner color="#000" /> : <Text style={styles.buttonText}>Create school & Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

interface InvitesStepProps {
  emailInput: string; emails: string[]; sentInvites: InviteResult[];
  sendingInvites: boolean; onChangeEmailInput: (v: string) => void;
  onAddEmail: () => void; onRemoveEmail: (e: string) => void;
  onSendInvites: () => void; onBack: () => void;
}

export function InvitesStep({ emailInput, emails, sentInvites, sendingInvites, onChangeEmailInput, onAddEmail, onRemoveEmail, onSendInvites, onBack }: InvitesStepProps) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>Invite teachers (optional)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={emailInput} onChangeText={onChangeEmailInput} placeholder="teacher@example.com" keyboardType="email-address" autoCapitalize="none" />
        <TouchableOpacity style={styles.smallButton} onPress={onAddEmail}><Text style={styles.smallButtonText}>Add</Text></TouchableOpacity>
      </View>
      {emails.length > 0 && <View style={{ marginTop: 8 }}>{emails.map(e => (
        <View key={e} style={styles.emailRow}><Text style={styles.emailText}>{e}</Text>
          <TouchableOpacity onPress={() => onRemoveEmail(e)}><Text style={[styles.emailText, { color: '#f87171' }]}>Remove</Text></TouchableOpacity>
        </View>
      ))}</View>}
      <TouchableOpacity disabled={sendingInvites} style={[styles.button, sendingInvites && styles.buttonDisabled]} onPress={onSendInvites}>
        {sendingInvites ? <EduDashSpinner color="#000" /> : <Text style={styles.buttonText}>{emails.length ? 'Send invites & Continue' : 'Skip & Continue'}</Text>}
      </TouchableOpacity>
      {sentInvites.length > 0 && <View style={{ marginTop: 8 }}>{sentInvites.map((r, i) => <Text key={i} style={styles.hint}>• {r.email}: {r.status}</Text>)}</View>}
      <TouchableOpacity onPress={onBack} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
    </View>
  );
}

interface TemplatesStepProps {
  selectedTemplates: string[]; onToggleTemplate: (id: string) => void;
  onContinue: () => void; onSkip: () => void; onBack: () => void;
}

export function TemplatesStep({ selectedTemplates, onToggleTemplate, onContinue, onSkip, onBack }: TemplatesStepProps) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>Starter templates (optional)</Text>
      {AVAILABLE_TEMPLATES.map(t => (
        <TouchableOpacity key={t.id} style={styles.templateRow} onPress={() => onToggleTemplate(t.id)}>
          <View style={[styles.checkbox, selectedTemplates.includes(t.id) && styles.checkboxChecked]} />
          <Text style={styles.templateText}>{t.name}</Text>
        </TouchableOpacity>
      ))}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={onContinue}><Text style={styles.buttonText}>Continue</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={onSkip}><Text style={styles.secondaryButtonText}>Skip</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onBack} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
    </View>
  );
}

interface ReviewStepProps {
  schoolName: string; planTier: PlanTier; emailCount: number; templateCount: number;
  onFinish: () => void; onBack: () => void;
}

export function ReviewStep({ schoolName, planTier, emailCount, templateCount, onFinish, onBack }: ReviewStepProps) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>Review</Text>
      <Text style={styles.hint}>School: <Text style={{ color: '#fff' }}>{schoolName}</Text></Text>
      <Text style={styles.hint}>Plan: <Text style={{ color: '#fff' }}>{planTier}</Text></Text>
      <Text style={styles.hint}>Invites: <Text style={{ color: '#fff' }}>{emailCount}</Text></Text>
      <Text style={styles.hint}>Templates: <Text style={{ color: '#fff' }}>{templateCount}</Text></Text>
      <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={onFinish}><Text style={styles.buttonText}>Finish setup & Go to dashboard</Text></TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={styles.linkBtn}><Text style={styles.linkText}>Back</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#E5E7EB', marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937', padding: 12 },
  button: { marginTop: 18, backgroundColor: '#00f5ff', padding: 12, borderRadius: 10, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#000', fontWeight: '800' },
  hint: { color: '#9CA3AF', marginTop: 6, fontSize: 13 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#1f2937', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0b1220' },
  pillActive: { backgroundColor: '#0ea5b6' },
  pillText: { color: '#9CA3AF' },
  pillTextActive: { color: '#001011', fontWeight: '800' },
  smallButton: { backgroundColor: '#00f5ff', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#000', fontWeight: '800' },
  emailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  emailText: { color: '#E5E7EB' },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  templateText: { color: '#E5E7EB' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#1f2937', backgroundColor: '#0b1220' },
  checkboxChecked: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  secondaryButton: { marginTop: 18, backgroundColor: '#0b1220', borderWidth: 1, borderColor: '#1f2937', padding: 12, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#E5E7EB', fontWeight: '700' },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  linkText: { color: '#00f5ff', textDecorationLine: 'underline' },
  typeContainer: { gap: 12, marginTop: 12, marginBottom: 16 },
  typeOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, padding: 12, gap: 12 },
  typeOptionActive: { borderColor: '#00f5ff', backgroundColor: '#0b1f26' },
  typeRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#1f2937' },
  typeRadioActive: { backgroundColor: '#00f5ff', borderColor: '#00f5ff' },
  typeContent: { flex: 1 },
  typeName: { color: '#E5E7EB', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  typeNameActive: { color: '#00f5ff' },
  typeDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
});
