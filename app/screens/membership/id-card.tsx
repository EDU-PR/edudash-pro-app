/**
 * Member ID Card Screen
 * Full-screen ID card view with flip animation, print & share
 */
import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  ScrollView,
  Alert,
  Share,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MemberIDCardFront, MemberIDCardBack } from '@/components/membership/MemberIDCard';
import { CARD_TEMPLATES, CardTemplate } from '@/components/membership/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock data for demo - replace with actual data fetch
const MOCK_MEMBER = {
  id: '1',
  organization_id: 'org1',
  region_id: 'reg1',
  member_number: 'SOA-GP-24-00001',
  member_type: 'learner' as const,
  first_name: 'Thabo',
  last_name: 'Mokoena',
  email: 'thabo.mokoena@email.com',
  phone: '+27 82 123 4567',
  membership_tier: 'premium' as const,
  membership_status: 'active' as const,
  joined_date: '2024-01-15',
  expiry_date: '2025-12-31',
  photo_url: null,
  province: 'Gauteng',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  organization: {
    id: 'org1',
    name: 'SOIL OF AFRICA',
    logo_url: null,
  },
  region: {
    id: 'reg1',
    organization_id: 'org1',
    name: 'Gauteng',
    code: 'GP',
    is_active: true,
    created_at: new Date().toISOString(),
  },
};

const MOCK_CARD = {
  id: 'card1',
  member_id: '1',
  organization_id: 'org1',
  card_number: 'SOA-GP-24-00001-C01',
  qr_code_data: 'eyJ2IjoiMSIsIm1pZCI6IjEiLCJjaWQiOiJjYXJkMSIsIm1uIjoiU09BLUdQLTI0LTAwMDAxIn0=',
  status: 'active' as const,
  issue_date: '2024-01-15',
  expiry_date: '2025-12-31',
  card_template: 'premium',
  print_requested: false,
  printed: false,
  verification_count: 5,
  created_at: new Date().toISOString(),
};

