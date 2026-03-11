'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CreatorForm } from '@/components/creators/CreatorForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function CreateCreatorPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [vaultMode, setVaultMode] = useState<'sfw' | 'nsfw'>('sfw');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth');
    }
    
    if (session?.user?.vault_mode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVaultMode(session.user.vault_mode === 'nsfw' ? 'nsfw' : 'sfw');
    }
  }, [status, session, router]);

  const handleSuccess = () => {
    // Redirect to creators list after creation
    router.push('/creators');
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Create New Creator</h1>
          <p className="mt-2 text-foreground">
            {vaultMode === 'nsfw' 
              ? 'Create an NSFW creator persona' 
              : 'Create a new SFW creator persona'}
          </p>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Creator Details</CardTitle>
            <CardDescription className="text-muted-foreground">
              Set up your creator profile with name, handle, niche, and style
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatorForm 
              onSuccess={handleSuccess}
              vaultMode={vaultMode}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
