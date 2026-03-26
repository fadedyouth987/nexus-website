'use client'

import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { useOrganization } from '@/context/OrganizationContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function OrganizationSelector() {
  const { organization, organizations, switchOrganization, loading } = useOrganization()
  const [open, setOpen] = useState(false)

  if (loading || !organization) {
    return null
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{organization.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => {
              switchOrganization(org.id)
              setOpen(false)
            }}
            className={org.id === organization.id ? 'bg-accent' : ''}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{org.name}</span>
              <span className="text-xs text-muted-foreground">
                {org.subscription_status === 'active' ? 'Active' : org.subscription_status ?? '—'}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
