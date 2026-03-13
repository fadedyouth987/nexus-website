"use client";

import { useState, useEffect, useRef } from "react";
import apiFetch from "@/lib/core/api";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Download, Trash2, Upload, FolderOpen } from "lucide-react";

type ModelFile = {
  name: string;
  size?: number;
};

const MODEL_TYPES = [
  { id: "checkpoints", label: "Checkpoints", extensions: [".safetensors", ".ckpt"] },
  { id: "loras", label: "LoRAs", extensions: [".safetensors", ".ckpt"] },
  { id: "controlnet", label: "ControlNet", extensions: [".safetensors", ".ckpt"] },
  { id: "vae", label: "VAE", extensions: [".safetensors", ".ckpt", ".pth"] },
  { id: "upscale_models", label: "Upscale Models", extensions: [".safetensors", ".ckpt", ".pth"] },
];

function formatFileSize(bytes?: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export default function ModelsPage() {
  const [activeTab, setActiveTab] = useState("checkpoints");
  const [models, setModels] = useState<ModelFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load models when tab changes
  useEffect(() => {
    loadModels(activeTab);
  }, [activeTab]);

  const loadModels = async (modelType: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/studio/models/${modelType}`);
      if (res.ok) {
        const data = await res.json();
        setModels(data);
      } else {
        setModels([]);
      }
    } catch (e) {
      setError("Failed to load models");
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch(`/studio/models/${activeTab}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      setSuccess(`Uploaded ${file.name}`);
      loadModels(activeTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl.trim()) return;

    setDownloading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/studio/models/${activeTab}/download?url=${encodeURIComponent(downloadUrl)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Download failed");
      }

      const data = await res.json();
      setSuccess(`Downloaded ${data.filename}`);
      setDownloadUrl("");
      loadModels(activeTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/studio/models/${activeTab}/${filename}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Delete failed");
      }

      setSuccess(`Deleted ${filename}`);
      loadModels(activeTab);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const currentModelType = MODEL_TYPES.find(m => m.id === activeTab);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Model Library</h1>
          <p className="text-muted-foreground">Manage your checkpoints, LoRAs, and other models</p>
        </div>
      </div>

      {/* Upload & Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Model
            </CardTitle>
            <CardDescription>
              Upload a {currentModelType?.label || "model"} file from your computer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept={currentModelType?.extensions.join(",")}
              onChange={handleFileUpload}
              className="hidden"
              id="model-upload"
            />
            <Label htmlFor="model-upload" className="cursor-pointer">
              <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                <div className="text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Click to select file"}
                  </span>
                </div>
              </div>
            </Label>
            <p className="text-xs text-muted-foreground mt-2">
              Allowed: {currentModelType?.extensions.join(", ")}
            </p>
          </CardContent>
        </Card>

        {/* Download Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download from URL
            </CardTitle>
            <CardDescription>
              Download a model from HuggingFace, Civitai, or other sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="download-url">Model URL</Label>
              <Input
                id="download-url"
                placeholder="https://huggingface.co/..."
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleDownload} 
              disabled={!downloadUrl.trim() || downloading}
              className="w-full"
            >
              {downloading ? "Downloading..." : "Download"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-green-500 bg-green-50 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Model Type Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto">
          {MODEL_TYPES.map((type) => (
            <TabsTrigger key={type.id} value={type.id}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MODEL_TYPES.map((type) => (
          <TabsContent key={type.id} value={type.id}>
            <Card>
              <CardHeader>
                <CardTitle>{type.label}</CardTitle>
                <CardDescription>
                  {models.length} {type.label.toLowerCase()} available
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : models.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No {type.label.toLowerCase()} found. Upload or download some!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{type.extensions[0]}</Badge>
                          <span className="font-medium">{model.name}</span>
                          {model.size && (
                            <span className="text-sm text-muted-foreground">
                              {formatFileSize(model.size)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(model.name)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
