"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function GenerateImagePage() {
  const [influencerId, setInfluencerId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("default");
  const [background, setBackground] = useState("auto");
  const [pose, setPose] = useState("default");
  const [sfwStatus, setSfwStatus] = useState("SAFE"); // SAFE, SUGGESTIVE, EXPLICIT
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Mock API call
    console.log("Generating image with:", {
      influencerId,
      prompt,
      style,
      background,
      pose,
      sfwStatus,
    });

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real app, you'd make a fetch/axios call to your backend
      // const response = await fetch("/api/ai/generate-image", { ... });
      // const data = await response.json();

      toast({
        title: "Image generation started!",
        description: "Your image is being generated in the background.",
      });

      // Optionally redirect or show result
      router.push(`/assets?influencerId=${influencerId}`);
    } catch (error) {
      console.error("Image generation failed:", error);
      toast({
        title: "Image generation failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Generate AI Image</h1>
      <form onSubmit={handleGenerate} className="space-y-4">
        <div>
          <Label htmlFor="influencerId">Influencer ID (Placeholder)</Label>
          <Input
            id="influencerId"
            value={influencerId}
            onChange={(e) => setInfluencerId(e.target.value)}
            required
            placeholder="e.g., a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
          />
        </div>
        <div>
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            placeholder="e.g., A futuristic cyberpunk city at night with neon lights"
          />
        </div>
        <div>
          <Label htmlFor="style">Style</Label>
          <Input
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="e.g., cinematic, anime, realistic"
          />
        </div>
        <div>
          <Label htmlFor="background">Background</Label>
          <Input
            id="background"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="e.g., beach, cityscape, studio"
          />
        </div>
        <div>
          <Label htmlFor="pose">Pose</Label>
          <Input
            id="pose"
            value={pose}
            onChange={(e) => setPose(e.target.value)}
            placeholder="e.g., standing, sitting, selfie"
          />
        </div>
        <div>
          <Label htmlFor="sfwStatus">Content Safety</Label>
          <Select value={sfwStatus} onValueChange={setSfwStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select SFW Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SAFE">SAFE</SelectItem>
              <SelectItem value="SUGGESTIVE">SUGGESTIVE</SelectItem>
              <SelectItem value="EXPLICIT">EXPLICIT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate Image"}
        </Button>
      </form>
    </div>
  );
}
