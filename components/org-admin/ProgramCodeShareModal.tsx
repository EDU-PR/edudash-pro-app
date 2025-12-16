import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useOrganization } from '@/hooks/useOrganization';

// QR Code - optional dependency
import QRCode from 'react-native-qrcode-svg';

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
  const [showFullLink, setShowFullLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && program) {
      // Generate program code if doesn't exist
      const code = program.course_code || generateProgramCode(program.id);
      setProgramCode(code);

      // Create registration link with all program details encoded
      const appUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://edudashpro.app';
      const orgSlug = organization?.slug || organization?.id;
      
      // Include program info in the link for pre-filling registration
      const link = `${appUrl}/register?org=${orgSlug}&code=${code}&program=${program.id}&name=${encodeURIComponent(program.title)}`;
      setRegisterLink(link);
      
      // QR code contains the full registration link
      setQrCodeValue(link);

      // Reset states
      setShowFullLink(false);
      setCopiedId(null);

      // Fade in animation with slide
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, program, organization]);

  const generateProgramCode = (programId: string): string => {
    // Generate a short, memorable code
    const prefix = organization?.slug?.toUpperCase().substring(0, 3) || 'ORG';
    const code = `${prefix}-${programId.substring(0, 8).toUpperCase()}`;
    return code;
  };

  const showCopyFeedback = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(registerLink);
      showCopyFeedback('link');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(programCode);
      showCopyFeedback('code');
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
    Alert.alert(
      'Download QR Code',
      'Take a screenshot of the QR code to save it. Full download functionality coming soon.',
      [{ text: 'OK' }]
    );
  };

  const truncateLink = (link: string, maxLength: number = 50) => {
    if (link.length <= maxLength || showFullLink) return link;
    return `${link.substring(0, maxLength)}...`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <TouchableOpacity 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalWrapper}
        >
          <Animated.View 
            style={[
              styles.modal,
              { 
                backgroundColor: theme.card,
                opacity: fadeAnim,
                maxHeight: '90%',
              }
            ]}
          >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.programIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="book-outline" size={24} color={theme.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: theme.text }]}>
                  Share Program
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                  {program.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.background }]}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Quick Actions */}
            <View style={[styles.quickActions, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: theme.primary }]}
                onPress={handleShare}
              >
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.quickActionText}>Share Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={handleCopyLink}
              >
                <Ionicons 
                  name={copiedId === 'link' ? 'checkmark-circle' : 'copy-outline'} 
                  size={20} 
                  color={copiedId === 'link' ? theme.primary : theme.text} 
                />
                <Text style={[styles.quickActionText, { color: copiedId === 'link' ? theme.primary : theme.text }]}>
                  {copiedId === 'link' ? 'Copied!' : 'Copy Link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Program Code Card */}
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="keypad-outline" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Program Code
                </Text>
              </View>
              <View style={styles.codeDisplay}>
                <Text style={[styles.codeText, { color: theme.primary }]}>
                  {programCode}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.copyIconButton,
                    { 
                      backgroundColor: copiedId === 'code' ? theme.primary + '30' : theme.primary + '15' 
                    }
                  ]}
                  onPress={handleCopyCode}
                >
                  <Ionicons 
                    name={copiedId === 'code' ? 'checkmark' : 'copy-outline'} 
                    size={18} 
                    color={copiedId === 'code' ? theme.primary : theme.text} 
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Learners can enter this code to register
              </Text>
            </View>

            {/* QR Code Card */}
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="qr-code-outline" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  QR Code
                </Text>
              </View>
              <View style={styles.qrContainer}>
                {qrCodeValue ? (
                  <View style={styles.qrWrapper}>
                    <View style={[styles.qrCodeBox, { backgroundColor: '#FFFFFF' }]}>
                      <QRCode
                        value={qrCodeValue}
                        size={220}
                        backgroundColor="#FFFFFF"
                        color="#000000"
                        quietZone={10}
                      />
                    </View>
                    <View style={styles.qrInfo}>
                      <Text style={[styles.qrProgramName, { color: theme.text }]} numberOfLines={1}>
                        {program.title}
                      </Text>
                      <Text style={[styles.qrProgramCode, { color: theme.textSecondary }]}>
                        {programCode}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <ActivityIndicator size="large" color={theme.primary} />
                )}
              </View>
              {qrCodeValue && (
                <TouchableOpacity
                  style={[styles.button, { borderColor: theme.border }]}
                  onPress={handleDownloadQR}
                >
                  <Ionicons name="download-outline" size={18} color={theme.text} />
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    Save QR Code
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Registration Link Card */}
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="link-outline" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Registration Link
                </Text>
              </View>
              <View style={[styles.linkBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Text 
                  style={[styles.linkText, { color: theme.text }]} 
                  numberOfLines={showFullLink ? undefined : 2}
                >
                  {registerLink}
                </Text>
                {registerLink.length > 60 && (
                  <TouchableOpacity
                    onPress={() => setShowFullLink(!showFullLink)}
                    style={styles.showMoreButton}
                  >
                    <Text style={[styles.showMoreText, { color: theme.primary }]}>
                      {showFullLink ? 'Show Less' : 'Show Full Link'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Social Media Templates */}
            <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="chatbubbles-outline" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Social Media Templates
                </Text>
              </View>
              
              {/* Facebook/Instagram Template */}
              <View style={styles.templateBox}>
                <Text style={[styles.templateLabel, { color: theme.textSecondary }]}>
                  For Facebook/Instagram:
                </Text>
                <View style={[styles.templateContent, { backgroundColor: theme.card }]}>
                  <Text style={[styles.templateText, { color: theme.text }]}>
                    🎓 Join {program.title} at {organization?.name || 'our organization'}!{'\n\n'}
                    Program Code: {programCode}{'\n\n'}
                    Register: {registerLink.split('?')[0]}{'\n\n'}
                    #Education #SkillsDevelopment
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: theme.primary }]}
                  onPress={async () => {
                    const template = `🎓 Join ${program.title} at ${organization?.name || 'our organization'}!\n\nProgram Code: ${programCode}\n\nRegister: ${registerLink.split('?')[0]}\n\n#Education #SkillsDevelopment`;
                    await Clipboard.setStringAsync(template);
                    showCopyFeedback('fb-template');
                  }}
                >
                  <Ionicons 
                    name={copiedId === 'fb-template' ? 'checkmark-circle' : 'copy-outline'} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.copyButtonText}>
                    {copiedId === 'fb-template' ? 'Copied!' : 'Copy Template'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* WhatsApp/SMS Template */}
              <View style={styles.templateBox}>
                <Text style={[styles.templateLabel, { color: theme.textSecondary }]}>
                  For WhatsApp/SMS:
                </Text>
                <View style={[styles.templateContent, { backgroundColor: theme.card }]}>
                  <Text style={[styles.templateText, { color: theme.text }]}>
                    Hi! Join {program.title} at {organization?.name}.{'\n\n'}
                    Use code: {programCode}{'\n'}
                    Or register: {registerLink.split('?')[0]}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: theme.primary }]}
                  onPress={async () => {
                    const template = `Hi! Join ${program.title} at ${organization?.name}.\n\nUse code: ${programCode}\nOr register: ${registerLink.split('?')[0]}`;
                    await Clipboard.setStringAsync(template);
                    showCopyFeedback('wa-template');
                  }}
                >
                  <Ionicons 
                    name={copiedId === 'wa-template' ? 'checkmark-circle' : 'copy-outline'} 
                    size={16} 
                    color="#fff" 
                  />
                  <Text style={styles.copyButtonText}>
                    {copiedId === 'wa-template' ? 'Copied!' : 'Copy Template'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom spacing */}
            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  modalWrapper: {
    zIndex: 1,
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modal: {
    width: '100%',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  programIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingBottom: 32,
    gap: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  codeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeText: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  copyIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qrWrapper: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  qrCodeBox: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrInfo: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  qrProgramName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  qrProgramCode: {
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  qrPlaceholder: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
    minHeight: 220,
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  linkText: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  showMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  templateBox: {
    gap: 10,
    marginTop: 4,
  },
  templateLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  templateContent: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  templateText: {
    fontSize: 13,
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
