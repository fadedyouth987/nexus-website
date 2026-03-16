output "dns_name_servers" {
  value = var.manage_dns ? azurerm_dns_zone.this[0].name_servers : []
}

output "gpu_public_ip" {
  value = azurerm_public_ip.gpu.ip_address
}

output "web_host" {
  value = local.web_host
}

output "comfy_sfw_url" {
  value = "https://${local.comfy_sfw_host}"
}

output "comfy_nsfw_url" {
  value = "https://${local.comfy_nsfw_host}"
}

output "app_env" {
  value = {
    NEXTAUTH_URL         = "https://${local.web_host}"
    NEXT_PUBLIC_SITE_URL = "https://${local.web_host}"
    COMFYUI_BASE_URL     = "https://${local.comfy_sfw_host}"
    COMFY_SFW_URL        = "https://${local.comfy_sfw_host}"
    COMFY_NSFW_URL       = "https://${local.comfy_nsfw_host}"
    COMFY_VIEW_PATH      = "/view"
  }
}

output "external_dns_records" {
  value = {
    comfy_sfw = {
      type  = "A"
      name  = local.comfy_sfw_host
      value = azurerm_public_ip.gpu.ip_address
    }
    comfy_nsfw = {
      type  = "A"
      name  = local.comfy_nsfw_host
      value = azurerm_public_ip.gpu.ip_address
    }
    web = trimspace(var.web_subdomain) == "" ? (
      var.web_a_record_ip == null ? null : {
        type  = "A"
        name  = local.web_host
        value = var.web_a_record_ip
      }
    ) : (
      var.web_cname_target != null ? {
        type  = "CNAME"
        name  = local.web_host
        value = var.web_cname_target
      } : (
        var.web_a_record_ip != null ? {
          type  = "A"
          name  = local.web_host
          value = var.web_a_record_ip
        } : null
      )
    )
  }
}
