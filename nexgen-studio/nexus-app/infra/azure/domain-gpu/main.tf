locals {
  comfy_sfw_host = "${var.comfy_sfw_subdomain}.${var.zone_name}"
  comfy_nsfw_host = "${var.comfy_nsfw_subdomain}.${var.zone_name}"
  web_host = trimspace(var.web_subdomain) == "" ? var.zone_name : "${var.web_subdomain}.${var.zone_name}"
}

resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_dns_zone" "this" {
  count               = var.manage_dns ? 1 : 0
  name                = var.zone_name
  resource_group_name = azurerm_resource_group.this.name
}

resource "azurerm_virtual_network" "this" {
  name                = var.vnet_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "gpu" {
  name                 = var.subnet_name
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_network_security_group" "gpu" {
  name                = var.nsg_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name

  dynamic "security_rule" {
    for_each = var.ssh_allowed_cidrs
    content {
      name                       = "allow-ssh-${security_rule.key}"
      priority                   = 100 + security_rule.key
      direction                  = "Inbound"
      access                     = "Allow"
      protocol                   = "Tcp"
      source_port_range          = "*"
      destination_port_range     = "22"
      source_address_prefix      = security_rule.value
      destination_address_prefix = "*"
    }
  }

  security_rule {
    name                       = "allow-http"
    priority                   = 200
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "allow-https"
    priority                   = 210
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_public_ip" "gpu" {
  name                = var.public_ip_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_interface" "gpu" {
  name                = var.nic_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.gpu.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.gpu.id
  }
}

resource "azurerm_network_interface_security_group_association" "gpu" {
  network_interface_id      = azurerm_network_interface.gpu.id
  network_security_group_id = azurerm_network_security_group.gpu.id
}

resource "azurerm_linux_virtual_machine" "gpu" {
  name                = var.vm_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  size                = var.vm_size
  admin_username      = var.admin_username
  network_interface_ids = [
    azurerm_network_interface.gpu.id
  ]
  custom_data = base64encode(templatefile("${path.module}/cloud-init.tpl", {
    comfy_sfw_host  = local.comfy_sfw_host
    comfy_nsfw_host = local.comfy_nsfw_host
  }))

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }
}

resource "azurerm_virtual_machine_extension" "nvidia" {
  name                       = "NvidiaGpuDriverLinux"
  virtual_machine_id         = azurerm_linux_virtual_machine.gpu.id
  publisher                  = "Microsoft.HpcCompute"
  type                       = "NvidiaGpuDriverLinux"
  auto_upgrade_minor_version = true
}

resource "azurerm_dns_a_record" "comfy_sfw" {
  count               = var.manage_dns ? 1 : 0
  name                = var.comfy_sfw_subdomain
  zone_name           = var.zone_name
  resource_group_name = azurerm_resource_group.this.name
  ttl                 = 300
  records             = [azurerm_public_ip.gpu.ip_address]
}

resource "azurerm_dns_a_record" "comfy_nsfw" {
  count               = var.manage_dns ? 1 : 0
  name                = var.comfy_nsfw_subdomain
  zone_name           = var.zone_name
  resource_group_name = azurerm_resource_group.this.name
  ttl                 = 300
  records             = [azurerm_public_ip.gpu.ip_address]
}

resource "azurerm_dns_a_record" "web" {
  count               = var.manage_dns && var.web_a_record_ip != null ? 1 : 0
  name                = trimspace(var.web_subdomain) == "" ? "@" : var.web_subdomain
  zone_name           = var.zone_name
  resource_group_name = azurerm_resource_group.this.name
  ttl                 = 300
  records             = [var.web_a_record_ip]
}

resource "azurerm_dns_cname_record" "web" {
  count               = var.manage_dns && var.web_cname_target != null && trimspace(var.web_subdomain) != "" && var.web_a_record_ip == null ? 1 : 0
  name                = var.web_subdomain
  zone_name           = var.zone_name
  resource_group_name = azurerm_resource_group.this.name
  ttl                 = 300
  record              = var.web_cname_target
}
