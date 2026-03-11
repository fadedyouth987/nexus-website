# ComfyUI Workflow JSONs (Production-Ready)

Valid ComfyUI workflow JSONs for RunPod Headless. Each uses **placeholders** (`{{name}}`) for dynamic variables and **model paths** that can be replaced via the model registry or variables.

---

## 1. SDXL Image (Photoreal) — `sdxl-image-photoreal.json`

**Type:** Image  
**Use:** Photorealistic SDXL image generation.

| Placeholder        | Default   | Description                    |
|--------------------|-----------|--------------------------------|
| `{{prompt}}`       | (required)| Positive prompt                |
| `{{negative_prompt}}` | ""     | Negative prompt                |
| `{{seed}}`         | random    | Seed                           |
| `{{steps}}`        | 20        | Sampling steps                 |
| `{{cfg}}`          | 7.5       | CFG scale                      |
| `{{denoise}}`      | 1         | Denoise strength               |
| `{{height}}`       | 1024      | Height                         |
| `{{width}}`        | 1024      | Width                          |
| `{{sampler_name}}` | euler     | Sampler (euler, dpmpp_2m, etc.) |
| `{{scheduler}}`    | normal    | Scheduler                      |

**Model injection:** `ckpt_name` is overwritten from the model registry when `modelName: 'sdxl'` is used.

---

## 2. SDXL AnimateDiff Video — `sdxl-animatediff-video.json`

**Type:** Video  
**Requires:** ComfyUI-AnimateDiff-Evolved, Video Helper Suite (VHS).

| Placeholder           | Default | Description              |
|-----------------------|---------|--------------------------|
| `{{prompt}}`           | (required) | Positive prompt      |
| `{{negative_prompt}}`  | ""      | Negative prompt          |
| `{{seed}}`             | random  | Seed                     |
| `{{steps}}`            | 20      | Steps                    |
| `{{cfg}}`              | 7.5     | CFG scale                |
| `{{denoise}}`          | 1       | Denoise                  |
| `{{width}}`            | 1024    | Frame width               |
| `{{height}}`           | 1024    | Frame height              |
| `{{batch_size}}`       | 16      | Number of frames         |
| `{{frame_rate}}`       | 8       | Output FPS               |
| `{{sampler_name}}`     | euler   | Sampler                  |
| `{{scheduler}}`        | normal  | Scheduler                |
| `{{motion_module_path}}` | (required) | AnimateDiff motion model filename, e.g. `mm_sdxl_v10_beta.pt` or full path |

**Model injection:** Checkpoint from registry. Set `motion_module_path` in variables (or model overrides) to your motion module file under `models/animatediff_models/` (or equivalent).

---

## 3. Kling Video — `kling-video.json`

**Type:** Video  
**Requires:** Custom Kling node (e.g. `KlingVideo`) in your ComfyUI stack. Replace `class_type` with your node’s class if different.

| Placeholder          | Default | Description        |
|----------------------|---------|--------------------|
| `{{prompt}}`          | (required) | Prompt         |
| `{{negative_prompt}}` | ""      | Negative prompt   |
| `{{seed}}`            | random  | Seed              |
| `{{duration}}`        | 5       | Duration (seconds)|
| `{{aspect_ratio}}`    | 16:9    | Aspect ratio      |
| `{{cfg}}`             | 7.5     | CFG               |
| `{{motion_strength}}`  | 1.0     | Motion strength   |
| `{{kling_model_path}}`| (required) | Kling model path (variables or registry) |

**Output:** Video (e.g. MP4). Ensure the Kling node outputs a format that ComfyUI history returns (e.g. gif/video) so the client can download and upload to storage.

---

## 4. Luma Nano Video — `luma-nano-video.json`

**Type:** Video  
**Requires:** Luma Nano / Dream Machine custom node (`LumaNanoVideo`). Adjust `class_type` to match your custom node.

| Placeholder          | Default | Description        |
|----------------------|---------|--------------------|
| `{{prompt}}`          | (required) | Prompt         |
| `{{negative_prompt}}` | ""      | Negative prompt   |
| `{{seed}}`            | random  | Seed              |
| `{{duration}}`        | 5       | Duration          |
| `{{aspect_ratio}}`    | 16:9    | Aspect ratio      |
| `{{num_frames}}`      | 16      | Frame count       |
| `{{cfg}}`             | 7.5     | Guidance scale    |
| `{{nano_model_path}}` | (required) | Luma Nano model path |

---

## 5. Banana Video — `banana-video.json`

**Type:** Video  
**Requires:** Banana video custom node (`BananaVideo`). Adjust `class_type` to match your node.

| Placeholder            | Default | Description        |
|------------------------|---------|--------------------|
| `{{prompt}}`            | (required) | Prompt         |
| `{{negative_prompt}}`   | ""      | Negative prompt   |
| `{{seed}}`              | random  | Seed              |
| `{{duration}}`          | 5       | Duration          |
| `{{aspect_ratio}}`      | 16:9    | Aspect ratio      |
| `{{cfg}}`               | 7.5     | CFG               |
| `{{fps}}`               | 24      | Output FPS        |
| `{{banana_model_path}}` | (required) | Banana model path |

---

## Usage in the app

1. Store each JSON in Supabase `workflow_templates.comfy_workflow_json`.
2. Call `POST /api/generate/run` with `workflowTemplateId`, `influencerId`, and `variables` (and optional `model`).
3. `buildWorkflow()` replaces `{{...}}` from `variables` and injects model paths from `lib/comfyui/models.ts` when `modelName` is set.

## Custom node class names

If your RunPod ComfyUI uses different custom node names:

- **Kling:** Replace `KlingVideo` with your node’s `class_type` (e.g. `KlingAPINode`).
- **Luma Nano:** Replace `LumaNanoVideo` with your node’s `class_type`.
- **Banana:** Replace `BananaVideo` with your node’s `class_type`.

If your video node saves to disk and does not expose an output slot, you may need to adapt the workflow or the client’s output discovery (e.g. read from a known output path).
