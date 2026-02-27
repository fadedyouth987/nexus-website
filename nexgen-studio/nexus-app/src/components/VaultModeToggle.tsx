'use client'

import { signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Shield, Lock } from 'lucide-react'
import { useState } from 'react'

export function VaultModeToggle() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const isNSFW = session?.vault_mode === 'nsfw'
  const currentLabel = isNSFW ? 'NSFW Vault' : 'SFW Mode'

  const handleToggleVault = async () => {
    setIsLoading(true)
    
    // Sign out to clear session
    await signOut({ 
      redirect: true,
      callbackUrl: '/auth?vault=toggle'
    })
    
    setIsLoading(false)
  }

  if (!session) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={isLoading}
        >
          {isNSFW ? (
            <>
              <Lock className="h-4 w-4" />
              <span>{currentLabel}</span>
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              <span>{currentLabel}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Content Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleToggleVault}
          disabled={isLoading}
          className="flex justify-between items-center"
        >
          <span>Switch to {isNSFW ? 'SFW' : 'NSFW'}</span>
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Loading...' : 'Logout & Switch'}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
