const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const templates = [
    // SD1.5 (SFW)
    { slug: 'sfw-sd15-txt2img-v1', name: 'SD 1.5 SFW Text to Image', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, negative_prompt: { node: "7", path: "inputs.text" } } } },
    { slug: 'sfw-sd15-img2img-v1', name: 'SD 1.5 SFW Image to Image', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, input_image_url: { node: "8", path: "inputs.url" } } } },
    { slug: 'sfw-sd15-controlnet-v1', name: 'SD 1.5 SFW ControlNet', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, controlnet_image_url: { node: "9", path: "inputs.url" } } } },

    // SD1.5 (NSFW)
    { slug: 'nsfw-sd15-txt2img-v1', name: 'SD 1.5 NSFW Text to Image', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, negative_prompt: { node: "7", path: "inputs.text" } } } },
    { slug: 'nsfw-sd15-img2img-v1', name: 'SD 1.5 NSFW Image to Image', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, input_image_url: { node: "8", path: "inputs.url" } } } },
    { slug: 'nsfw-sd15-controlnet-v1', name: 'SD 1.5 NSFW ControlNet', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, controlnet_image_url: { node: "9", path: "inputs.url" } } } },

    // SDXL (SFW)
    { slug: 'sfw-sdxl-txt2img-v1', name: 'SDXL SFW Text to Image', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, negative_prompt: { node: "7", path: "inputs.text" } } } },
    { slug: 'sfw-sdxl-img2img-v1', name: 'SDXL SFW Image to Image', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, input_image_url: { node: "8", path: "inputs.url" } } } },
    { slug: 'sfw-sdxl-controlnet-v1', name: 'SDXL SFW ControlNet', type: 'IMAGE', content_policy: 'SFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, controlnet_image_url: { node: "9", path: "inputs.url" } } } },

    // SDXL (NSFW)
    { slug: 'nsfw-sdxl-txt2img-v1', name: 'SDXL NSFW Text to Image', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, negative_prompt: { node: "7", path: "inputs.text" } } } },
    { slug: 'nsfw-sdxl-img2img-v1', name: 'SDXL NSFW Image to Image', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, input_image_url: { node: "8", path: "inputs.url" } } } },
    { slug: 'nsfw-sdxl-controlnet-v1', name: 'SDXL NSFW ControlNet', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 2, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" }, controlnet_image_url: { node: "9", path: "inputs.url" } } } },

    // Missed variants
    { slug: 'nsfw-upscale-v1', name: 'NSFW Upscale', type: 'IMAGE', content_policy: 'NSFW', base_cost_credits: 1, comfy_workflow_json: {}, variables_json: { fields: { input_image_url: { node: "8", path: "inputs.url" } } } },
    { slug: 'nsfw-video-v1', name: 'NSFW Video', type: 'VIDEO', content_policy: 'NSFW', base_cost_credits: 20, comfy_workflow_json: {}, variables_json: { fields: { prompt: { node: "6", path: "inputs.text" } } } }
  ];

  console.log(`Attempting to upload ${templates.length} templates...`);

  // Simple loop since there aren't many templates
  for (const template of templates) {
    const { error } = await supabase
      .from('workflow_templates')
      .upsert(template, { onConflict: 'slug' });

    if (error) {
      console.error(`Failed to insert template: ${template.slug}`, error);
    } else {
      console.log(`Inserted ${template.slug} templates`);
    }
  }

  console.log('Seeding process complete! ✅');
}

seed();
