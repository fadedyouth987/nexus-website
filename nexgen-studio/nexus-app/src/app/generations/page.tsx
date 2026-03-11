'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ImagePlus } from 'lucide-react';
import apiFetch from '@/lib/core/api';

interface Generation {
  id: string;
  creator_id: string;
  prompt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export default function GenerationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [vaultMode, setVaultMode] = useState<'sfw' | 'nsfw'>('sfw');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.vault_mode && (session.user.vault_mode === 'sfw' || session.user.vault_mode === 'nsfw')) {
      setVaultMode(session.user.vault_mode);
    }
  }, [session]);

  useEffect(() => {
    const fetchGenerations = async () => {
      if (!session?.user?.accessToken) return;

      try {
        const response = await apiFetch('/generations');

        if (response.ok) {
          const data = await response.json();
          setGenerations(data);
        }
      } catch (err) {
        console.error('Failed to fetch generations:', err);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.accessToken) {
      fetchGenerations();
    }
  }, [session]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Image Generations</h1>
          <p className="text-muted-foreground mt-1">
            {vaultMode === 'nsfw' ? 'NSFW' : 'SFW'} vault · {generations.length} generations
          </p>
        </div>
        <Link href="/generations/create">
          <Button>Create New Generation</Button>
        </Link>
      </div>

      {generations.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="h-6 w-6" />}
          title="No generations yet"
          description="Create your first image generation to get started."
          action={
            <Button asChild>
              <Link href="/generations/create">Create your first generation</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Prompt
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {generations.map((gen) => (
                <tr key={gen.id} className="hover:bg-muted">
                  <td className="px-6 py-4 text-sm">
                    <p className="line-clamp-2 text-foreground">{gen.prompt}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(gen.status)}`}>
                        {gen.status.replace('_', ' ')}
                      </span>
                      {gen.status === 'failed' && gen.error_message && (
                        <p className="text-xs text-red-600 max-w-xs truncate" title={gen.error_message}>
                          {gen.error_message}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(gen.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/generations/${gen.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
