import React, { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import Image from 'next/image';
import { ScrollArea } from './ui/scroll-area';
import { useSafeMode } from '@/context/SafeModeContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useWorkspace } from '@/context/WorkspaceContext';
import apiFetch from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Asset = {
  id: string;
  thumbnail_path: string | null;
  meta: { prompt?: string };
  sfw_status: 'SAFE' | 'SUGGESTIVE' | 'EXPLICIT';
};

function DraggableAsset({ asset }: { asset: Asset }) {
  const { isSafeMode } = useSafeMode();
  const [isHovered, setIsHovered] = useState(false);
  const isNsfw = asset.sfw_status !== 'SAFE';
  const showBlurred = isSafeMode && isNsfw && !isHovered;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'ASSET',
    item: { id: asset.id, type: 'ASSET', isNsfw: isNsfw },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [asset.id, isNsfw, isSafeMode]);

  const handleDragStart = () => {
    localStorage.setItem('draggedAssetId', asset.id);
    localStorage.setItem('draggedAssetIsNsfw', String(isNsfw));
  };

  const handleDragEnd = () => {
    // It's safer to let the drop handler on the calendar clear this
    // to avoid race conditions.
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={drag as any}
          style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
          className="relative w-full aspect-square rounded-md overflow-hidden border bg-muted flex items-center justify-center p-2 group"
          onMouseEnter={() => isNsfw && isSafeMode && setIsHovered(true)}
          onMouseLeave={() => isNsfw && isSafeMode && setIsHovered(false)}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "absolute top-1 left-1 w-3 h-3 rounded-full z-10",
              isNsfw ? "bg-red-500" : "bg-green-500"
            )}
          />

          {asset.thumbnail_path ? (
            <Image
              src={`${API_BASE_URL}/${asset.thumbnail_path}`}
              alt={asset.meta.prompt || `Asset ${asset.id}`}
              layout="fill"
              objectFit="cover"
              className={cn("rounded-md transition-all duration-300", showBlurred ? "blur-xl" : "blur-0")}
              onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/256x256.png?text=Error")}
            />
          ) : (
            <span className="text-xs text-muted-foreground text-center">{asset.meta.prompt || `Asset ${asset.id}`}</span>
          )}

          {showBlurred && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Hover to Reveal
            </div>
          )}
        </div>
      </TooltipTrigger>
      {showBlurred && <TooltipContent>Explicit content blurred (Safe Mode is ON). Hover to reveal.</TooltipContent>}
    </Tooltip>
  );
}

export function AssetDrawer() {
  const { currentWorkspace } = useWorkspace();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace) {
      const fetchAssets = async () => {
        setIsLoading(true);
        try {
          const res = await apiFetch(`/workspaces/${currentWorkspace.id}/assets`);
          if (res.ok) {
            const data = await res.json();
            setAssets(data);
          }
        } catch (error) {
          console.error("Failed to fetch assets for drawer:", error);
          setAssets([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchAssets();
    } else {
      setAssets([]);
    }
  }, [currentWorkspace]);

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Asset Library</h3>
      <ScrollArea className="flex-1 pr-2">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground">Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">No assets found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {assets.map(asset => (
              <DraggableAsset
                key={asset.id}
                asset={asset}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
