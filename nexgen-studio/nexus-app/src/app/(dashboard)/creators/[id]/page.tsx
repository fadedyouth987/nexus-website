'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppHero } from '@/components/layout/AppHero'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'

interface Influencer {
  id: string
  name: string
  handle?: string
  bio?: string
  niche?: string
  style_template?: string
  lore?: string
  reference_image_storage_key?: string | null
  reference_image_url?: string | null
  lora_model_path?: string | null
  sfw_allowed?: boolean
  nsfw_allowed?: boolean
}

export default function CreatorDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { status } = useSession()
  const { currentWorkspace } = useWorkspace()

  const [influencer, setInfluencer] = useState<Influencer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [loraModelPath, setLoraModelPath] = useState('')
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [niche, setNiche] = useState('')
  const [lore, setLore] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchInfluencer = useCallback(async () => {
    if (!params.id) return
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      if (currentWorkspace?.id) qs.set('workspace_id', currentWorkspace.id)
      const res = await apiFetch(`/api/influencers/${params.id}?${qs}`)
      const data = await res.json()
      setInfluencer(data)
      setName(data.name || '')
      setBio(data.bio || '')
      setNiche(data.niche || '')
      setLore(data.lore || '')
      setLoraModelPath(data.lora_model_path || '')

      if (data.reference_image_storage_key) {
        try {
          const urlResponse = await apiFetch(
            `/api/influencers/${params.id}/reference-image-url?key=${encodeURIComponent(data.reference_image_storage_key)}`
          )
          const urlRes = await urlResponse.json()
          if (urlRes?.signedUrl) setReferenceImageUrl(urlRes.signedUrl)
        } catch {
          /* signed URL not critical */
        }
      }
    } catch {
      setInfluencer(null)
    } finally {
      setLoading(false)
    }
  }, [params.id, currentWorkspace?.id])

  useEffect(() => {
    if (status === 'authenticated') fetchInfluencer()
  }, [status, fetchInfluencer])

  const handleSave = async () => {
    if (!influencer) return
    setSaving(true)
    setSaveMessage(null)
    try {
      await apiFetch(`/api/influencers/${influencer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          bio,
          niche,
          lore,
          lora_model_path: loraModelPath || null,
        }),
      })
      setSaveMessage('Saved successfully')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadReferenceImage = async (file: File) => {
    if (!influencer) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/influencers/${influencer.id}/reference-image`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Upload failed')
      }
      const data = await res.json()
      if (data.signedUrl) setReferenceImageUrl(data.signedUrl)
      setSaveMessage('Reference image uploaded')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!influencer) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground mb-4">Creator not found</p>
        <Button variant="outline" asChild>
          <Link href="/creators">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Creators
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AppHero
        title={influencer.name || 'Creator Profile'}
        description="Manage character identity, reference images, and LoRA model settings."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/creators">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Link>
            </Button>
            <Button variant="default" asChild>
              <Link href={`/studio?influencerId=${influencer.id}`}>
                <Sparkles className="w-4 h-4 mr-2" /> Generate
              </Link>
            </Button>
          </div>
        }
      />

      {saveMessage && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="bg-primary/10 text-primary border border-primary/20 rounded-md px-4 py-2 text-sm">
            {saveMessage}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 grid gap-6 md:grid-cols-2">
        {/* Reference Image Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" /> Reference Image
            </CardTitle>
            <CardDescription>
              Upload a face reference for character-consistent generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-square bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
              {referenceImageUrl ? (
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="text-center text-muted-foreground text-sm p-4">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No reference image set
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUploadReferenceImage(f)
              }}
            />

            <Button
              className="w-full"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {uploading ? 'Uploading...' : 'Upload Reference Image'}
            </Button>
          </CardContent>
        </Card>

        {/* LoRA Model Path Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> LoRA Model
            </CardTitle>
            <CardDescription>
              Path to the LoRA checkpoint for this creator&apos;s face/style.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lora_model_path">LoRA File Path</Label>
              <Input
                id="lora_model_path"
                placeholder="e.g. models/loras/creator-face-v1.safetensors"
                value={loraModelPath}
                onChange={(e) => setLoraModelPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Path relative to the ComfyUI models directory, or a full RunPod
                network-storage path.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              Basic info used across generation prompts and social posts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niche">Niche</Label>
                <Input
                  id="niche"
                  placeholder="e.g. fitness, fashion, tech"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lore">Lore / Backstory</Label>
              <Textarea
                id="lore"
                rows={3}
                placeholder="Character backstory for LLM context..."
                value={lore}
                onChange={(e) => setLore(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-8">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Character Identity'}
        </Button>
      </div>
    </div>
  )
}
