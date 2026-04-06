'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import apiFetch from '@/lib/core/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { sanitizeModelName } from '@/lib/models/moderation'

type ClassifierLabel = 'SFW' | 'NSFW-mild' | 'NSFW-explicit' | 'UNCERTAIN'
type ModelType = 'checkpoint' | 'lora' | 'vae'

type ClassifierResult = {
  label: ClassifierLabel
  score: number
  isNsfw: boolean
  requiredVerificationLevel: 0 | 1 | 2
}

type ModelItem = {
  id: string
  name: string
  type: ModelType
  file_size: number
  status: string
  is_nsfw: boolean
  required_verification_level: number
  created_at: string
  meta_json?: {
    classifier?: ClassifierResult
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exp
  return `${value.toFixed(exp === 0 || value >= 100 ? 0 : 1)} ${units[exp]}`
}

function levelBadge(level: number) {
  if (level >= 2) return 'Level 2'
  if (level >= 1) return 'Level 1'
  return 'Unverified'
}

type ModelUploadPanelProps = {
  onStatsChange?: (stats: { verificationLevel: number; modelCount: number }) => void
}

export function ModelUploadPanel({ onStatsChange }: ModelUploadPanelProps) {
  const [models, setModels] = useState<ModelItem[]>([])
  const [modelType, setModelType] = useState<ModelType>('checkpoint')
  const [modelName, setModelName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [nsfwOptIn, setNsfwOptIn] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loadingModels, setLoadingModels] = useState(true)
  const [userVerificationLevel, setUserVerificationLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [classifier, setClassifier] = useState<ClassifierResult | null>(null)

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const response = await apiFetch('/models?page=1&page_size=50')
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || 'Failed to load models')
      }

      const items = Array.isArray((payload as { items?: unknown[] }).items)
        ? ((payload as { items: ModelItem[] }).items)
        : []
      const verificationLevel = Number((payload as { userVerificationLevel?: number }).userVerificationLevel || 0)

      setModels(items)
      setUserVerificationLevel(Number.isFinite(verificationLevel) ? Math.max(0, Math.floor(verificationLevel)) : 0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load models')
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  useEffect(() => {
    onStatsChange?.({
      verificationLevel: userVerificationLevel,
      modelCount: models.length,
    })
  }, [models.length, onStatsChange, userVerificationLevel])

  const canUpload = useMemo(
    () => Boolean(file && modelName.trim() && !uploading),
    [file, modelName, uploading]
  )

  const submitUpload = async () => {
    if (!file || !modelName.trim()) return
    setUploading(true)
    setError(null)
    setMessage(null)
    setClassifier(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', modelType)
      formData.append('name', modelName.trim())
      formData.append('nsfw', String(nsfwOptIn))

      const response = await fetch('/api/models/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || 'Upload failed')
      }

      const uploaded = payload as { classifier?: ClassifierResult }
      if (uploaded.classifier) {
        setClassifier(uploaded.classifier)
      }
      setMessage('Model uploaded and queued for validation.')
      setFile(null)
      setModelName('')
      await loadModels()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-border bg-background text-foreground">
      <CardHeader>
        <CardTitle>Model Upload & Moderation</CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload model assets, classify NSFW risk, and gate access by verification level.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Verification: {levelBadge(userVerificationLevel)}</Badge>
          <a
            href="/settings/verification"
            className="text-xs text-primary underline hover:no-underline"
          >
            Age verification &amp; NSFW access
          </a>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="library">My Models</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <div
              className="rounded-lg border border-dashed border-border bg-muted/20 p-5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const dropped = event.dataTransfer.files?.[0]
                if (dropped) setFile(dropped)
              }}
            >
              <p className="text-sm text-muted-foreground">Drag-and-drop a model file, or choose from disk.</p>
              <Input
                type="file"
                accept=".safetensors,.ckpt,.pt"
                className="mt-3"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
              {file ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {file.name} ({formatBytes(file.size)})
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model-type">Model Type</Label>
                <Select value={modelType} onValueChange={(value) => setModelType(value as ModelType)}>
                  <SelectTrigger id="model-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checkpoint">checkpoint</SelectItem>
                    <SelectItem value="lora">lora</SelectItem>
                    <SelectItem value="vae">vae</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                  onBlur={() => setModelName((prev) => sanitizeModelName(prev))}
                  placeholder="my-model-v1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Creator NSFW opt-in</p>
                <p className="text-xs text-muted-foreground">
                  Mark upload as NSFW to route into age-gated moderation/storage.
                </p>
              </div>
              <Switch checked={nsfwOptIn} onCheckedChange={setNsfwOptIn} />
            </div>

            <Button onClick={submitUpload} disabled={!canUpload}>
              {uploading ? 'Uploading...' : 'Upload model'}
            </Button>

            {classifier ? (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium">Classifier Result</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {classifier.label} (score {classifier.score.toFixed(2)}) - required verification level{' '}
                  {classifier.requiredVerificationLevel}
                </p>
                {classifier.isNsfw && userVerificationLevel < classifier.requiredVerificationLevel ? (
                  <p className="mt-2 text-xs text-amber-300">
                    Your verification level is below the requirement. Complete verification to access this asset.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              To upload or view NSFW models, complete age verification, terms, and OTP in{' '}
              <a href="/settings/verification" className="text-primary underline">Settings → Age &amp; NSFW</a>.
            </p>
          </TabsContent>

          <TabsContent value="library" className="pt-4">
            {loadingModels ? (
              <p className="text-sm text-muted-foreground">Loading models...</p>
            ) : models.length === 0 ? (
              <p className="text-sm text-muted-foreground">No models uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">NSFW</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((item) => {
                      const requiredLevel = Number(item.required_verification_level || 0)
                      const canAccess = userVerificationLevel >= requiredLevel
                      const classifierLabel = item.meta_json?.classifier?.label || 'n/a'

                      return (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">classifier: {classifierLabel}</p>
                          </td>
                          <td className="px-3 py-2">{item.type}</td>
                          <td className="px-3 py-2">{item.status}</td>
                          <td className="px-3 py-2">{formatBytes(item.file_size)}</td>
                          <td className="px-3 py-2">
                            {item.is_nsfw ? `Yes (L${requiredLevel})` : 'No'}
                          </td>
                          <td className="px-3 py-2">{new Date(item.created_at).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {!item.is_nsfw || canAccess ? (
                              <a
                                href={`/api/models/serve?id=${encodeURIComponent(item.id)}`}
                                className="text-primary underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Download
                              </a>
                            ) : (
                              <a href="/settings/verification" className="text-xs text-amber-600 dark:text-amber-400 underline">
                                Age verification required
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>NSFW Warning: Explicit content requires Level 2 verification and stricter moderation controls.</p>
          <p>Privacy: ID/selfie data should remain with the verification provider; only provider reference IDs are stored.</p>
          <p>Compliance: Keep moderation audit logs, takedown workflow, and appeals workflow enabled before production rollout.</p>
        </div>
      </CardContent>
    </Card>
  )
}
