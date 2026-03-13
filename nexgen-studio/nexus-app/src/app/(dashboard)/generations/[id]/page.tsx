'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import apiFetch from '@/lib/core/api';

interface Generation {
  id: string;
  creator_id: string;
  user_id: string;
  prompt: string;
  negative_prompt: string;
  model: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message: string | null;
  parameters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function GenerationDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const generationId = params.id as string;

  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchGeneration = async () => {
      if (!session?.user?.accessToken || !generationId) return;

      try {
        const response = await apiFetch(`/generations/${generationId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch generation');
        }

        const data = await response.json();
        setGeneration(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.accessToken && generationId) {
      fetchGeneration();
    }
  }, [session, generationId]);

  const handleRetry = async () => {
    if (!generation || retrying) return;
    setRetrying(true);
    try {
      const res = await apiFetch('/generations', {
        method: 'POST',
        body: JSON.stringify({
          creator_id: generation.creator_id,
          prompt: generation.prompt,
          negative_prompt: generation.negative_prompt ?? '',
          model: generation.model,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail || 'Retry failed');
      }
      const data = (await res.json()) as { id: string };
      router.push(`/generations/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    );
  }

  if (error || !generation) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="rounded-md bg-red-50 p-4 text-red-800 mb-4">
          {error || 'Generation not found'}
        </div>
        <Link href="/generations">
          <Button variant="outline">Back to Generations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/generations">
          <Button variant="outline" className="mb-4">← Back</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">Generation {generationId.slice(0, 8)}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(generation.status)}`}>
              {generation.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Created {new Date(generation.created_at).toLocaleDateString()} at {new Date(generation.created_at).toLocaleTimeString()}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
              Prompt
            </h2>
            <p className="text-foreground whitespace-pre-wrap">{generation.prompt}</p>
          </div>

          {generation.negative_prompt && (
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
                Negative Prompt
              </h2>
              <p className="text-foreground whitespace-pre-wrap">{generation.negative_prompt}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Model
              </h3>
              <p className="text-foreground">{generation.model}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Creator ID
              </h3>
              <p className="text-foreground font-mono text-sm">{generation.creator_id.slice(0, 8)}</p>
            </div>
          </div>

          {generation.parameters && Object.keys(generation.parameters).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">
                Parameters
              </h2>
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(generation.parameters, null, 2)}
              </pre>
            </div>
          )}

          {generation.error_message && (
            <div className="rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-950/30 dark:text-red-200">
              <h3 className="font-semibold mb-2">Error</h3>
              <p className="text-sm">{generation.error_message}</p>
            </div>
          )}

          {generation.status === 'failed' && (
            <div className="pt-4 border-t">
              <Button onClick={handleRetry} disabled={retrying}>
                {retrying ? 'Creating…' : 'Retry with same prompt'}
              </Button>
            </div>
          )}

          {generation.status === 'completed' && (
            <div className="pt-4 border-t">
              <Link href="/assets">
                <Button className="w-full">View Generated Assets</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
