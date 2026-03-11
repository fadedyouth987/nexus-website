'use client'

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import apiFetch from "@/lib/core/api";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function InfluencersListPage() {
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchInfluencers = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await apiFetch(`/workspaces/${currentWorkspace.id}/influencers`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to fetch influencers");
        }

        const data = await response.json();
        setInfluencers(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfluencers();
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return <div className="p-8">Please select a workspace to view influencers.</div>;
  }

  if (isLoading) {
    return <div className="p-8">Loading influencers...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Your AI Influencers</h1>
        <Link href="/influencers/create">
          <Button>Create New Influencer</Button>
        </Link>
      </div>

      {influencers.length === 0 ? (
        <p>No influencers created yet. Start by creating one!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {influencers.map((influencer) => (
            <Card key={influencer.id}>
              <CardHeader>
                <CardTitle>{influencer.name}</CardTitle>
                <p className="text-sm text-muted-foreground">@{influencer.handle}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-3">{influencer.bio}</p>
                <Link href={`/influencers/${influencer.id}`}>
                  <Button variant="link" className="px-0 mt-2">
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
