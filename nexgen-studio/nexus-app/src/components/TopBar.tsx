'use client'

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useSafeMode } from '@/context/SafeModeContext'; // Import useSafeMode
import { logout } from "@/auth/actions";
import Link from "next/link";
import apiFetch from '@/lib/api';
import { Button } from './ui/button';
import { Bell, ChevronDown, Plus, Shield, ShieldOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"; // Import Tooltip components


export function TopBar() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, isLoading } = useWorkspace();
  const { isSafeMode, toggleSafeMode } = useSafeMode(); // Use SafeModeContext
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiFetch('/me');
        if(res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (e) {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background p-4">
      <nav className="flex h-16 items-center justify-between px-4">
        {/* Left Side: Breadcrumbs (Placeholder) */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">Dashboard</h1> {/* Placeholder Breadcrumb */}
        </div>

        {/* Right Side: Quick Actions & User Profile */}
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Quick Generate
          </Button>

          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* Global Safe Mode Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleSafeMode}>
                {isSafeMode ? <Shield className="h-4 w-4 text-green-500" /> : <ShieldOff className="h-4 w-4 text-red-500" />}
                <span className="sr-only">{isSafeMode ? "Safe Mode On" : "Safe Mode Off"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isSafeMode ? "Safe Mode is ON" : "Safe Mode is OFF"}
            </TooltipContent>
          </Tooltip>


          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 flex items-center justify-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/avatars/01.png" alt="@shadcn" />
                    <AvatarFallback>{user.name ? user.name.charAt(0) : 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block">{user.name || user.email}</span>
                  <ChevronDown className="h-4 w-4 hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/profile" className="w-full">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings" className="w-full">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <form action={logout} className="w-full">
                    <button type="submit" className="w-full text-left">Log out</button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth" className="text-sm">
              Login
            </Link>
          )}

          {/* Workspace Selector */}
          {currentWorkspace && (
            <select
              value={currentWorkspace.id}
              onChange={(e) => {
                const selected = workspaces.find(w => w.id === e.target.value);
                setCurrentWorkspace(selected || null);
              }}
              className="p-2 border rounded-md"
              disabled={isLoading}
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          )}
        </div>
      </nav>
    </header>
  );
}