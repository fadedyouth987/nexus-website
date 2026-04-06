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

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('generationSettings')
      if (saved) {
        try {
          return mergeGenerationSettings(JSON.parse(saved))
        } catch {
          return defaultGenerationSettings
        }
      }
    }
    return defaultGenerationSettings
  })
  const [loaded, setLoaded] = useState(false)

  // Mark as loaded once the first render is done (client-side)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true)
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (loaded && typeof window !== 'undefined') {
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
