/**
 * Teacher Post Activity Screen - Styles
 */

import { StyleSheet } from 'react-native';

export const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    section: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    typeButton: {
      width: '30%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      gap: 6,
    },
    typeLabel: {
      fontSize: 12,
      fontWeight: '500',
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    templateContainer: {
      gap: 8,
    },
    templateButton: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
    },
    templateText: {
      fontSize: 14,
    },
    photoActions: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    photoButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    photoButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    imageWrapper: {
      width: 100,
      height: 100,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    removeButton: {
      position: 'absolute',
      top: -8,
      right: -8,
    },
    classButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 8,
      gap: 12,
    },
    classText: {
      fontSize: 15,
      fontWeight: '500',
    },
    studentList: {
      maxHeight: 200,
    },
    studentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      gap: 12,
    },
    studentText: {
      fontSize: 15,
    },
    visibilityButtons: {
      gap: 8,
    },
    visibilityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 2,
      borderRadius: 8,
      gap: 12,
    },
    visibilityText: {
      fontSize: 15,
      fontWeight: '500',
    },
    postButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 16,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    postButtonDisabled: {
      opacity: 0.6,
    },
    postButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });
