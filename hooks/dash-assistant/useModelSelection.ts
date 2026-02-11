/**
 * Model Selection
 *
 * Hook that manages AI model preference loading, persisting, and
 * super-admin Sonnet-4 filtering.
 *
 * @module hooks/dash-assistant/useModelSelection
 * @max-lines 200
 */

import { useEffect, useMemo, useCallback } from 'react';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';

export function useModelSelection(
  isSuperAdmin: boolean,
  setModelPrefLoaded: (loaded: boolean) => void,
  modelPrefLoaded: boolean,
) {
  const {
    availableModels: tierModels,
    selectedModel,
    setSelectedModel,
    canSelectModel,
  } = useAIModelSelection('chat_message');

  const availableModels = useMemo(() => {
    if (!isSuperAdmin) return tierModels;
    const filtered = tierModels.filter((model) => model.id.includes('sonnet-4'));
    return filtered.length > 0 ? filtered : tierModels;
  }, [tierModels, isSuperAdmin]);

  // Load stored preference
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
  }, [canSelectModel, setSelectedModel, setModelPrefLoaded]);

  // Persist on change
  useEffect(() => {
    if (!modelPrefLoaded) return;
    setPreferredModel(selectedModel, 'chat_message');
  }, [modelPrefLoaded, selectedModel]);

  // Ensure super-admin has a valid selection
  useEffect(() => {
    if (!isSuperAdmin) return;
    if (availableModels.length === 0) return;
    if (!availableModels.find((model) => model.id === selectedModel)) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, isSuperAdmin, selectedModel, setSelectedModel]);

  return {
    availableModels,
    selectedModel,
    setSelectedModel,
  };
}
