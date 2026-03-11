# ComfyUI Headless on RunPod (A100)

This doc describes how to run ComfyUI Headless as the image/video generation backend for NexGen Studio, inside a RunPod A100 container.

## Architecture

- **Next.js app** sends generation requests to ComfyUI Headless via `COMFYUI_BASE_URL` (e.g. your RunPod endpoint).
- **ComfyUI** runs headless in the container, exposes port **8188**.
- **Workflow templates** are stored in Supabase (`workflow_templates.comfy_workflow_json`).
- **Models** (Kling, Nano, Banana, SD, SDXL, custom) live on a **persistent volume** mounted in the container.

## RunPod container setup

1. **Image**: Use a ComfyUI Headless–compatible image (e.g. official ComfyUI Docker or a RunPod template that includes ComfyUI).

2. **Port**: Expose **8188** (ComfyUI default).

3. **Persistent volume** (recommended): Mount a volume for models so they persist across restarts, e.g.:
   - `/runpod-volume/ComfyUI/models/checkpoints`
   - `/runpod-volume/ComfyUI/models/vae`
   - `/runpod-volume/ComfyUI/models/controlnet`
   - For video: Kling, Nano, Banana in a path your workflows reference.

4. **Environment**: No extra env required inside the container; ComfyUI reads from its install dir.

5. **Start command**: Ensure ComfyUI runs in headless/server mode and listens on `0.0.0.0:8188` so the Next.js app can reach it (e.g. via RunPod’s public URL).

## Model paths

Paths in `src/lib/comfyui/models.ts` are relative to ComfyUI’s base (e.g. `models/checkpoints/...`). Set `COMFYUI_MODELS_BASE` if your container uses a different base (e.g. `runpod-volume/ComfyUI/models`). The registry includes:

- **Checkpoints**: SD 1.5, SDXL, Kling, Nano, Banana (paths are placeholders; point them to your mounted files).
- **VAE**: SD 1.5, SDXL.
- **ControlNet**: OpenPose, Canny.

## Next.js env

In the Next.js app (e.g. `.env.local`):

```bash
# ComfyUI Headless (RunPod endpoint)
COMFYUI_BASE_URL=https://your-runpod-endpoint.com
# Optional: base path for model paths in workflows
COMFYUI_MODELS_BASE=models
# Supabase bucket for ComfyUI outputs (signed URLs)
COMFYUI_OUTPUT_BUCKET=comfy-outputs
```

Create the `comfy-outputs` bucket in Supabase Storage (or the name you set) and ensure your Supabase service role can read/write it.

## API flow

1. **POST /api/generate/run**  
   Body: `{ influencerId, workflowTemplateId, variables?, model? }`  
   - Loads template from Supabase.  
   - Injects `variables` and model paths via `workflow-builder`.  
   - Submits workflow to ComfyUI `/prompt`.  
   - Polls `/history/{prompt_id}` until completion.  
   - Downloads outputs via `/view`, uploads to Supabase Storage.  
   - Returns `{ jobId, outputs: [{ storagePath, signedUrl, filename, kind }] }`.

2. **Video workflows**  
   Kling, Nano, Banana use separate workflow templates; video outputs are downloaded as produced (e.g. .mp4) and uploaded to the same bucket.

## Workflow templates in Supabase

Store ComfyUI workflow JSON in `workflow_templates.comfy_workflow_json`. Use placeholders for variables, e.g.:

- `{{prompt}}` – positive prompt  
- `{{negative_prompt}}` – negative prompt  
- `{{seed}}` – seed  
- `{{steps}}`, `{{cfg}}`, `{{denoise}}` – sampler params  
- `{{lora_strength}}` – LoRA strength  

Model paths (checkpoint, VAE, ControlNet) can be injected by the app from `lib/comfyui/models.ts` when you pass `modelName` (e.g. `sdxl`, `sd15`, `kling`). See `docs/comfyui-workflows/example-sd15-txt2img.json` for an example.
