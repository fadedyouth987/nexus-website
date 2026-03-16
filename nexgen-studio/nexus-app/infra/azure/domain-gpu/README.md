# Azure Domain + GPU Automation

This folder automates the Azure side of the current app topology:

- One Ubuntu GPU VM for ComfyUI
- NSG, VNet, subnet, NIC, static public IP
- optional Azure DNS zone management for your domain
- DNS records for:
  - your web host on either the apex domain or a chosen subdomain
  - `comfy-sfw.<domain>`
  - `comfy-nsfw.<domain>`
- Cloud-init that installs Docker + Caddy and proxies both Comfy hostnames to `127.0.0.1:8188`

The app already expects these env vars:

- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`
- `COMFYUI_BASE_URL`
- `COMFY_SFW_URL`
- `COMFY_NSFW_URL`
- `COMFY_VIEW_PATH`

## Option 1: Azure CLI bootstrap

Run the PowerShell bootstrap from the repo root:

Current repo-inferred production shape:
- site domain: `nexgencompany.org`
- current apex web record resolves to `76.76.21.21`
- current authoritative DNS is Cloudflare
- current web host appears to be apex-domain Vercel, not `www`

## Recommended path

Keep the existing web and DNS arrangement intact, and use Azure only for the GPU worker host.

Why this is cleaner:

- no nameserver cutover risk for the live domain
- no need to re-create unrelated DNS records in Azure
- your current apex-domain web route already works
- the only new public records you need are the ComfyUI subdomains

Use external DNS mode:

```powershell
pnpm azure:bootstrap -- `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroupName "nexus-prod-rg" `
  -Location "eastus" `
  -DomainName "nexgencompany.org" `
  -AdminUsername "azureuser" `
  -SshPublicKeyPath "$HOME\.ssh\id_ed25519.pub" `
  -WebSubdomain "" `
  -WebARecordIp "76.76.21.21" `
  -ExternalDns
```

This provisions Azure GPU infra and prints the DNS records to add in Cloudflare.

If you want to move the DNS zone into Azure anyway, omit `-ExternalDns`.

If you prefer `www` instead of the apex domain:

```powershell
pnpm azure:bootstrap -- `
  -SubscriptionId "<subscription-id>" `
  -ResourceGroupName "nexus-prod-rg" `
  -Location "eastus" `
  -DomainName "nexgencompany.org" `
  -AdminUsername "azureuser" `
  -SshPublicKeyPath "$HOME\.ssh\id_ed25519.pub" `
  -WebSubdomain "www" `
  -WebCNameTarget "cname.vercel-dns.com"
```

Optional:

- `-AllowedSshCidr "203.0.113.15/32"`
- `-EnvFile ".env.production" -UpdateEnvFile`
- `-ComfySfwSubdomain "comfy-sfw" -ComfyNsfwSubdomain "comfy-nsfw"`

The script prints:

- Azure DNS nameservers to set at your registrar
- the GPU public IP
- the app env values to copy into your deployment platform

## Option 2: Terraform

The included example defaults to the recommended mode: `manage_dns = false`.

```powershell
cd infra/azure/domain-gpu
copy terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

After apply:

```powershell
terraform output external_dns_records
terraform output app_env
```

If you set `manage_dns = true`, you can also use:

```powershell
terraform output dns_name_servers
```

## After infra provision

1. If you kept external DNS, add the printed `comfy-sfw` and `comfy-nsfw` records in Cloudflare.
2. If you moved DNS into Azure, update your registrar to use the Azure DNS nameservers.
3. Keep or configure your web host to answer for the chosen site URL.
4. Add the site URL and `/auth/callback` URL to Supabase/Auth provider allowlists.
5. SSH to the GPU VM and run your ComfyUI runtime on `127.0.0.1:8188`.

Example:

```bash
ssh azureuser@<gpu-public-ip>
sudo /opt/nexus/comfy-run-example.sh
```

The included cloud-init intentionally prepares the host and reverse proxy without assuming a specific ComfyUI image.

Reference artifacts in this folder:

- [cloudflare-records.nexgencompany.org.example.md](./cloudflare-records.nexgencompany.org.example.md)
- [.env.production.nexgencompany.org.example](./.env.production.nexgencompany.org.example)
