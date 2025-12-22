import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';

interface ProfileHeaderProps {
  profileImage: string | null;
  displayUri: string | null;
  displayName: string;
  email: string | null;
  role: string | null;
  initials: string;
  uploadingImage: boolean;
  onImagePress: () => void;
  theme: {
    surface: string;
    divider: string;
    primary: string;
    onPrimary: string;
    secondary: string;
    onSecondary: string;
    primaryLight: string;
    text: string;
    textSecondary: string;
  };
  styles: {
    profileHeader: ViewStyle;
    avatarContainer: ViewStyle;
    avatar: ImageStyle;
    avatarPlaceholder: ViewStyle;
    avatarText: TextStyle;
    cameraIconContainer: ViewStyle;
    loadingIcon: ViewStyle;
    loadingText: TextStyle;
    displayName: TextStyle;
    email: TextStyle;
    roleBadge: ViewStyle;
    roleText: TextStyle;
  };
}

export function ProfileHeader({
  profileImage,
  displayUri,
  displayName,
  email,
  role,
  initials,
  uploadingImage,
  onImagePress,
  theme,
  styles,
}: ProfileHeaderProps) {
  return (
    <View style={styles.profileHeader}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={onImagePress}
        disabled={uploadingImage}
      >
        {displayUri || profileImage ? (
          <Image source={{ uri: (displayUri || profileImage) ?? '' }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}

        <View style={styles.cameraIconContainer}>
          {uploadingImage ? (
            <View style={styles.loadingIcon}>
              <Text style={styles.loadingText}>⟳</Text>
            </View>
          ) : (
            <Ionicons name="camera" size={16} color={theme.onSecondary} />
          )}
        </View>
      </TouchableOpacity>

      <Text style={styles.displayName}>{displayName}</Text>
      <Text style={styles.email}>{email}</Text>

      {role && (
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {role.replace("_", " ").toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}
