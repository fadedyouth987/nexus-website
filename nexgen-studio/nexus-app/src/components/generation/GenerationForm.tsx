'use client';

import { useState, useEffect } from 'react';
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

interface Creator {
  id: string;
  name: string;
  vault_mode: 'sfw' | 'nsfw';
}

interface GenerationFormProps {
  onSuccess?: () => void;
  vaultMode?: 'sfw' | 'nsfw';
}

export function GenerationForm({ onSuccess, vaultMode = 'sfw' }: GenerationFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);

  const [formData, setFormData] = useState({
    creator_id: '',
    prompt: '',
    negative_prompt: '',
    model: 'stable-diffusion',
  });

  // Fetch creators for the current vault
  useEffect(() => {
    const fetchCreators = async () => {
      if (!session?.user?.accessToken) return;

      try {
        const response = await apiFetch(`/creators?vault_mode=${vaultMode}`);

        if (response.ok) {
          const data = await response.json();
          setCreators(data);
        }
      } catch (err) {
        console.error('Failed to fetch creators:', err);
      } finally {
        setLoadingCreators(false);
      }
    };

    fetchCreators();
  }, [session, vaultMode]);

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

    if (!formData.creator_id) {
      setError('Please select a creator');
      setLoading(false);
      return;
    }

    if (!formData.prompt.trim()) {
      setError('Prompt is required');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/generations', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create generation');
      }

      const data = await response.json();
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/generations/${data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground">
          Creator
        </label>
        <Select
          value={formData.creator_id}
          onValueChange={(value) => handleSelectChange('creator_id', value)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={loadingCreators ? "Loading creators..." : "Select a creator"} />
          </SelectTrigger>
          <SelectContent>
            {creators.map((creator) => (
              <SelectItem key={creator.id} value={creator.id}>
                {creator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-foreground">
          Prompt
        </label>
        <Textarea
          id="prompt"
          name="prompt"
          value={formData.prompt}
          onChange={handleChange}
          placeholder="Describe the image you want to generate..."
          required
          className="mt-1"
          rows={5}
        />
      </div>

      <div>
        <label htmlFor="negative_prompt" className="block text-sm font-medium text-foreground">
          Negative Prompt (Optional)
        </label>
        <Textarea
          id="negative_prompt"
          name="negative_prompt"
          value={formData.negative_prompt}
          onChange={handleChange}
          placeholder="What should NOT appear in the image..."
          className="mt-1"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Model
        </label>
        <Select
          value={formData.model}
          onValueChange={(value) => handleSelectChange('model', value)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable-diffusion">Stable Diffusion v1.5</SelectItem>
            <SelectItem value="stable-diffusion-2">Stable Diffusion v2</SelectItem>
            <SelectItem value="comfyui">ComfyUI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        disabled={loading || loadingCreators}
        className="w-full"
      >
        {loading ? 'Generating...' : 'Generate Image'}
      </Button>
    </form>
  );
}
