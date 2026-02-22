import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface VoiceSettingsContextValue {
  voiceEnabled: boolean;
  setVoiceEnabled: (next: boolean) => void;
  toggleVoiceEnabled: () => void;
}

const VOICE_ENABLED_STORAGE_KEY = 'trix_voice_enabled';

const VoiceSettingsContext = createContext<VoiceSettingsContextValue | undefined>(undefined);

function readInitialVoiceEnabled(): boolean {
  const stored = localStorage.getItem(VOICE_ENABLED_STORAGE_KEY);
  if (stored === 'true') {
    return true;
  }
  if (stored === 'false') {
    return false;
  }
  return true;
}

export const VoiceSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [voiceEnabled, setVoiceEnabledState] = useState<boolean>(() => readInitialVoiceEnabled());

  const setVoiceEnabled = (next: boolean) => {
    setVoiceEnabledState(next);
    localStorage.setItem(VOICE_ENABLED_STORAGE_KEY, String(next));
  };

  const toggleVoiceEnabled = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  const value = useMemo<VoiceSettingsContextValue>(() => ({
    voiceEnabled,
    setVoiceEnabled,
    toggleVoiceEnabled,
  }), [voiceEnabled]);

  return (
    <VoiceSettingsContext.Provider value={value}>
      {children}
    </VoiceSettingsContext.Provider>
  );
};

export function useVoiceSettings(): VoiceSettingsContextValue {
  const context = useContext(VoiceSettingsContext);
  if (!context) {
    throw new Error('useVoiceSettings must be used within VoiceSettingsProvider');
  }
  return context;
}
