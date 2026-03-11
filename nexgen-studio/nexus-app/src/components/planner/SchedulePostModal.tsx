'use client'

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SchedulePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId?: string;
  initialDate?: Date;
}

export function SchedulePostModal({
  isOpen,
  onClose,
  assetId,
  initialDate,
}: SchedulePostModalProps) {
  const [caption, setCaption] = React.useState('');
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>([]);
  const [publishAt, setPublishAt] = React.useState(
    initialDate ? initialDate.toISOString().slice(0, 16) : ''
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePlatformChange = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // In a real implementation, this would call the API
      console.log({ assetId, caption, selectedPlatforms, publishAt });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onClose();
    } catch (error) {
      console.error('Failed to schedule post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Placeholder platform data (matches Socials page matrix)
  const platforms = [
    { id: 'instagram', name: 'Instagram', supports_nsfw: false },
    { id: 'facebook', name: 'Facebook', supports_nsfw: false },
    { id: 'tiktok', name: 'TikTok', supports_nsfw: false },
    { id: 'twitter', name: 'X (Twitter)', supports_nsfw: true },
    { id: 'youtube', name: 'YouTube', supports_nsfw: false },
    { id: 'linkedin', name: 'LinkedIn', supports_nsfw: false },
    { id: 'pinterest', name: 'Pinterest', supports_nsfw: false },
    { id: 'reddit', name: 'Reddit', supports_nsfw: true },
    { id: 'onlyfans', name: 'OnlyFans', supports_nsfw: true },
    { id: 'fansly', name: 'Fansly', supports_nsfw: true },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>
            {assetId 
              ? `Schedule asset for posting` 
              : 'Select a date and time to schedule a post'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="publishAt">Publish At</Label>
            <Input
              id="publishAt"
              type="datetime-local"
              value={publishAt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPublishAt(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Select Platforms</Label>
            {platforms.map((platform) => (
              <div key={platform.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`platform-${platform.id}`}
                  checked={selectedPlatforms.includes(platform.id)}
                  onChange={() => handlePlatformChange(platform.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor={`platform-${platform.id}`} className="font-normal">
                  {platform.name}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
