"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/context/WorkspaceContext";
import apiFetch from "@/lib/core/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

type Trait = { id: number; key: string; value: string };

export default function CreateInfluencerPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [niche, setNiche] = useState("Fitness");
  const [styleTemplate, setStyleTemplate] = useState("cinematic-fitness-photo");
  const [sfwAllowed, setSfwAllowed] = useState(true);
  const [nsfwAllowed, setNsfwAllowed] = useState(false);
  const [aiDisclosureRequired, setAiDisclosureRequired] = useState(true);
  const [lore, setLore] = useState("");
  
  const [traits, setTraits] = useState<Trait[]>([{ id: 1, key: 'mood', value: 'energetic' }]);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const handleTraitChange = (id: number, field: 'key' | 'value', value: string) => {
    setTraits(traits.map(trait => trait.id === id ? { ...trait, [field]: value } : trait));
  };

  const addTrait = () => {
    setTraits([...traits, { id: Date.now(), key: '', value: '' }]);
  };

  const removeTrait = (id: number) => {
    setTraits(traits.filter(trait => trait.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) {
      setError("Please select a workspace first.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const persona_traits = traits.reduce((acc, trait) => {
      if (trait.key) acc[trait.key] = trait.value;
      return acc;
    }, {} as Record<string, string>);

    const payload = {
      name,
      handle,
      bio,
      persona_traits,
      niche,
      style_template: styleTemplate,
      sfw_allowed: sfwAllowed,
      nsfw_allowed: nsfwAllowed,
      ai_disclosure_required: aiDisclosureRequired,
      lore,
    };

    try {
      const response = await apiFetch(`/workspaces/${currentWorkspace.id}/influencers`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create influencer");
      }

      const newInfluencer = await response.json();
      setSuccess(`Influencer "${newInfluencer.name}" created successfully! Redirecting...`);
      setTimeout(() => router.push("/influencers"), 2000);
    } catch (error: any) {
      setError(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Influencer Factory</CardTitle>
          <CardDescription>
            Design your new AI influencer persona. Define their identity, style, and backstory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">Username / Handle</Label>
                <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} required />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            {/* Persona Traits */}
            <div className="space-y-4">
              <Label>Personality Traits</Label>
              {traits.map((trait, index) => (
                <div key={trait.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Trait Name (e.g., humor)"
                    value={trait.key}
                    onChange={(e) => handleTraitChange(trait.id, 'key', e.target.value)}
                  />
                  <Input
                    placeholder="Trait Value (e.g., sarcastic)"
                    value={trait.value}
                    onChange={(e) => handleTraitChange(trait.id, 'value', e.target.value)}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTrait(trait.id)} disabled={traits.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTrait}>
                Add Trait
              </Button>
            </div>
            
            {/* Niche & Style */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="niche">Content Niche</Label>
                    <Input id="niche" value={niche} onChange={(e) => setNiche(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="styleTemplate">Visual Style Template</Label>
                    <Input id="styleTemplate" value={styleTemplate} onChange={(e) => setStyleTemplate(e.target.value)} required />
                </div>
            </div>

            {/* Backstory */}
            <div className="space-y-2">
                <Label htmlFor="lore">Lore / Backstory</Label>
                <Textarea id="lore" value={lore} onChange={(e) => setLore(e.target.value)} rows={5} />
            </div>
            
            <div className="space-y-4 pt-4">
                <div className="flex items-center space-x-2">
                    <Checkbox id="sfwAllowed" checked={sfwAllowed} onCheckedChange={(c) => setSfwAllowed(!!c)} />
                    <Label htmlFor="sfwAllowed">SFW Content Allowed</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="nsfwAllowed" checked={nsfwAllowed} onCheckedChange={(c) => setNsfwAllowed(!!c)} />
                    <Label htmlFor="nsfwAllowed">NSFW Content Allowed (Vault)</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Checkbox id="aiDisclosureRequired" checked={aiDisclosureRequired} onCheckedChange={(c) => setAiDisclosureRequired(!!c)} />
                    <Label htmlFor="aiDisclosureRequired">AI Disclosure Required</Label>
                </div>
            </div>

            <Button type="submit" disabled={!currentWorkspace || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Influencer"}
            </Button>

            {error && <div className="p-4 mt-4 bg-red-100 text-red-700 rounded-md">{error}</div>}
            {success && <div className="p-4 mt-4 bg-green-100 text-green-700 rounded-md">{success}</div>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persona Tips</CardTitle>
          <CardDescription>Guide to creating a compelling AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p><strong>Name & Handle:</strong> Make it memorable and unique.</p>
          <p><strong>Personality Traits:</strong> These directly influence the AI&apos;s voice. Use descriptive words (e.g., &apos;witty&apos;, &apos;inspirational&apos;, &apos;reserved&apos;).</p>
          <p><strong>Niche:</strong> A focused niche (e.g., &apos;vegan bodybuilding&apos;, &apos;retro gaming&apos;) helps build a dedicated audience.</p>
          <p><strong>Visual Style:</strong> This is a prompt fragment that defines the look. E.g., &apos;80s synthwave aesthetic&apos; or &apos;hyperrealistic fitness photography&apos;.</p>
          <p><strong>Lore:</strong> A good backstory makes the character more believable. Where are they from? What are their goals?</p>
        </CardContent>
      </Card>
    </div>
  );
}
