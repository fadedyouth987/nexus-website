"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from '@/context/WorkspaceContext';
import apiFetch from "@/lib/core/api";


interface Influencer {
  id: string;
  name: string;
  handle?: string;
  niche?: string;
  bio?: string;
}

interface Asset {
  id: string;
  influencer_id: string;
  type: string;
  sfw_status: string;
  thumbnail_path: string;
  storage_path: string;
  meta: Record<string, any>;
}

const ALL_INFLUENCERS = "all_influencers";
const ALL_MEDIA_TYPES = "all_media_types";
const ALL_SFW_STATUSES = "all_sfw_statuses";

// Component that uses searchParams
function AssetsPageContent() {
  const searchParams = useSearchParams();
  const { currentWorkspace } = useWorkspace();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);

  const [selectedInfluencerId, setSelectedInfluencerId] = useState(searchParams.get("influencerId") || ALL_INFLUENCERS);
  const [selectedMediaType, setSelectedMediaType] = useState(ALL_MEDIA_TYPES);
  const [selectedSfwStatus, setSelectedSfwStatus] = useState(ALL_SFW_STATUSES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [infRes, assetRes] = await Promise.all([
            apiFetch(`/workspaces/${currentWorkspace.id}/influencers`),
            apiFetch(`/workspaces/${currentWorkspace.id}/assets`),
          ]);

          if (infRes.ok) {
            const infData = await infRes.json();
            setInfluencers(infData);
          }
          if (assetRes.ok) {
            const assetData = await assetRes.json();
            setAssets(assetData);
            setFilteredAssets(assetData); // Initially show all
          }
        } catch (error) {
          console.error("Failed to fetch asset data:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [currentWorkspace]);
  
  useEffect(() => {
    const influencerIdFromUrl = searchParams.get("influencerId");
    setSelectedInfluencerId(influencerIdFromUrl || ALL_INFLUENCERS);
  }, [searchParams]);

  useEffect(() => {
    let filtered = assets;

    if (selectedInfluencerId !== ALL_INFLUENCERS) {
      filtered = filtered.filter((asset) => asset.influencer_id === selectedInfluencerId);
    }
    if (selectedMediaType !== ALL_MEDIA_TYPES) {
      filtered = filtered.filter((asset) => asset.type === selectedMediaType);
    }
    if (selectedSfwStatus !== ALL_SFW_STATUSES) {
      filtered = filtered.filter((asset) => asset.sfw_status === selectedSfwStatus);
    }

    setFilteredAssets(filtered);
    // Note: For large datasets, filtering should be done on the backend via API query params.
  }, [selectedInfluencerId, selectedMediaType, selectedSfwStatus, assets]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Asset Library</h1>
        <Button asChild>
          <Link href="/studio">Generate New Asset</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <Label htmlFor="influencerFilter">Influencer</Label>
          <Select value={selectedInfluencerId} onValueChange={setSelectedInfluencerId}>
            <SelectTrigger id="influencerFilter">
              <SelectValue placeholder="All Influencers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_INFLUENCERS}>All Influencers</SelectItem>
              {influencers.map((influencer) => (
                <SelectItem key={influencer.id} value={influencer.id}>
                  {influencer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="mediaTypeFilter">Media Type</Label>
          <Select value={selectedMediaType} onValueChange={setSelectedMediaType}>
            <SelectTrigger id="mediaTypeFilter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MEDIA_TYPES}>All Types</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sfwStatusFilter">SFW Status</Label>
          <Select value={selectedSfwStatus} onValueChange={setSelectedSfwStatus}>
            <SelectTrigger id="sfwStatusFilter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SFW_STATUSES}>All Statuses</SelectItem>
              <SelectItem value="SAFE">Safe</SelectItem>
              <SelectItem value="SUGGESTIVE">Suggestive</SelectItem>
              <SelectItem value="EXPLICIT">Explicit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center col-span-full">Loading assets...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.id}>
              <CardContent className="p-0">
                <img
                  src={asset.thumbnail_path || asset.storage_path || "https://via.placeholder.com/256x256.png?text=Image+Not+Found"}
                  alt={asset.meta.prompt || 'Generated Asset'}
                  className="w-full h-48 object-cover rounded-t-lg"
                  onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/256x256.png?text=Image+Not+Found")}
                />
              </CardContent>
              <CardHeader className="p-4">
                <CardTitle className="text-base truncate" title={asset.meta.prompt}>
                  {asset.meta.prompt || "No prompt"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {influencers.find((i) => i.id === asset.influencer_id)?.name || "N/A"}
                </p>
                <div className="flex justify-between text-xs text-muted-foreground pt-2">
                  <span>{asset.type}</span>
                  <span>{asset.sfw_status}</span>
                </div>
              </CardHeader>
            </Card>
          ))}
          {filteredAssets.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground">No assets found matching your criteria.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AssetsPageContent />
    </Suspense>
  );
}
