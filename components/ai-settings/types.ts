/**
 * AI Settings types and constants
 */

export interface AISettings {
  // Core AI Settings
  voiceEnabled: boolean;
  proactiveHelp: boolean;
  memoryEnabled: boolean;
  multilingualSupport: boolean;
  
  // Personality Settings
  personality: 'professional' | 'casual' | 'encouraging' | 'formal';
  personalityCustom: string;
  adaptiveTone: boolean;
  emotionalIntelligence: boolean;
  
  // Voice Settings
  voiceLanguage: string;
  voiceType: string;
  voiceRate: number;
  voicePitch: number;
  voiceVolume: number;
  autoReadResponses: boolean;
  voiceActivation: boolean;
  
  // Chat Behavior Settings
  enterToSend: boolean;
  autoVoiceReply: boolean;
  showTypingIndicator: boolean;
  readReceiptEnabled: boolean;
  soundEnabled: boolean;
  autoSuggestQuestions: boolean;
  contextualHelp: boolean;
  
  // Learning & Memory Settings
  rememberPreferences: boolean;
  learnFromInteractions: boolean;
  personalizedRecommendations: boolean;
  crossSessionMemory: boolean;
  memoryRetentionDays: number;
  
  // Advanced Features
  predictiveText: boolean;
  smartNotifications: boolean;
  offlineMode: boolean;
  dataSync: boolean;
  experimentalFeatures: boolean;
  
  // Privacy Settings
  dataCollection: boolean;
  anonymousUsage: boolean;
  shareAnalytics: boolean;
  localProcessing: boolean;
  
  // Custom Instructions
  customInstructions: string;
  userContext: string;
  teachingStyle: 'direct' | 'guided' | 'socratic' | 'adaptive';
  
  // Accessibility
  highContrast: boolean;
  largeFonts: boolean;
  screenReader: boolean;
  reducedMotion: boolean;
}

export interface ExpandedSections {
  personality: boolean;
  voice: boolean;
  chat: boolean;
  learning: boolean;
  custom: boolean;
  accessibility: boolean;
}

export const DEFAULT_SETTINGS: AISettings = {
  voiceEnabled: true,
  proactiveHelp: true,
  memoryEnabled: true,
  multilingualSupport: true,
  personality: 'encouraging',
  personalityCustom: '',
  adaptiveTone: true,
  emotionalIntelligence: true,
  voiceLanguage: 'en',
  voiceType: 'female_warm',
  voiceRate: 1.0,
  voicePitch: 1.0,
  voiceVolume: 0.8,
  autoReadResponses: false,
  voiceActivation: false,
  enterToSend: true,
  autoVoiceReply: false,
  showTypingIndicator: true,
  readReceiptEnabled: true,
  soundEnabled: true,
  autoSuggestQuestions: true,
  contextualHelp: true,
  rememberPreferences: true,
  learnFromInteractions: true,
  personalizedRecommendations: true,
  crossSessionMemory: true,
  memoryRetentionDays: 30,
  predictiveText: true,
  smartNotifications: true,
  offlineMode: false,
  dataSync: true,
  experimentalFeatures: false,
  dataCollection: true,
  anonymousUsage: false,
  shareAnalytics: true,
  localProcessing: false,
  customInstructions: '',
  userContext: '',
  teachingStyle: 'adaptive',
  highContrast: false,
  largeFonts: false,
  screenReader: false,
  reducedMotion: false
};

export const PERSONALITY_OPTIONS = [
  { label: 'Professional', value: 'professional' },
  { label: 'Casual', value: 'casual' },
  { label: 'Encouraging', value: 'encouraging' },
  { label: 'Formal', value: 'formal' }
];

export const LANGUAGE_OPTIONS = [
  { label: 'English (SA)', value: 'en' },
  { label: 'Afrikaans', value: 'af' },
  { label: 'isiZulu', value: 'zu' },
  { label: 'isiXhosa (Beta)', value: 'xh' },
  { label: 'Sepedi (Beta)', value: 'nso' }
];

export const TEACHING_STYLE_OPTIONS = [
  { label: 'Direct', value: 'direct' },
  { label: 'Guided', value: 'guided' },
  { label: 'Socratic', value: 'socratic' },
  { label: 'Adaptive', value: 'adaptive' }
];

export const TEST_MESSAGES: Record<string, Record<string, string>> = {
  en: {
    professional: "Good day. I'm Dash, your professional AI teaching assistant. I'm ready to help with your educational needs.",
    casual: "Hey there! I'm Dash, your friendly AI buddy. Ready to learn something awesome together?",
    encouraging: "Hello! I'm Dash, and I'm here to support you every step of the way. You're doing great!",
    formal: "Greetings. I am Dash, your dedicated educational assistant. I am prepared to assist with your academic endeavors.",
  },
  af: {
    professional: "Goeiedag. Ek is Dash, jou professionele onderwysassistent. Ek is gereed om jou te help.",
    casual: "Haai daar! Ek is Dash, jou vriendelike helper. Klaar om iets awesome te leer?",
    encouraging: "Hallo! Ek is Dash, en ek is hier om jou elke stap van die pad te ondersteun. Jy doen great!",
    formal: "Groete. Ek is Dash, jou toegewyde opvoedkundige assistent. Ek is gereed om jou te help.",
  },
  zu: {
    professional: "Sawubona. Ngingu-Dash, umsizi wakho wezemfundo. Ngikulungele ukukusiza.",
    casual: "Yebo! Ngingu-Dash, umngane wakho. Usukulungele ukufunda into enhle?",
    encouraging: "Sawubona! Ngingu-Dash, futhi ngilapha ukukusekela ezinyathelweni zonke. Wenza kahle!",
    formal: "Sanibonani. Ngingu-Dash, umsizi wakho wezemfundo ozinikele. Ngikulungele ukukusiza.",
  },
  xh: {
    professional: "Molo. NdinguDash, umncedisi wakho wemfundo. Ndikulungele ukukunceda.",
    casual: "Ewe! NdinguDash, umhlobo wakho. Ukulungele ukufunda into entle?",
    encouraging: "Molo! NdinguDash, kwaye ndilapha ukukuxhasa kwinyathelo ngalinye. Wenza kakuhle!",
    formal: "Molweni. NdinguDash, umncedisi wakho wemfundo ozinikeleyo. Ndikulungele ukukunceda.",
  },
  nso: {
    professional: "Thobela. Ke Dash, mothusi wa gago wa thuto. Ke lokile go go thuša.",
    casual: "Hei! Ke Dash, mogwera wa gago. O lokile go ithuta se se botse?",
    encouraging: "Dumela! Ke Dash, gomme ke fano go go thekga mo kgatong ye nngwe le ye nngwe. O dira gabotse!",
    formal: "Dumelang. Ke Dash, mothusi wa gago wa thuto yo a ikgafilego. Ke lokile go go thuša.",
  },
};

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  af: 'Afrikaans',
  zu: 'isiZulu',
  xh: 'isiXhosa',
  nso: 'Northern Sotho'
};