export default function MemberIDCardScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate>('premium');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const flipAnimation = useRef(new Animated.Value(0)).current;
  
  // In real app, fetch member and card data
  const member = MOCK_MEMBER;
  const card = MOCK_CARD;

  const handleFlip = () => {
    Animated.spring(flipAnimation, {
      toValue: isFlipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const generatePrintHTML = () => {
    const config = CARD_TEMPLATES[selectedTemplate];
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { size: 85.6mm 53.98mm; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Helvetica Neue', Arial, sans-serif; }
          .card {
            width: 85.6mm;
            height: 53.98mm;
            border-radius: 3mm;
            overflow: hidden;
            background: ${config.backgroundColor};
            position: relative;
            page-break-after: always;
          }
          .header {
            background: linear-gradient(90deg, ${config.gradientColors[0]}, ${config.gradientColors[1]});
            padding: 3mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .org-name {
            color: white;
            font-size: 4mm;
            font-weight: bold;
            letter-spacing: 0.5mm;
          }
          .card-type {
            color: rgba(255,255,255,0.8);
            font-size: 2mm;
            letter-spacing: 0.5mm;
          }
          .status-badge {
            background: ${member.membership_status === 'active' ? '#10B981' : '#F59E0B'};
            color: white;
            padding: 1mm 2mm;
            border-radius: 2mm;
            font-size: 2mm;
            font-weight: bold;
          }
          .content {
            display: flex;
            padding: 3mm;
            height: calc(100% - 16mm);
          }
          .photo-section {
            width: 20mm;
            text-align: center;
          }
          .photo {
            width: 18mm;
            height: 24mm;
            border: 0.5mm solid ${config.primaryColor};
            border-radius: 1mm;
            background: ${config.primaryColor}15;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${config.primaryColor};
            font-size: 10mm;
          }
          .tier-badge {
            background: ${config.accentColor}30;
            color: ${config.primaryColor};
            font-size: 2mm;
            padding: 0.5mm 1.5mm;
            border-radius: 1.5mm;
            margin-top: 1mm;
            display: inline-block;
          }
          .info-section {
            flex: 1;
            padding-left: 3mm;
          }
          .member-name {
            font-size: 4mm;
            font-weight: bold;
            color: ${config.textColor};
          }
          .member-type {
            font-size: 2.5mm;
            color: ${config.primaryColor};
            font-weight: 600;
            margin-bottom: 2mm;
          }
          .info-row {
            margin-bottom: 1.5mm;
          }
          .info-label {
            font-size: 2mm;
            color: #9CA3AF;
            letter-spacing: 0.3mm;
          }
          .info-value {
            font-size: 2.5mm;
            color: ${config.textColor};
            font-weight: 600;
          }
          .qr-section {
            width: 18mm;
            text-align: center;
          }
          .qr-placeholder {
            width: 16mm;
            height: 16mm;
            background: white;
            border-radius: 1mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8mm;
            box-shadow: 0 0.5mm 1mm rgba(0,0,0,0.1);
          }
          .qr-label {
            font-size: 1.5mm;
            color: #9CA3AF;
            margin-top: 1mm;
          }
          .bottom-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: ${config.primaryColor}10;
            padding: 1.5mm 3mm;
            display: flex;
            justify-content: space-between;
            font-size: 2mm;
          }
          .card-number {
            color: ${config.textColor};
            font-weight: 500;
          }
          .issue-date {
            color: ${config.textColor}80;
          }
          
          /* Back of card */
          .card-back {
            background: ${config.backgroundColor};
          }
          .magnetic-strip {
            height: 8mm;
            background: ${config.primaryColor};
            margin-top: 4mm;
          }
          .barcode-section {
            text-align: center;
            padding: 3mm;
          }
          .barcode {
            font-family: 'Libre Barcode 39', monospace;
            font-size: 10mm;
            letter-spacing: 2mm;
          }
          .barcode-text {
            font-size: 2mm;
            letter-spacing: 0.5mm;
            color: #374151;
          }
          .back-info {
            padding: 2mm 4mm;
            text-align: center;
          }
          .back-title {
            color: ${config.primaryColor};
            font-size: 2.5mm;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          .back-text {
            color: #6B7280;
            font-size: 2mm;
            line-height: 1.4;
          }
          .terms {
            padding: 2mm 4mm;
            text-align: center;
          }
          .terms-text {
            color: #9CA3AF;
            font-size: 1.5mm;
            line-height: 1.4;
          }
          .signature-strip {
            margin: 2mm 4mm;
            height: 6mm;
            background: #F3F4F6;
            border-radius: 1mm;
            display: flex;
            align-items: flex-end;
            padding: 0.5mm 2mm;
          }
          .signature-label {
            font-size: 1.5mm;
            color: #9CA3AF;
          }
          .website {
            text-align: center;
            padding-bottom: 2mm;
          }
          .website-text {
            color: ${config.primaryColor};
            font-size: 2mm;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <!-- Front of Card -->
        <div class="card">
          <div class="header">
            <div>
              <div class="org-name">${member.organization?.name || 'SOIL OF AFRICA'}</div>
              <div class="card-type">MEMBERSHIP CARD</div>
            </div>
            <div class="status-badge">${member.membership_status.toUpperCase()}</div>
          </div>
          <div class="content">
            <div class="photo-section">
              <div class="photo">👤</div>
              <div class="tier-badge">${member.membership_tier.toUpperCase()}</div>
            </div>
            <div class="info-section">
              <div class="member-name">${member.first_name} ${member.last_name}</div>
              <div class="member-type">${member.member_type.charAt(0).toUpperCase() + member.member_type.slice(1)}</div>
              <div class="info-row">
                <div class="info-label">MEMBER NO.</div>
                <div class="info-value">${member.member_number}</div>
              </div>
              <div class="info-row">
                <div class="info-label">REGION</div>
                <div class="info-value">${member.region?.name || 'N/A'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">VALID UNTIL</div>
                <div class="info-value">${new Date(card.expiry_date).toLocaleDateString('en-ZA', { month: '2-digit', year: '2-digit' })}</div>
              </div>
            </div>
            <div class="qr-section">
              <div class="qr-placeholder">📱</div>
              <div class="qr-label">SCAN TO VERIFY</div>
            </div>
          </div>
          <div class="bottom-bar">
            <span class="card-number">Card: ${card.card_number}</span>
            <span class="issue-date">Issued: ${new Date(card.issue_date).toLocaleDateString('en-ZA')}</span>
          </div>
        </div>
        
        <!-- Back of Card -->
        <div class="card card-back">
          <div class="magnetic-strip"></div>
          <div class="barcode-section">
            <div class="barcode">||| |||| ||| | |||</div>
            <div class="barcode-text">${member.member_number}</div>
          </div>
          <div class="back-info">
            <div class="back-title">EMERGENCY CONTACT</div>
            <div class="back-text">
              Contact the nearest regional office<br>
              or call: 0800-SOA-HELP (0800-762-4357)
            </div>
          </div>
          <div class="terms">
            <div class="terms-text">
              This card remains the property of ${member.organization?.name || 'Soil of Africa'}.<br>
              If found, please return to the nearest branch or mail to:<br>
              P.O. Box 12345, Johannesburg, 2000
            </div>
          </div>
          <div class="signature-strip">
            <span class="signature-label">AUTHORIZED SIGNATURE</span>
          </div>
          <div class="website">
            <span class="website-text">www.soilofafrica.org.za</span>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      setIsGeneratingPDF(true);
      const html = generatePrintHTML();
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'Failed to print ID card');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSavePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const html = generatePrintHTML();
      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save ID Card PDF',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save ID card as PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${member.first_name} ${member.last_name}\nMember ID: ${member.member_number}\nOrganization: ${member.organization?.name || 'Soil of Africa'}\nStatus: ${member.membership_status}`,
        title: 'My Membership ID',
      });
    } catch (error) {
      // User cancelled
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: t('membership.id_card', { defaultValue: 'Member ID Card' }),
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={{ marginRight: 16 }}>
              <Ionicons name="share-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card Preview */}
        <View style={styles.cardContainer}>
          <TouchableOpacity onPress={handleFlip} activeOpacity={0.9}>
            {/* Front */}
            <Animated.View 
              style={[
                styles.cardWrapper,
                { transform: [{ rotateY: frontInterpolate }] },
                { backfaceVisibility: 'hidden' },
              ]}
            >
              <MemberIDCardFront 
                member={member} 
                card={card} 
                template={selectedTemplate}
              />
            </Animated.View>
            
            {/* Back */}
            <Animated.View 
              style={[
                styles.cardWrapper,
                styles.cardBack,
                { transform: [{ rotateY: backInterpolate }] },
                { backfaceVisibility: 'hidden' },
              ]}
            >
              <MemberIDCardBack 
                member={member} 
                card={card} 
                template={selectedTemplate}
              />
            </Animated.View>
          </TouchableOpacity>
          
          <Text style={[styles.flipHint, { color: theme.textSecondary }]}>
            <Ionicons name="sync-outline" size={14} /> Tap card to flip
          </Text>
        </View>

        {/* Template Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Card Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.templateRow}>
              {Object.entries(CARD_TEMPLATES).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.templateOption,
                    { 
                      borderColor: selectedTemplate === key ? config.primaryColor : theme.border,
                      borderWidth: selectedTemplate === key ? 2 : 1,
                    }
                  ]}
                  onPress={() => setSelectedTemplate(key as CardTemplate)}
                >
                  <LinearGradient
                    colors={config.gradientColors as [string, string]}
                    style={styles.templatePreview}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={[styles.templateName, { color: theme.text }]}>
                    {config.name}
                  </Text>
                  {selectedTemplate === key && (
                    <View style={[styles.checkBadge, { backgroundColor: config.primaryColor }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Card Info */}
        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color={theme.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Card Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{card.card_number}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Valid Until</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {new Date(card.expiry_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Verification Count</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{card.verification_count} times</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleSavePDF}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="download-outline" size={22} color={theme.primary} />
              <Text style={[styles.actionButtonText, { color: theme.primary }]}>Save PDF</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handlePrint}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="print-outline" size={22} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Print Card</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    alignItems: 'center',
  },
  cardContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardWrapper: {
    position: 'absolute',
  },
  cardBack: {
    position: 'absolute',
  },
  flipHint: {
    marginTop: 220,
    fontSize: 13,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  templateOption: {
    width: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  templatePreview: {
    height: 50,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  primaryButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
