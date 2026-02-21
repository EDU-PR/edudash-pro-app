import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { useStationeryChecklist } from '@/hooks/useStationeryChecklist';

interface ChildRow {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
  preschoolId?: string | null;
  preschool_id?: string | null;
  organizationId?: string | null;
  organization_id?: string | null;
}

interface Props {
  children: ChildRow[];
}

export const StationeryChecklistSection: React.FC<Props> = ({ children }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    academicYear,
    checklists,
    loading,
    error,
    savingItemKey,
    savingNoteChildId,
    upsertItemState,
    saveNote,
    uploadEvidence,
  } = useStationeryChecklist(children);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [expectedByDraft, setExpectedByDraft] = useState<Record<string, string>>({});

  const handlePickEvidence = async (childId: string, itemId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;

    await uploadEvidence(childId, itemId, uri);
  };

  if (!children.length) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface }]}> 
        <Text style={styles.emptyText}>Add a child to track stationery requirements.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.inlineRow}>
        <Text style={styles.muted}>Loading stationery checklist...</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.meta}>Academic year: {academicYear}</Text>
      {checklists.map((childChecklist) => {
        const childNotes = notesDraft[childChecklist.childId] ?? childChecklist.noteText;
        const childExpectedBy = expectedByDraft[childChecklist.childId] ?? childChecklist.expectedBy;

        return (
          <View key={childChecklist.childId} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{childChecklist.childName}</Text>
                <Text style={styles.subtle}>{childChecklist.listLabel} checklist</Text>
              </View>
              <View style={styles.progressPill}>
                <Ionicons name="checkmark-done-outline" size={14} color={theme.primary} />
                <Text style={styles.progressText}>{childChecklist.completionPercent}%</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bought: {childChecklist.boughtCount}</Text>
              <Text style={styles.summaryLabel}>Still needed: {childChecklist.remainingCount}</Text>
            </View>

            {childChecklist.items.map((item) => {
              const key = `${childChecklist.childId}:${item.itemId}`;
              const isSaving = savingItemKey === key;

              return (
                <View key={item.itemId} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity
                      style={[styles.checkbox, item.isBought && styles.checkboxActive]}
                      onPress={() => {
                        void upsertItemState(childChecklist.childId, item.itemId, {
                          isBought: !item.isBought,
                        });
                      }}
                    >
                      {item.isBought && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.itemName}</Text>
                      <Text style={styles.itemMeta}>
                        Required: {item.requiredQuantity} {item.unitLabel}
                      </Text>
                      {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.itemActionsRow}>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const next = Math.max(0, item.quantityBought - 1);
                          void upsertItemState(childChecklist.childId, item.itemId, {
                            quantityBought: next,
                            isBought: next > 0 ? item.isBought : false,
                          });
                        }}
                      >
                        <Ionicons name="remove" size={14} color={theme.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantityBought}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => {
                          const next = item.quantityBought + 1;
                          void upsertItemState(childChecklist.childId, item.itemId, {
                            quantityBought: next,
                          });
                        }}
                      >
                        <Ionicons name="add" size={14} color={theme.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.evidenceBtn}
                      onPress={() => {
                        void handlePickEvidence(childChecklist.childId, item.itemId);
                      }}
                    >
                      <Ionicons name="camera-outline" size={14} color={theme.primary} />
                      <Text style={styles.evidenceText}>
                        {item.evidenceUrl ? 'Photo added' : 'Add photo'}
                      </Text>
                    </TouchableOpacity>

                    {isSaving ? (
                      <Text style={styles.savingText}>Saving...</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}

            <View style={styles.notesBlock}>
              <Text style={styles.notesTitle}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="What remains and when will it be received?"
                placeholderTextColor={theme.textSecondary}
                multiline
                value={childNotes}
                onChangeText={(value) =>
                  setNotesDraft((prev) => ({
                    ...prev,
                    [childChecklist.childId]: value,
                  }))
                }
              />
              <TextInput
                style={styles.dateInput}
                placeholder="Expected by (YYYY-MM-DD)"
                placeholderTextColor={theme.textSecondary}
                value={childExpectedBy}
                onChangeText={(value) =>
                  setExpectedByDraft((prev) => ({
                    ...prev,
                    [childChecklist.childId]: value,
                  }))
                }
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.saveNoteBtn}
                onPress={() => {
                  void saveNote(childChecklist.childId, childNotes, childExpectedBy);
                }}
              >
                <Ionicons name="save-outline" size={15} color="#fff" />
                <Text style={styles.saveNoteText}>
                  {savingNoteChildId === childChecklist.childId ? 'Saving note...' : 'Save note'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.surface,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    childName: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 16,
    },
    subtle: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    meta: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    progressPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    progressText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    summaryLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    itemCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 10,
      gap: 8,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    itemName: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
    },
    itemMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    itemNotes: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 4,
      fontStyle: 'italic',
    },
    itemActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    qtyControl: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    qtyBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.surface,
    },
    qtyValue: {
      minWidth: 28,
      textAlign: 'center',
      color: theme.text,
      fontWeight: '700',
    },
    evidenceBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    evidenceText: {
      color: theme.primary,
      fontWeight: '600',
      fontSize: 12,
    },
    savingText: {
      color: theme.textSecondary,
      fontSize: 11,
    },
    notesBlock: {
      marginTop: 4,
      gap: 8,
    },
    notesTitle: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 13,
    },
    notesInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 10,
      color: theme.text,
      textAlignVertical: 'top',
    },
    dateInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      color: theme.text,
    },
    saveNoteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 10,
      backgroundColor: theme.primary,
      paddingVertical: 10,
    },
    saveNoteText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    inlineRow: {
      paddingVertical: 6,
    },
    muted: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    error: {
      color: '#ef4444',
      fontSize: 13,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 13,
    },
  });

export default StationeryChecklistSection;
