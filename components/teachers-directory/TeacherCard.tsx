/**
 * Teacher card component for teachers directory
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Teacher, getEmploymentStatusColor } from './teachers-directory.types';
import { teachersDirectoryStyles as styles } from './teachers-directory.styles';

interface TeacherCardProps {
  teacher: Teacher;
  canManageTeacher: boolean;
  canViewFullDetails: boolean;
  onPress: () => void;
  onCall: () => void;
  onEmail: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

export function TeacherCard({
  teacher,
  canManageTeacher,
  canViewFullDetails,
  onPress,
  onCall,
  onEmail,
  onToggleStatus,
  onDelete,
}: TeacherCardProps) {
  const renderPerformanceStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  return (
    <TouchableOpacity style={styles.teacherCard} onPress={onPress}>
      <View style={styles.teacherHeader}>
        <View style={styles.teacherPhotoContainer}>
          {teacher.profilePhoto ? (
            <Image source={{ uri: teacher.profilePhoto }} style={styles.teacherPhoto} />
          ) : (
            <View style={styles.teacherPhotoPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.light.tabIconDefault} />
            </View>
          )}
        </View>
        
        <View style={styles.teacherInfo}>
          <View style={styles.teacherNameRow}>
            <Text style={styles.teacherName}>
              {teacher.firstName} {teacher.lastName}
            </Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getEmploymentStatusColor(teacher.employmentStatus) + '20' }
            ]}>
              <Text style={[
                styles.statusText, 
                { color: getEmploymentStatusColor(teacher.employmentStatus) }
              ]}>
                {teacher.employmentStatus}
              </Text>
            </View>
          </View>
          
          <Text style={styles.teacherDetails}>
            {teacher.teacherId} • {teacher.experienceYears} years exp
          </Text>
          
          <Text style={styles.teacherDetails}>
            {teacher.subjects.join(', ')}
          </Text>
          
          <Text style={styles.teacherDetails}>
            Grades: {teacher.grades.join(', ')}
          </Text>

          {canViewFullDetails && teacher.performanceRating && (
            <View style={styles.performanceRow}>
              {renderPerformanceStars(teacher.performanceRating)}
              <Text style={styles.performanceText}>
                {teacher.performanceRating.toFixed(1)}
              </Text>
            </View>
          )}

          <View style={styles.teacherActions}>
            <TouchableOpacity style={styles.contactButton} onPress={onCall}>
              <Ionicons name="call" size={16} color={Colors.light.tint} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactButton} onPress={onEmail}>
              <Ionicons name="mail" size={16} color={Colors.light.tint} />
            </TouchableOpacity>
            {canManageTeacher && (
              <>
                <TouchableOpacity style={styles.actionButton} onPress={onToggleStatus}>
                  <Ionicons 
                    name={teacher.employmentStatus === 'inactive' ? 'play' : 'pause'} 
                    size={16} 
                    color={Colors.light.tabIconDefault} 
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {canManageTeacher && teacher.salary && (
        <View style={styles.salaryInfo}>
          <Text style={styles.salaryText}>
            R{teacher.salary.toLocaleString()}/month • {teacher.leaveBalance} days leave
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
