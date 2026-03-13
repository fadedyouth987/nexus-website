'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspace } from '@/context/WorkspaceContext'
import apiFetch from '@/lib/core/api'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'

type Step = 'form' | 'generating' | 'select' | 'done'

const DEFAULT_FACE_PROMPT =
  'portrait of a person, face shot, professional photo, neutral expression, soft lighting, high quality, photorealistic'

export default function CreateInfluencerPage() {
  const { status } = useSession()
  const router = useRouter()
  const { currentWorkspace } = useWorkspace()

  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [niche, setNiche] = useState('')
  const [stylePrompt, setStylePrompt] = useState(DEFAULT_FACE_PROMPT)
  const [error, setError] = useState<string | null>(null)
  const [influencerId, setInfluencerId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [assets, setAssets] = useState<Array<{ id: string; storage_url: string; kind: string }>>([])
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [lockLoading, setLockLoading] = useState(false)

  const loadJobDetails = useCallback(async (id: string) => {
    const res = await apiFetch(`/generate/${id}`)
    if (!res.ok) return
    const payload = (await res.json()) as { job?: unknown; assets?: Array<{ id: string; storage_url: string; kind: string }> }
    const nextAssets = Array.isArray(payload.assets) ? payload.assets : []
    setAssets(nextAssets)

    const signed = await Promise.all(
      nextAssets.map(async (a) => {
        const r = await apiFetch(`/assets/${a.id}/signed-url`)
        if (!r.ok) return null
        const data = (await r.json()) as { signedUrl?: string }
        return data.signedUrl ? [a.id, data.signedUrl] as const : null
      })
    )
    const urlMap: Record<string, string> = {}
    for (const entry of signed) {
      if (entry) urlMap[entry[0]] = entry[1]
    }
    setAssetUrls(urlMap)
  }, [])

  const handleCreateAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!currentWorkspace?.id) {
      setError('Please select a workspace first.')
      return
    }
    if (!name.trim() || !handle.trim() || !niche.trim()) {
      setError('Name, handle, and niche are required.')
      return
    }

    setStep('generating')

    try {
      const createRes = await apiFetch(`/workspaces/${currentWorkspace.id}/influencers`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          handle: handle.trim(),
          niche: niche.trim(),
          style_template: stylePrompt.trim() || 'default',
        }),
      })
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail || 'Failed to create influencer')
      }
      const newInfluencer = (await createRes.json()) as { id: string }
      setInfluencerId(newInfluencer.id)

      const wfRes = await apiFetch('/workflow-templates?mode=IMAGE')
      if (!wfRes.ok) throw new Error('Failed to load workflows')
      const wfPayload = (await wfRes.json()) as { items?: Array<{ id: string; type: string }> }
      const templates = Array.isArray(wfPayload?.items) ? wfPayload.items : []
      const imageTemplate = templates.find((t) => t.type === 'IMAGE')
      if (!imageTemplate) throw new Error('No image workflow template found')

      const genRes = await apiFetch('/generate', {
        method: 'POST',
        body: JSON.stringify({
          influencerId: newInfluencer.id,
          workflowTemplateId: imageTemplate.id,
          mode: 'IMAGE',
          inputs: {
            prompt: stylePrompt.trim() || DEFAULT_FACE_PROMPT,
            negative_prompt: 'blurry, low quality, distorted',
            batch_size: 4,
          },
        }),
      })
      if (!genRes.ok) {
        const data = await genRes.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail || 'Failed to start generation')
      }
      const genPayload = (await genRes.json()) as { jobId?: string }
      const jid = genPayload.jobId
      if (!jid) throw new Error('No job ID in response')
      setJobId(jid)

      const eventSource = new EventSource(`/api/generate/${jid}/events`)
      const onDone = () => {
        eventSource.close()
        void loadJobDetails(jid)
        setStep('select')
      }
      eventSource.addEventListener('snapshot', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as { job?: { status?: string } }
          if (data?.job?.status === 'READY' || data?.job?.status === 'FAILED') onDone()
        } catch { /* ignore */ }
      })
      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as { status?: string }
          if (data?.status === 'READY' || data?.status === 'FAILED') onDone()
        } catch { /* ignore */ }
      })
      eventSource.onerror = () => {
        eventSource.close()
        void loadJobDetails(jid)
        setStep('select')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('form')
    }
  }

  const handleLockIdentity = async () => {
    if (!influencerId || !selectedAssetId) return
    const asset = assets.find((a) => a.id === selectedAssetId)
    if (!asset?.storage_url) return

    setLockLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/influencers/${influencerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          reference_image_storage_key: asset.storage_url,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { detail?: string }).detail || 'Failed to lock identity')
      }
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock identity')
    } finally {
      setLockLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/create" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Create & Lock Influencer Identity
            </CardTitle>
            <CardDescription>
              Generate a unique face with ComfyUI, pick the one you love, and lock it. Every future
              generation will use this identity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!currentWorkspace && (
              <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Select a workspace from the sidebar to continue.
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 'form' && (
              <form onSubmit={handleCreateAndGenerate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handle">Handle / Username</Label>
                    <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="niche">Niche</Label>
                  <Input id="niche" value={niche} onChange={(e) => setNiche(e.target.value)} required placeholder="e.g. fitness, fashion" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stylePrompt">Face / style prompt (for generation)</Label>
                  <Textarea
                    id="stylePrompt"
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    rows={3}
                    placeholder="Describe the look you want for the base face..."
                  />
                </div>
                <Button type="submit" disabled={!currentWorkspace} className="w-full">
                  Create & Generate Face
                </Button>
              </form>
            )}

            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium">Generating your influencer&apos;s face...</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ComfyUI is creating 4 options. This may take a minute.
                </p>
              </div>
            )}

            {step === 'select' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pick the image that best represents your influencer. This will be locked and used for
                  all future generations.
                </p>
                {assets.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No images generated yet. Check back soon.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                          selectedAssetId === asset.id
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {assetUrls[asset.id] ? (
                          <img
                            src={assetUrls[asset.id]}
                            alt="Generated option"
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center bg-muted">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        )}
                        {selectedAssetId === asset.id && (
                          <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleLockIdentity}
                  disabled={!selectedAssetId || lockLoading}
                  className="w-full"
                >
                  {lockLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Lock Identity
                </Button>
              </div>
            )}

            {step === 'done' && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-lg font-medium">Identity locked</p>
                <p className="text-sm text-muted-foreground">
                  Your influencer is ready. Every generation will now use this face.
                </p>
                <div className="flex gap-3 pt-4">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/creators">View Creators</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/studio">Open Studio</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
