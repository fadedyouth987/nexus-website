# Cloudflare DNS Records for `nexgencompany.org`

Recommended mode for this repo:

- keep Cloudflare as the authoritative DNS provider
- keep the existing apex web record on Vercel
- add Azure GPU subdomains for ComfyUI

## Existing web record to keep

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | Proxied |

This preserves the current production site:

- `https://nexgencompany.org`
- `NEXTAUTH_URL=https://nexgencompany.org`
- `NEXT_PUBLIC_SITE_URL=https://nexgencompany.org`

## New records to add after Azure GPU provisioning

Replace `<AZURE_GPU_PUBLIC_IP>` with the `Public GPU IP` printed by `pnpm azure:bootstrap -- ... -ExternalDns`.

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `comfy-sfw` | `<AZURE_GPU_PUBLIC_IP>` | DNS only |
| A | `comfy-nsfw` | `<AZURE_GPU_PUBLIC_IP>` | DNS only |

Recommended URLs:

- `https://comfy-sfw.nexgencompany.org`
- `https://comfy-nsfw.nexgencompany.org`

## Why `DNS only` for the Comfy hosts

Start with `DNS only` for the ComfyUI subdomains so the app and worker talk directly to the Caddy reverse proxy on the Azure VM. That is the lowest-risk setup for:

- websocket traffic
- long-running generation requests
- direct asset/view endpoints

You can revisit Cloudflare proxying later if you explicitly want it and have verified the ComfyUI traffic profile against that path.

## Final expected app env

```env
NEXTAUTH_URL=https://nexgencompany.org
NEXT_PUBLIC_SITE_URL=https://nexgencompany.org
COMFYUI_BASE_URL=https://comfy-sfw.nexgencompany.org
COMFY_SFW_URL=https://comfy-sfw.nexgencompany.org
COMFY_NSFW_URL=https://comfy-nsfw.nexgencompany.org
COMFY_VIEW_PATH=/view
```
