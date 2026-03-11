'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkspaceRow } from './types'

export function WorkspaceSwitcher({
  workspaces,
  selectedWorkspaceId,
  onSelectWorkspace,
}: {
  workspaces: WorkspaceRow[]
  selectedWorkspaceId: string
  onSelectWorkspace: (workspaceId: string) => void
}) {
  return (
    <Select value={selectedWorkspaceId || undefined} onValueChange={onSelectWorkspace}>
      <SelectTrigger className="w-[320px]">
        <SelectValue placeholder="Select workspace" />
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
