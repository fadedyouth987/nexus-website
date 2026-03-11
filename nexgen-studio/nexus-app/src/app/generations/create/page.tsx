'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GenerationProvider } from '@/context/GenerationContext';
import { GenerationPanel } from '@/components/generation/GenerationPanel';

export default function CreateGenerationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vaultMode, setVaultMode] = useState<'sfw' | 'nsfw'>('sfw');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.vault_mode && (session.user.vault_mode === 'sfw' || session.user.vault_mode === 'nsfw')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVaultMode(session.user.vault_mode);
    }
  }, [session]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    );
  }

  return (
    <GenerationProvider>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-2">Generate New Image</h1>
        <p className="text-muted-foreground mb-8">
          Create AI-generated images for your {vaultMode === 'nsfw' ? 'NSFW' : 'SFW'} creators.
        </p>

        <GenerationPanel />
      </div>
    </GenerationProvider>
  );
}
