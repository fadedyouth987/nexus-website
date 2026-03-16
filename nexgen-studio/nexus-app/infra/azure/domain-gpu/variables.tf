variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "zone_name" {
  type = string
}

variable "manage_dns" {
  type    = bool
  default = true
}

variable "admin_username" {
  type = string
}

variable "ssh_public_key" {
  type = string
}

variable "vm_name" {
  type    = string
  default = "nexus-comfy-01"
}

variable "vm_size" {
  type    = string
  default = "Standard_NC4as_T4_v3"
}

variable "vnet_name" {
  type    = string
  default = "nexus-vnet"
}

variable "subnet_name" {
  type    = string
  default = "gpu-subnet"
}

variable "nsg_name" {
  type    = string
  default = "nexus-comfy-nsg"
}

variable "nic_name" {
  type    = string
  default = "nexus-comfy-nic"
}

variable "public_ip_name" {
  type    = string
  default = "nexus-comfy-pip"
}

variable "web_subdomain" {
  type    = string
  default = "www"
}

variable "web_a_record_ip" {
  type    = string
  default = null
}

variable "web_cname_target" {
  type    = string
  default = null
}

variable "comfy_sfw_subdomain" {
  type    = string
  default = "comfy-sfw"
}

variable "comfy_nsfw_subdomain" {
  type    = string
  default = "comfy-nsfw"
}

variable "ssh_allowed_cidrs" {
  type = list(string)
}
