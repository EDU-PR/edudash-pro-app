// Default providers for DI (non-invasive scaffolding)

import { TOKENS, type OrganizationService, type FeatureFlagService } from '../types';
import { container } from '../container';
import { getOrganizationDisplayName, mapTerm as mapOrgTerm, getDynamicGreeting, getRoleCapabilities } from '../../organization';

class OrganizationServiceImpl implements OrganizationService {
  getDisplayName(type: string): string {
    return getOrganizationDisplayName(type as any);
  }
  mapTerm(term: string, type: string): string {
    return mapOrgTerm(term as any, type as any);
  }
  getGreeting(type: string, role: string, userName?: string): string {
    return getDynamicGreeting(type as any, role, userName);
  }
  getCapabilities(type: string, role: string): string[] {
    return getRoleCapabilities(type as any, role);
  }
}

class FeatureFlagServiceImpl implements FeatureFlagService {
  isEnabled(flag: string): boolean {
    // Minimal default: read boolean-like env, fallback to false
    const val = (process.env?.[flag] ?? process.env?.[`EXPO_PUBLIC_${flag}`]) as string | undefined;
    if (val === undefined) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(val).toLowerCase());
  }
}

// Register defaults (safe: no side effects until resolved)
import { StorageAdapter } from '../adapters/storage';
import { AuthAdapter } from '../adapters/auth';
import { AIProxyAdapter } from '../adapters/ai';

// Use lazy imports to break circular dependencies
// Services will only be imported when actually resolved
container
  .registerFactory(TOKENS.organization, () => new OrganizationServiceImpl(), { singleton: true })
  .registerFactory(TOKENS.features, () => new FeatureFlagServiceImpl(), { singleton: true })
  .registerFactory(TOKENS.storage, () => new StorageAdapter(), { singleton: true })
  .registerFactory(TOKENS.auth, () => new AuthAdapter(), { singleton: true })
  .registerFactory(TOKENS.ai, () => new AIProxyAdapter(), { singleton: true })
  .registerFactory(TOKENS.eventBus, async () => {
    const { EventBusService } = await import('../../../services/EventBus');
    return new EventBusService();
  }, { singleton: true })
  .registerFactory(TOKENS.memory, async () => {
    const { MemoryServiceClass } = await import('../../../services/MemoryService');
    return new MemoryServiceClass();
  }, { singleton: true })
  .registerFactory(TOKENS.lessons, async () => {
    const { LessonsService } = await import('../../../services/LessonsService');
    return new LessonsService();
  }, { singleton: true })
  .registerFactory(TOKENS.sms, async () => {
    const { SMSService } = await import('../../../services/SMSService');
    return new SMSService();
  }, { singleton: true })
  .registerFactory(TOKENS.googleCalendar, async () => {
    const { GoogleCalendarService } = await import('../../../services/GoogleCalendarService');
    return new GoogleCalendarService();
  }, { singleton: true })
  .registerFactory(TOKENS.dashTaskAutomation, async () => {
    const { DashTaskAutomation } = await import('../../../services/DashTaskAutomation');
    return new DashTaskAutomation();
  }, { singleton: true })
  .registerFactory(TOKENS.dashDecisionEngine, async () => {
    const { DashDecisionEngine } = await import('../../../services/DashDecisionEngine');
    return new DashDecisionEngine();
  }, { singleton: true })
  .registerFactory(TOKENS.dashNavigation, async () => {
    const { DashNavigationHandler } = await import('../../../services/DashNavigationHandler');
    return new DashNavigationHandler();
  }, { singleton: true })
  .registerFactory(TOKENS.dashWebSearch, async () => {
    const { DashWebSearchService } = await import('../../../services/DashWebSearchService');
    return new DashWebSearchService();
  }, { singleton: true })
  .registerFactory(TOKENS.semanticMemory, async () => {
    const { SemanticMemoryEngine } = await import('../../../services/SemanticMemoryEngine');
    return new SemanticMemoryEngine();
  }, { singleton: true })
  .registerFactory(TOKENS.dashProactive, async () => {
    const { DashProactiveEngine } = await import('../../../services/DashProactiveEngine');
    return new DashProactiveEngine();
  }, { singleton: true })
  .registerFactory(TOKENS.dashDiagnostic, async () => {
    const { DashDiagnosticEngine } = await import('../../../services/DashDiagnosticEngine');
    return new DashDiagnosticEngine();
  }, { singleton: true })
  .registerFactory(TOKENS.dashAI, async () => {
    const { DashAIAssistant } = await import('../../../services/dash-ai/DashAICompat');
    return DashAIAssistant.getInstance() as any;
  }, { singleton: true })
  .registerFactory(TOKENS.dashWhatsApp, async () => {
    const { DashWhatsAppIntegration } = await import('../../../services/DashWhatsAppIntegration');
    return new DashWhatsAppIntegration();
  }, { singleton: true })
  .registerFactory(TOKENS.dashContextAnalyzer, async () => {
    const { DashContextAnalyzer } = await import('../../../services/DashContextAnalyzer');
    return new DashContextAnalyzer();
  }, { singleton: true })
  .registerFactory(TOKENS.dashRealTimeAwareness, async () => {
    const { DashRealTimeAwareness } = await import('../../../services/DashRealTimeAwareness');
    return new DashRealTimeAwareness();
  }, { singleton: true })
  .registerFactory(TOKENS.dashAgenticEngine, async () => {
    const { DashAgenticEngine } = await import('../../../services/DashAgenticEngine');
    return new DashAgenticEngine();
  }, { singleton: true })
  .registerFactory(TOKENS.agentOrchestrator, async () => {
    const { AgentOrchestratorClass } = await import('../../../services/AgentOrchestrator');
    return new AgentOrchestratorClass();
  }, { singleton: true });

export { container, TOKENS };
