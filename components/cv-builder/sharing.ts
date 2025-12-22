/**
 * CV sharing utilities
 */
import { Alert, Share, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { CVSection } from './types';

export function generateCVText(sections: CVSection[], cvTitle: string, profile: any): string {
  const personalSection = sections.find((s) => s.type === 'personal');
  const personalData = personalSection?.data || {};
  
  let text = `${cvTitle}\n\n`;
  text += `${personalData.fullName || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}\n`;
  if (personalData.email) text += `Email: ${personalData.email}\n`;
  if (personalData.phone) text += `Phone: ${personalData.phone}\n`;
  if (personalData.address) text += `Address: ${personalData.address}\n`;
  text += `\n${personalData.summary || ''}\n\n`;

  sections
    .filter((s) => s.type !== 'personal')
    .forEach((section) => {
      text += `${section.title}\n`;
      if (section.type === 'experience' || section.type === 'education' || section.type === 'certifications') {
        (section.data.items || []).forEach((item: any) => {
          text += `- ${item.position || item.degree || item.name}\n`;
          if (item.company || item.institution || item.issuer) {
            text += `  ${item.company || item.institution || item.issuer}\n`;
          }
          if (item.startDate) text += `  ${item.startDate} - ${item.endDate || 'Present'}\n`;
          if (item.description) text += `  ${item.description}\n`;
        });
      } else if (section.type === 'skills' || section.type === 'languages') {
        const items = section.data.skills || section.data.languages || [];
        text += items.map((item: any) => item.name).join(', ') + '\n';
      }
      text += '\n';
    });

  return text;
}

export function generateCVHTML(sections: CVSection[], cvTitle: string, profile: any, theme: any): string {
  const personalSection = sections.find((s) => s.type === 'personal');
  const personalData = personalSection?.data || {};
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        h1 { color: #333; border-bottom: 2px solid ${theme.primary}; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .section { margin-bottom: 25px; }
        .item { margin-bottom: 15px; }
        .header { margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${personalData.fullName || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}</h1>
        <p>${personalData.email || ''} | ${personalData.phone || ''} | ${personalData.address || ''}</p>
        <p>${personalData.summary || ''}</p>
      </div>
      ${sections
        .filter((s) => s.type !== 'personal')
        .map((section) => {
          let html = `<div class="section"><h2>${section.title}</h2>`;
          if (section.type === 'experience' || section.type === 'education') {
            html += (section.data.items || [])
              .map((item: any) => `
                <div class="item">
                  <strong>${item.position || item.degree}</strong> - ${item.company || item.institution}<br>
                  ${item.startDate || ''} - ${item.endDate || 'Present'}<br>
                  ${item.description || item.field || ''}
                </div>
              `)
              .join('');
          }
          html += '</div>';
          return html;
        })
        .join('')}
    </body>
    </html>
  `;
}

export async function generatePDF(sections: CVSection[], cvTitle: string, profile: any, theme: any, t: any): Promise<string | null> {
  try {
    const html = generateCVHTML(sections, cvTitle, profile, theme);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('PDF generation error:', error);
    Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.pdf_generation_failed', { defaultValue: 'Failed to generate PDF' }));
    return null;
  }
}

export async function handleShare(
  method: 'native' | 'pdf' | 'linkedin' | 'whatsapp' | 'email',
  sections: CVSection[],
  cvTitle: string,
  profile: any,
  theme: any,
  t: any
): Promise<void> {
  if (method === 'pdf') {
    const pdfUri = await generatePDF(sections, cvTitle, profile, theme, t);
    if (pdfUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: t('cv.share_cv', { defaultValue: 'Share CV' }),
      });
    } else {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.sharing_not_available', { defaultValue: 'Sharing is not available on this device' }));
    }
  } else if (method === 'native') {
    const text = generateCVText(sections, cvTitle, profile);
    await Share.share({ message: text, title: cvTitle });
  } else if (method === 'linkedin') {
    const text = encodeURIComponent(generateCVText(sections, cvTitle, profile));
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.edudashpro.org.za')}&summary=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
    else Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.linkedin_not_available', { defaultValue: 'LinkedIn app not available' }));
  } else if (method === 'whatsapp') {
    const text = encodeURIComponent(generateCVText(sections, cvTitle, profile));
    const url = `whatsapp://send?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
    else Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.whatsapp_not_available', { defaultValue: 'WhatsApp not available' }));
  } else if (method === 'email') {
    const text = generateCVText(sections, cvTitle, profile);
    const url = `mailto:?subject=${encodeURIComponent(cvTitle)}&body=${encodeURIComponent(text)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
    else Alert.alert(t('common.error', { defaultValue: 'Error' }), t('cv.email_not_available', { defaultValue: 'Email app not available' }));
  }
}
