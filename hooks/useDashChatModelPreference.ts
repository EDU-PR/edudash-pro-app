import { useEffect, useMemo, useState } from 'react';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';
import { getDefaultModels, type AIModelId, type AIModelInfo, type SubscriptionTier } from '@/lib/ai/models';
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences';

interface DashChatModelPreferenceState {
  availableModels: AIModelInfo[];
  allModels: AIModelInfo[];
  selectedModel: AIModelId;
  setSelectedModel: (modelId: AIModelId) => void;
  tier: SubscriptionTier;
  canSelectModel: (modelId: AIModelId) => boolean;
  isLoading: boolean;
}

export function useDashChatModelPreference(): DashChatModelPreferenceState {
  const [modelPrefLoaded, setModelPrefLoaded] = useState(false);
  const {
    availableModels,
    selectedModel,
    setSelectedModel,
    canSelectModel,
    tier,
    isLoading,
  } = useAIModelSelection('chat_message');

  const allModels = useMemo(() => getDefaultModels(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getPreferredModel('chat_message');
      if (!mounted) return;
      if (stored && canSelectModel(stored as AIModelId)) {
        setSelectedModel(stored as AIModelId);
      }
      setModelPrefLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [canSelectModel, setSelectedModel]);

  useEffect(() => {
    if (!modelPrefLoaded) return;
    setPreferredModel(selectedModel, 'chat_message');
  }, [modelPrefLoaded, selectedModel]);

  useEffect(() => {
    if (availableModels.length === 0) return;
    if (!availableModels.find((model) => model.id === selectedModel)) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel, setSelectedModel]);

  return {
    availableModels,
    allModels,
    selectedModel,
    setSelectedModel,
    tier,
    canSelectModel,
    isLoading,
  };
}

export default useDashChatModelPreference;
