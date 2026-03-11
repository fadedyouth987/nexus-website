-- Character identity lock: seed workflow templates for consistent character generation
-- These templates use {{variable}} interpolation handled by src/lib/workflow/builder.ts
-- The worker injects lora_path and reference_image_url from the influencer record automatically

INSERT INTO workflow_templates (
  slug, name, type, content_policy, is_active,
  base_cost_credits,
  variables_json,
  ui_schema_json,
  comfy_workflow_json
) VALUES
(
  'portrait-character-lock-sfw',
  'Portrait – Character Lock (SFW)',
  'IMAGE',
  'SFW',
  true,
  10,
  '{"prompt":{"default":"portrait photo, high quality, professional lighting"},"negative_prompt":{"default":"blurry, low quality, distorted"},"seed":{"default":-1,"min":-1,"max":2147483647},"steps":{"default":30,"min":10,"max":80},"cfg":{"default":7,"min":1,"max":20,"step":0.5},"width":{"default":512,"min":256,"max":2048,"step":64},"height":{"default":768,"min":256,"max":2048,"step":64},"batch_size":{"default":1,"min":1,"max":8},"lora_strength":{"default":0.85,"min":0,"max":1.5,"step":0.05},"reference_image_url":{"default":""}}',
  '{"prompt":{"label":"Prompt","type":"textarea"},"negative_prompt":{"label":"Negative Prompt","type":"textarea"},"seed":{"label":"Seed","type":"text"},"steps":{"label":"Steps","type":"slider"},"cfg":{"label":"CFG Scale","type":"slider"},"width":{"label":"Width","type":"slider"},"height":{"label":"Height","type":"slider"},"batch_size":{"label":"Batch Size","type":"slider"},"lora_strength":{"label":"LoRA Strength","type":"slider"},"reference_image_url":{"label":"Reference Image URL","type":"text"}}',
  '{"3":{"class_type":"KSampler","inputs":{"seed":"{{seed}}","steps":"{{steps}}","cfg":"{{cfg}}","sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"{{ckpt_name}}"}},"5":{"class_type":"EmptyLatentImage","inputs":{"width":"{{width}}","height":"{{height}}","batch_size":"{{batch_size}}"}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}","clip":["4",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"{{negative_prompt}}","clip":["4",1]}},"8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"nexgen","images":["8",0]}},"10":{"class_type":"LoraLoader","inputs":{"lora_name":"{{lora_path}}","strength_model":"{{lora_strength}}","strength_clip":"{{lora_strength}}","model":["4",0],"clip":["4",1]}}}'
),
(
  'portrait-character-lock-nsfw',
  'Portrait – Character Lock (NSFW)',
  'IMAGE',
  'NSFW',
  true,
  12,
  '{"prompt":{"default":"portrait photo, high quality, professional lighting"},"negative_prompt":{"default":"blurry, low quality, distorted"},"seed":{"default":-1,"min":-1,"max":2147483647},"steps":{"default":30,"min":10,"max":80},"cfg":{"default":7,"min":1,"max":20,"step":0.5},"width":{"default":512,"min":256,"max":2048,"step":64},"height":{"default":768,"min":256,"max":2048,"step":64},"batch_size":{"default":1,"min":1,"max":8},"lora_strength":{"default":0.85,"min":0,"max":1.5,"step":0.05},"reference_image_url":{"default":""}}',
  '{"prompt":{"label":"Prompt","type":"textarea"},"negative_prompt":{"label":"Negative Prompt","type":"textarea"},"seed":{"label":"Seed","type":"text"},"steps":{"label":"Steps","type":"slider"},"cfg":{"label":"CFG Scale","type":"slider"},"width":{"label":"Width","type":"slider"},"height":{"label":"Height","type":"slider"},"batch_size":{"label":"Batch Size","type":"slider"},"lora_strength":{"label":"LoRA Strength","type":"slider"},"reference_image_url":{"label":"Reference Image URL","type":"text"}}',
  '{"3":{"class_type":"KSampler","inputs":{"seed":"{{seed}}","steps":"{{steps}}","cfg":"{{cfg}}","sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"{{ckpt_name}}"}},"5":{"class_type":"EmptyLatentImage","inputs":{"width":"{{width}}","height":"{{height}}","batch_size":"{{batch_size}}"}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}","clip":["4",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"{{negative_prompt}}","clip":["4",1]}},"8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"nexgen","images":["8",0]}},"10":{"class_type":"LoraLoader","inputs":{"lora_name":"{{lora_path}}","strength_model":"{{lora_strength}}","strength_clip":"{{lora_strength}}","model":["4",0],"clip":["4",1]}}}'
),
(
  'reel-frame-character-lock',
  'Reel Frame – Character Lock (9:16)',
  'IMAGE',
  'SFW',
  true,
  10,
  '{"prompt":{"default":"social media reel frame, vertical composition, engaging pose"},"negative_prompt":{"default":"blurry, low quality, distorted, horizontal"},"seed":{"default":-1,"min":-1,"max":2147483647},"steps":{"default":30,"min":10,"max":80},"cfg":{"default":7,"min":1,"max":20,"step":0.5},"width":{"default":576,"min":256,"max":2048,"step":64},"height":{"default":1024,"min":256,"max":2048,"step":64},"batch_size":{"default":1,"min":1,"max":8},"lora_strength":{"default":0.85,"min":0,"max":1.5,"step":0.05},"reference_image_url":{"default":""}}',
  '{"prompt":{"label":"Prompt","type":"textarea"},"negative_prompt":{"label":"Negative Prompt","type":"textarea"},"seed":{"label":"Seed","type":"text"},"steps":{"label":"Steps","type":"slider"},"cfg":{"label":"CFG Scale","type":"slider"},"width":{"label":"Width","type":"slider"},"height":{"label":"Height","type":"slider"},"batch_size":{"label":"Batch Size","type":"slider"},"lora_strength":{"label":"LoRA Strength","type":"slider"},"reference_image_url":{"label":"Reference Image URL","type":"text"}}',
  '{"3":{"class_type":"KSampler","inputs":{"seed":"{{seed}}","steps":"{{steps}}","cfg":"{{cfg}}","sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"{{ckpt_name}}"}},"5":{"class_type":"EmptyLatentImage","inputs":{"width":"{{width}}","height":"{{height}}","batch_size":"{{batch_size}}"}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}","clip":["4",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"{{negative_prompt}}","clip":["4",1]}},"8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"nexgen-reel","images":["8",0]}},"10":{"class_type":"LoraLoader","inputs":{"lora_name":"{{lora_path}}","strength_model":"{{lora_strength}}","strength_clip":"{{lora_strength}}","model":["4",0],"clip":["4",1]}}}'
)
ON CONFLICT (slug) DO NOTHING;
