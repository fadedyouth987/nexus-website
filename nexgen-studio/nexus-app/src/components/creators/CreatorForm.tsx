'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiFetch from '@/lib/core/api';

interface CreatorFormProps {
  onSuccess?: () => void;
  vaultMode?: 'sfw' | 'nsfw';
}

export function CreatorForm({ onSuccess, vaultMode = 'sfw' }: CreatorFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    niche: '',
    bio: '',
    style_template: 'default',
    vault_mode: vaultMode,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/creators', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create creator');
      }

      // Reset form
      setFormData({
        name: '',
        handle: '',
        niche: '',
        bio: '',
        style_template: 'default',
        vault_mode: vaultMode,
      });

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground">
          Creator Name
        </label>
        <Input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="e.g., Fitness Coach Anna"
          className="mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Handle/Username
        </label>
        <Input
          type="text"
          name="handle"
          value={formData.handle}
          onChange={handleChange}
          required
          placeholder="e.g., @fitcoachanna"
          className="mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Niche
        </label>
        <Input
          type="text"
          name="niche"
          value={formData.niche}
          onChange={handleChange}
          required
          placeholder="e.g., Fitness, Lifestyle, Tech"
          className="mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Bio
        </label>
        <Textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder="Creator bio and description"
          rows={4}
          className="mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Style Template
        </label>
        <Select value={formData.style_template} onValueChange={(value) => handleSelectChange('style_template', value)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="edgy">Edgy</SelectItem>
            <SelectItem value="minimalist">Minimalist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Creator'}
        </Button>
      </div>
    </form>
  );
}
