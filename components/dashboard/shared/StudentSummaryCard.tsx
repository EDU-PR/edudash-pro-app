import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface StudentSummaryCardProps {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    className?: string | null;
    dateOfBirth?: string | null;
  };
  onPress?: () => void;
  subtitle?: string;
}

export const StudentSummaryCard: React.FC<StudentSummaryCardProps> = ({
  student,
  onPress,
  subtitle,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase() || 'C';
  const displaySubtitle = subtitle || student.className || 'Unassigned';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        {student.avatarUrl ? (
          <Image source={{ uri: student.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{initials}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {student.firstName} {student.lastName}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {displaySubtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: any) => {
  const isNextGenTeacher = String(theme?.background || '').toLowerCase() === '#0f121e';

  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: isNextGenTeacher ? 18 : 12,
      backgroundColor: isNextGenTeacher ? 'rgba(255,255,255,0.05)' : theme.surface,
      borderWidth: 1,
      borderColor: isNextGenTeacher ? 'rgba(255,255,255,0.10)' : theme.border,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: isNextGenTeacher ? 14 : 2,
      },
      shadowOpacity: isNextGenTeacher ? 0.35 : 0.05,
      shadowRadius: isNextGenTeacher ? 24 : 4,
      elevation: isNextGenTeacher ? 10 : 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      overflow: 'hidden',
    },
    avatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 16,
    },
    info: {
      flex: 1,
    },
    name: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    subtitle: {
      color: isNextGenTeacher ? 'rgba(234,240,255,0.72)' : theme.textSecondary,
      fontSize: 12,
    },
  });
};

export default StudentSummaryCard;
