insert into public.workflow_templates (slug, name, type, content_policy, base_cost_credits, comfy_workflow_json, variables_json)
values
  -- SD1.5 (SFW)
  ('sfw-sd15-txt2img-v1', 'SD 1.5 SFW Text to Image', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"negative_prompt":{"node":"7","path":"inputs.text"}}}'::jsonb),
  ('sfw-sd15-img2img-v1', 'SD 1.5 SFW Image to Image', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('sfw-sd15-controlnet-v1', 'SD 1.5 SFW ControlNet', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"controlnet_image_url":{"node":"9","path":"inputs.url"}}}'::jsonb),

  -- SD1.5 (NSFW)
  ('nsfw-sd15-txt2img-v1', 'SD 1.5 NSFW Text to Image', 'IMAGE', 'NSFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"negative_prompt":{"node":"7","path":"inputs.text"}}}'::jsonb),
  ('nsfw-sd15-img2img-v1', 'SD 1.5 NSFW Image to Image', 'IMAGE', 'NSFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('nsfw-sd15-controlnet-v1', 'SD 1.5 NSFW ControlNet', 'IMAGE', 'NSFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"controlnet_image_url":{"node":"9","path":"inputs.url"}}}'::jsonb),

  -- SDXL (SFW)
  ('sfw-sdxl-txt2img-v1', 'SDXL SFW Text to Image', 'IMAGE', 'SFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"negative_prompt":{"node":"7","path":"inputs.text"}}}'::jsonb),
  ('sfw-sdxl-img2img-v1', 'SDXL SFW Image to Image', 'IMAGE', 'SFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('sfw-sdxl-controlnet-v1', 'SDXL SFW ControlNet', 'IMAGE', 'SFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"controlnet_image_url":{"node":"9","path":"inputs.url"}}}'::jsonb),

  -- SDXL (NSFW)
  ('nsfw-sdxl-txt2img-v1', 'SDXL NSFW Text to Image', 'IMAGE', 'NSFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"negative_prompt":{"node":"7","path":"inputs.text"}}}'::jsonb),
  ('nsfw-sdxl-img2img-v1', 'SDXL NSFW Image to Image', 'IMAGE', 'NSFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('nsfw-sdxl-controlnet-v1', 'SDXL NSFW ControlNet', 'IMAGE', 'NSFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"controlnet_image_url":{"node":"9","path":"inputs.url"}}}'::jsonb),

  -- Missed variants from original list
  ('nsfw-upscale-v1', 'NSFW Upscale', 'IMAGE', 'NSFW', 1, '{}'::jsonb, '{"fields":{"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('nsfw-video-v1', 'NSFW Video', 'VIDEO', 'NSFW', 20, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"}}}'::jsonb)

on conflict (slug) do nothing;
