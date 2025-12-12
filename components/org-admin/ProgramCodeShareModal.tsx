import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useOrganization } from '@/hooks/useOrganization';

// QR Code - optional dependency
let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  // Package not installed - QR code will be shown as placeholder
  QRCode = null;
}

interface ProgramCodeShareModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  program: {
    id: string;
    title: string;
    course_code: string | null;
  };
}

export function ProgramCodeShareModal({
  visible,
  onClose,
  theme,
  program,
}: ProgramCodeShareModalProps) {
  const { data: organization } = useOrganization();
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [registerLink, setRegisterLink] = useState('');
  const [programCode, setProgramCode] = useState('');

  useEffect(() => {
    if (visible && program) {
      // Generate program code if doesn't exist
      const code = program.course_code || generateProgramCode(program.id);
      setProgramCode(code);

      // Create registration link
      const appUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app';
      const orgSlug = organization?.slug || organization?.id;
      const link = `${appUrl}/register?org=${orgSlug}&code=${code}&program=${program.id}`;
      setRegisterLink(link);
      setQrCodeValue(link);
    }
  }, [visible, program, organization]);

  const generateProgramCode = (programId: string): string => {
    // Generate a short, memorable code
    const prefix = organization?.slug?.toUpperCase().substring(0, 3) || 'ORG';
    const code = `${prefix}-${programId.substring(0, 8).toUpperCase()}`;
    return code;
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(registerLink);
      Alert.alert('Copied!', 'Registration link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(programCode);
      Alert.alert('Copied!', 'Program code copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy code');
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Join ${program.title} at ${organization?.name || 'our organization'}!\n\nProgram Code: ${programCode}\n\nRegister here: ${registerLink}`,
        url: registerLink,
        title: `Join ${program.title}`,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share');
      }
    }
  };

  const handleDownloadQR = async () => {
    // QR code download - screenshot functionality
    // Users can take a screenshot of the QR code for now
    // Full download functionality can be added later with expo-media-library if needed
    Alert.alert(
      'Download QR Code',
      'Take a screenshot of the QR code to save it. Full download functionality coming soon.',
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                Share Program
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {program.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Program Code */}
            <View style={[styles.section, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Program Code
              </Text>
              <View style={styles.codeContainer}>
                <Text style={[styles.codeText, { color: theme.primary }]}>
                  {programCode}
                </Text>
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: theme.primary + '20' }]}
                  onPress={handleCopyCode}
                >
                  <Ionicons name="copy-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Learners can enter this code to register for the program
              </Text>
            </View>

            {/* QR Code */}
            <View style={[styles.section, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                QR Code
              </Text>
              <View style={styles.qrContainer}>
                {qrCodeValue ? (
                  QRCode ? (
                    <QRCode
                      value={qrCodeValue}
                      size={200}
                      backgroundColor="white"
                      color={theme.text || '#000000'}
                    />
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code-outline" size={80} color={theme.textSecondary} />
                      <Text style={[styles.qrPlaceholderText, { color: theme.textSecondary }]}>
                        Install react-native-qrcode-svg{'\n'}to display QR code
                      </Text>
                      <View style={[styles.qrLinkBox, { backgroundColor: theme.background }]}>
                        <Text style={[styles.qrLinkText, { color: theme.text }]} numberOfLines={3}>
                          {registerLink}
                        </Text>
                      </View>
                      <Text style={[styles.qrHint, { color: theme.textSecondary }]}>
                        Share this link instead
                      </Text>
                    </View>
                  )
                ) : (
                  <ActivityIndicator size="large" color={theme.primary} />
                )}
              </View>
              <TouchableOpacity
                style={[styles.button, { borderColor: theme.border }]}
                onPress={handleDownloadQR}
              >
                <Ionicons name="download-outline" size={20} color={theme.text} />
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  Download QR Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* Share Options */}
            <View style={[styles.section, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Share Via
              </Text>
              
              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: theme.primary }]}
                onPress={handleShare}
              >
                <Ionicons name="share-social-outline" size={22} color="#fff" />
                <Text style={styles.shareButtonText}>Share Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { borderColor: theme.border }]}
                onPress={handleCopyLink}
              >
                <Ionicons name="link-outline" size={20} color={theme.text} />
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  Copy Registration Link
                </Text>
              </TouchableOpacity>

              <View style={[styles.linkBox, { backgroundColor: theme.background }]}>
                <Text style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {registerLink}
                </Text>
              </View>
            </View>

            {/* Social Media Templates */}
            <View style={[styles.section, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Social Media Templates
              </Text>
              
              <View style={styles.templateBox}>
                <Text style={[styles.templateLabel, { color: theme.textSecondary }]}>
                  Facebook/Instagram Post:
                </Text>
                <Text style={[styles.templateText, { color: theme.text }]}>
                  🎓 Join {program.title} at {organization?.name || 'our organization'}!{'\n\n'}
                  Program Code: {programCode}{'\n\n'}
                  Register now: {registerLink.split('?')[0]}{'\n\n'}
                  #Education #SkillsDevelopment #Learning
                </Text>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: theme.primary }]}
                  onPress={async () => {
                    const template = `🎓 Join ${program.title} at ${organization?.name || 'our organization'}!\n\nProgram Code: ${programCode}\n\nRegister now: ${registerLink.split('?')[0]}\n\n#Education #SkillsDevelopment #Learning`;
                    await Clipboard.setStringAsync(template);
                    Alert.alert('Copied!', 'Template copied to clipboard');
                  }}
                >
                  <Text style={styles.copyButtonText}>Copy Template</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.templateBox}>
                <Text style={[styles.templateLabel, { color: theme.textSecondary }]}>
                  WhatsApp/SMS:
                </Text>
                <Text style={[styles.templateText, { color: theme.text }]}>
                  Hi! Join {program.title} at {organization?.name}. Use code {programCode} or scan the QR code to register: {registerLink}
                </Text>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: theme.primary }]}
                  onPress={async () => {
                    const template = `Hi! Join ${program.title} at ${organization?.name}. Use code ${programCode} or scan the QR code to register: ${registerLink}`;
                    await Clipboard.setStringAsync(template);
                    Alert.alert('Copied!', 'Template copied to clipboard');
                  }}
                >
                  <Text style={styles.copyButtonText}>Copy Template</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    gap: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: -4,
  },
  qrContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
    marginBottom: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  linkBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  linkText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  qrPlaceholder: {
    padding: 20,
    alignItems: 'center',
    gap: 12,
    minHeight: 200,
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  qrLinkBox: {
    padding: 12,
    borderRadius: 8,
    maxWidth: '100%',
    marginTop: 8,
  },
  qrLinkText: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 16,
  },
  qrHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  templateBox: {
    gap: 8,
    marginTop: 8,
  },
  templateLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  templateText: {
    fontSize: 13,
    lineHeight: 20,
  },
  copyButton: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

