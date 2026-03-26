'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  defaultGenerationSettings,
  mergeGenerationSettings,
  type GenerationSettings,
  type LoRASetting,
} from '@/modules/video-jobs/generation-settings'

export type { GenerationSettings, LoRASetting } from '@/modules/video-jobs/generation-settings'

interface GenerationContextType {
  settings: GenerationSettings
  updateSetting: <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => void
  addLoRA: (name: string, path: string) => void
  removeLoRA: (id: string) => void
  updateLoRA: (id: string, updates: Partial<LoRASetting>) => void
  resetSettings: () => void
  exportSettings: () => string
  importSettings: (json: string) => void
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined)

/**
 * Persisted generation UI: defaults on first paint, then `localStorage` in `useEffect` (see application-flow.md).
 */
export function GenerationProvider({ children }: { children: ReactNode }) {
  // Same initial state on server and client — hydrate from localStorage in useEffect (avoids hydration mismatch).
  const [settings, setSettings] = useState<GenerationSettings>(defaultGenerationSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem('generationSettings')
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings(mergeGenerationSettings(JSON.parse(raw)))
      } catch {
        /* keep defaults */
      }
    }
    setLoaded(true)
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem('generationSettings', JSON.stringify(settings))
    }
  }, [settings, loaded])

  const updateSetting = <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const addLoRA = (name: string, path: string) => {
    const id = Date.now().toString()
    setSettings(prev => ({
      ...prev,
      loras: [...prev.loras, { id, name, path, strength: 0.8, enabled: true }],
    }))
  }

  const removeLoRA = (id: string) => {
    setSettings(prev => ({
      ...prev,
      loras: prev.loras.filter(l => l.id !== id),
    }))
  }

  const updateLoRA = (id: string, updates: Partial<LoRASetting>) => {
    setSettings(prev => ({
      ...prev,
      loras: prev.loras.map(l => l.id === id ? { ...l, ...updates } : l),
    }))
  }

  const resetSettings = () => {
    setSettings(defaultGenerationSettings)
  }

  const exportSettings = () => {
    return JSON.stringify(settings, null, 2)
  }

  const importSettings = (json: string) => {
    try {
      const imported = JSON.parse(json)
      setSettings(mergeGenerationSettings(imported))
    } catch (e) {
      console.error('Failed to import settings:', e)
    }
  }

  return (
    <GenerationContext.Provider
      value={{
        settings,
        updateSetting,
        addLoRA,
        removeLoRA,
        updateLoRA,
        resetSettings,
        exportSettings,
        importSettings,
      }}
    >
      {children}
    </GenerationContext.Provider>
  )
}

export function useGenerationSettings() {
  const context = useContext(GenerationContext)
  if (context === undefined) {
    throw new Error('useGenerationSettings must be used within a GenerationProvider')
  }
  return context
}
