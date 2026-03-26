'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiFetch from '@/lib/core/api';

interface Workspace {
  id: string;
  name: string;
  role?: 'owner' | 'admin' | 'editor' | 'viewer' | string;
  client_visible?: boolean;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const response = await apiFetch('/workspaces');
        if (response.status === 401 || response.status === 403) {
          setWorkspaces([]);
          setCurrentWorkspace(null);
          return;
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => ({} as { detail?: string }));
          throw new Error(payload.detail || 'Failed to fetch workspaces');
        }
        const payload = await response.json();
        const data = Array.isArray(payload) ? payload : [];
        setWorkspaces(data);
        if (data.length > 0) {
          setCurrentWorkspace((current) =>
            current && data.some((workspace) => workspace.id === current.id) ? current : data[0]
          );
        } else {
          setCurrentWorkspace(null);
        }
      } catch (error) {
        console.warn('Workspace fetch failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkspaces();
  }, []);

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, setCurrentWorkspace, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
