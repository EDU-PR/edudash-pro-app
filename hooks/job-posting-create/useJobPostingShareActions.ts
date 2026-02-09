/** Share/broadcast/poster helpers — extracted from job-posting-create */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import HiringHubService from '@/lib/services/HiringHubService';
import { JobPostingAIService } from '@/lib/services/JobPostingAIService';
import {
  buildApplyLink, buildWhatsAppMessage, type ShareableJobPosting, type WhatsAppMessageVariant,
} from '@/lib/hiring/jobPostingShare';
import type { SchoolInfo, ShowAlert } from './types';

interface Params {
  preschoolId: string | null | undefined;
  userId: string | undefined;
  title: string;
  schoolInfo: SchoolInfo | null;
  showAlert: ShowAlert;
  loadSchoolInfo: () => Promise<void>;
}

export function useJobPostingShare({ preschoolId, userId, title, schoolInfo, showAlert, loadSchoolInfo }: Params) {
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareJobPosting, setShareJobPosting] = useState<any>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [shareVariant, setShareVariant] = useState<WhatsAppMessageVariant>('short');
  const [broadcasting, setBroadcasting] = useState(false);
  const [polishingShareMessage, setPolishingShareMessage] = useState(false);
  const [sharingPoster, setSharingPoster] = useState(false);
  const [includeSchoolHeader, setIncludeSchoolHeader] = useState(true);
  const [includeSchoolLogo, setIncludeSchoolLogo] = useState(true);
  const [includeSchoolDetails, setIncludeSchoolDetails] = useState(true);
  const posterShotRef = useRef<ViewShot>(null);

  const appWebBaseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || process.env.EXPO_PUBLIC_WEB_URL || 'https://edudashpro.org.za';

  const canPolishShareMessageWithAI = useMemo(
    () => Boolean(shareJobPosting?.id) && shareMessage.trim().length > 0,
    [shareJobPosting?.id, shareMessage],
  );

  const toShareableJobPosting = useCallback((jp: any): ShareableJobPosting => ({
    id: String(jp?.id || ''), title: jp?.title ?? null, description: jp?.description ?? null,
    requirements: jp?.requirements ?? null, location: jp?.location ?? null,
    employment_type: jp?.employment_type ?? null,
    salary_range_min: jp?.salary_range_min ?? null, salary_range_max: jp?.salary_range_max ?? null,
  }), []);

  const attachApplyLink = useCallback((baseMessage: string, jobId: string) => {
    const applyLink = buildApplyLink({ baseUrl: appWebBaseUrl, jobId });
    let text = String(baseMessage || '').trim();
    if (!text) return `📝 Apply online (no account required): ${applyLink}\n\nPosted via EduDash Pro Hiring Hub`;
    text = text.replace(/\{\{\s*apply_link\s*\}\}/gi, applyLink).replace(/\[\s*apply_link\s*\]/gi, applyLink);
    if (!text.includes(applyLink)) text = `${text}\n\n📝 Apply online (no account required): ${applyLink}`;
    if (!/posted via/i.test(text)) text = `${text}\n\nPosted via EduDash Pro Hiring Hub`;
    return text;
  }, [appWebBaseUrl]);

  const buildShareMessageForVariant = useCallback((variant: WhatsAppMessageVariant, jp: any) => {
    return buildWhatsAppMessage({ variant, baseUrl: appWebBaseUrl, job: toShareableJobPosting(jp), school: schoolInfo });
  }, [appWebBaseUrl, schoolInfo, toShareableJobPosting]);

  const formatSchoolDetails = useCallback((info: SchoolInfo | null) => {
    if (!info) return '';
    const loc = [info.city, info.province].filter(Boolean).join(', ');
    return [loc, info.phone, info.email, info.website].filter(Boolean).join(' • ');
  }, []);

  const openSharePreview = useCallback((jp: any) => {
    const msg = buildShareMessageForVariant('short', jp);
    setShareJobPosting(jp); setShareMessage(msg); setShareVariant('short');
    setIncludeSchoolHeader(true); setIncludeSchoolDetails(true);
    setShareModalVisible(true); void loadSchoolInfo();
  }, [buildShareMessageForVariant, loadSchoolInfo]);

  const handleShareToWhatsApp = useCallback(async () => {
    const msg = shareMessage.trim(); if (!msg) return;
    const encoded = encodeURIComponent(msg);
    const url = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;
    try {
      if (Platform.OS !== 'web') { const canOpen = await Linking.canOpenURL(url); await Linking.openURL(canOpen ? url : webUrl); }
      else await Linking.openURL(webUrl);
    } catch { await Linking.openURL(webUrl); }
  }, [shareMessage]);

  const handleCopyMessage = useCallback(async () => {
    if (!shareMessage.trim()) return;
    await Clipboard.setStringAsync(shareMessage);
    showAlert({ title: 'Copied', message: 'WhatsApp message copied to clipboard.', type: 'success' });
  }, [shareMessage, showAlert]);

  const handleCopyApplyLink = useCallback(async () => {
    if (!shareJobPosting?.id) return;
    await Clipboard.setStringAsync(buildApplyLink({ baseUrl: appWebBaseUrl, jobId: String(shareJobPosting.id) }));
    showAlert({ title: 'Copied', message: 'Apply link copied to clipboard.', type: 'success' });
  }, [appWebBaseUrl, shareJobPosting?.id, showAlert]);

  const handleSharePoster = useCallback(async () => {
    if (!shareJobPosting?.id) return;
    if (Platform.OS === 'web') { showAlert({ title: 'Not Available on Web', message: 'Poster sharing is mobile only.', type: 'info' }); return; }
    try {
      setSharingPoster(true);
      const uri = await posterShotRef.current?.capture?.(); if (!uri) throw new Error('Capture failed');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share Job Poster' });
      else showAlert({ title: 'Sharing Unavailable', message: 'Sharing is not available on this device.', type: 'warning' });
    } catch { showAlert({ title: 'Poster Failed', message: 'Try sharing the message instead.', type: 'error' }); }
    finally { setSharingPoster(false); }
  }, [shareJobPosting?.id, showAlert]);

  const handlePolishMessageWithAI = useCallback(async () => {
    if (!shareJobPosting?.id || !shareMessage.trim()) return;
    try {
      setPolishingShareMessage(true);
      const polished = await JobPostingAIService.polishWhatsAppMessage({
        baseMessage: shareMessage, schoolName: schoolInfo?.name, jobTitle: shareJobPosting?.title || title,
      });
      setShareMessage(attachApplyLink(polished, String(shareJobPosting.id)));
    } catch (e: any) {
      showAlert({ title: 'AI Failed', message: e?.message || 'Could not polish the message.', type: 'error' });
    } finally { setPolishingShareMessage(false); }
  }, [attachApplyLink, schoolInfo?.name, shareJobPosting?.id, shareJobPosting?.title, shareMessage, showAlert, title]);

  const handleWhatsAppBroadcast = useCallback(async (jp: any, msgOverride?: string): Promise<boolean> => {
    try {
      const base = msgOverride?.trim() || buildShareMessageForVariant(shareVariant, jp);
      const whatsappMsg = attachApplyLink(base, String(jp.id));
      if (!whatsappMsg.trim()) throw new Error('Message is empty');
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ message_type: 'text', content: whatsappMsg, broadcast: true, preschool_id: preschoolId, job_posting_id: jp.id }),
      });
      if (!res.ok) throw new Error('Failed to send WhatsApp broadcast');
      await HiringHubService.trackJobDistribution({ job_posting_id: jp.id, channel: 'whatsapp', distributed_by: userId!, recipients_count: 0 });
      showAlert({ title: 'Success! 🎉', message: 'Job posting shared via WhatsApp.', type: 'success' });
      return true;
    } catch {
      showAlert({ title: 'Sharing Failed', message: 'Could not share via WhatsApp. Share manually.', type: 'error' });
      return false;
    }
  }, [attachApplyLink, buildShareMessageForVariant, preschoolId, shareVariant, showAlert, userId]);

  return {
    shareModalVisible, setShareModalVisible, shareJobPosting, shareMessage, setShareMessage,
    shareVariant, setShareVariant, broadcasting, setBroadcasting,
    polishingShareMessage, canPolishShareMessageWithAI, sharingPoster,
    includeSchoolHeader, setIncludeSchoolHeader, includeSchoolLogo, setIncludeSchoolLogo,
    includeSchoolDetails, setIncludeSchoolDetails,
    appWebBaseUrl, posterShotRef, formatSchoolDetails, buildShareMessageForVariant,
    attachApplyLink, openSharePreview,
    handleShareToWhatsApp, handleCopyMessage, handleCopyApplyLink,
    handleSharePoster, handlePolishMessageWithAI, handleWhatsAppBroadcast,
  };
}
