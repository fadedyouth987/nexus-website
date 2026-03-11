'use client'

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import apiFetch from '@/lib/core/api';

export default function InfluencerPage({
  params,
}: {
  params: { influencerId: string };
}) {
  const router = useRouter();
  const [influencer, setInfluencer] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    bio: '',
    niche: '',
    style_template: '',
    lore: '',
    sfw_allowed: true,
    nsfw_allowed: false,
    ai_disclosure_required: true,
  });

  useEffect(() => {
    const fetchInfluencerAndAssets = async () => {
      try {
        const influencerResponse = await apiFetch(`/influencers/${params.influencerId}`);
        if (!influencerResponse.ok) throw new Error('Failed to fetch influencer');
        const influencerData = await influencerResponse.json();
        setInfluencer(influencerData);
        setFormData({
            name: influencerData.name,
            handle: influencerData.handle,
            bio: influencerData.bio,
            niche: influencerData.niche,
            style_template: influencerData.style_template,
            lore: influencerData.lore,
            sfw_allowed: influencerData.sfw_allowed,
            nsfw_allowed: influencerData.nsfw_allowed,
            ai_disclosure_required: influencerData.ai_disclosure_required,
        });

        const assetsResponse = await apiFetch(`/influencers/${params.influencerId}/assets`);
        if (!assetsResponse.ok) throw new Error('Failed to fetch assets');
        const assetsData = await assetsResponse.json();
        setAssets(assetsData);
      } catch (err: any) {
        setError(err.message);
      }
    };
    fetchInfluencerAndAssets();
  }, [params.influencerId, router]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name: keyof typeof formData, checked: boolean) => {
    setFormData(prev => ({...prev, [name]: checked }));
  }

  const handleUpdateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
        const response = await apiFetch(`/influencers/${params.influencerId}`, {
            method: 'PATCH',
            body: JSON.stringify(formData),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update influencer');
        }
        const updatedInfluencer = await response.json();
        setInfluencer(updatedInfluencer);
        setIsEditing(false);
        alert('Influencer updated successfully!');
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteInfluencer = async () => {
    if (!window.confirm(`Are you sure you want to delete ${influencer?.name}?`)) {
        return;
    }
    try {
        await apiFetch(`/influencers/${params.influencerId}`, { method: 'DELETE' });
        alert('Influencer deleted successfully!');
        router.push('/influencers');
    } catch (err: any) {
        setError(err.message);
    }
  };
  
  // ... other functions like handleGenerate

  return (
    <div className="p-8">
      {/* ... header ... */}
      {influencer && (
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            {/* ... other tabs ... */}
          </TabsList>
          <TabsContent value="details">
            <Card className="w-full max-w-2xl mt-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Influencer Details</CardTitle>
                  <CardDescription>View and edit influencer information.</CardDescription>
                </div>
                {!isEditing && (
                  <Button onClick={() => setIsEditing(true)}>Edit Influencer</Button>
                )}
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <form onSubmit={handleUpdateSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name:</Label>
                      <Input id="name" name="name" value={formData.name} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="handle">Handle:</Label>
                      <Input id="handle" name="handle" value={formData.handle} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio:</Label>
                      <Textarea id="bio" name="bio" value={formData.bio} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="niche">Niche:</Label>
                      <Input id="niche" name="niche" value={formData.niche} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="style_template">Style Template:</Label>
                      <Input id="style_template" name="style_template" value={formData.style_template} onChange={handleFormChange} />
                    </div>
                    <div>
                      <Label htmlFor="lore">Lore:</Label>
                      <Textarea id="lore" name="lore" value={formData.lore} onChange={handleFormChange} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="sfw_allowed" name="sfw_allowed" checked={formData.sfw_allowed} onCheckedChange={(checked) => handleCheckboxChange('sfw_allowed', !!checked)} />
                        <Label htmlFor="sfw_allowed">SFW Allowed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="nsfw_allowed" name="nsfw_allowed" checked={formData.nsfw_allowed} onCheckedChange={(checked) => handleCheckboxChange('nsfw_allowed', !!checked)} />
                        <Label htmlFor="nsfw_allowed">NSFW Allowed</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="ai_disclosure_required" name="ai_disclosure_required" checked={formData.ai_disclosure_required} onCheckedChange={(checked) => handleCheckboxChange('ai_disclosure_required', !!checked)} />
                        <Label htmlFor="ai_disclosure_required">AI Disclosure Required</Label>
                    </div>
                    <div className="flex space-x-2">
                        <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div><Label>Name:</Label><p>{influencer.name}</p></div>
                    <div><Label>Handle:</Label><p>{influencer.handle}</p></div>
                    <div><Label>Bio:</Label><p className="whitespace-pre-wrap">{influencer.bio}</p></div>
                    <div><Label>Niche:</Label><p>{influencer.niche}</p></div>
                    <div><Label>Style Template:</Label><p>{influencer.style_template}</p></div>
                    <div><Label>Lore:</Label><p className="whitespace-pre-wrap">{influencer.lore}</p></div>
                    <div><Label>SFW Allowed:</Label><p>{influencer.sfw_allowed ? 'Yes' : 'No'}</p></div>
                    <div><Label>NSFW Allowed:</Label><p>{influencer.nsfw_allowed ? 'Yes' : 'No'}</p></div>
                    <div><Label>AI Disclosure Required:</Label><p>{influencer.ai_disclosure_required ? 'Yes' : 'No'}</p></div>
                    <Button variant="destructive" onClick={handleDeleteInfluencer}>Delete Influencer</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* ... other TabsContent ... */}
        </Tabs>
      )}
    </div>
  );
}
