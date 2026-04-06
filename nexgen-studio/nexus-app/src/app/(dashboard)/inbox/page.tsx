'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { MessageSquare, Send, Sparkles, ArrowLeft, User, Hash, Loader2 } from 'lucide-react'

type InboxAccount = { id: string; name: string; platform: string; unread: number }
type InboxMessage = { id: string; sender: string; message: string; time: string; unread?: boolean }
type InboxThread = { id: string; title?: string; unread?: number; lastMessage?: string; lastMessageAt?: string }

export default function InboxPage() {
  const [accounts, setAccounts] = useState<InboxAccount[]>([])
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/accounts', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAccounts(Array.isArray(data) ? data : [])
        if (!selectedAccount && Array.isArray(data) && data[0]) setSelectedAccount(data[0].id)
      }
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadAccounts() }, [loadAccounts])

  useEffect(() => {
    if (!selectedAccount) {
      setThreads([])
      setMessages([])
      setSelectedConversation(null)
      return
    }
    fetch(`/api/inbox/threads?accountId=${encodeURIComponent(selectedAccount)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((list) => {
        setThreads(Array.isArray(list) ? list : [])
        if (!selectedConversation && Array.isArray(list) && list[0]) setSelectedConversation(list[0].id)
      })
      .catch(() => setThreads([]))
  }, [selectedAccount])

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([])
      return
    }
    fetch(`/api/inbox/messages?threadId=${encodeURIComponent(selectedConversation)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setMessages(Array.isArray(list) ? (list as InboxMessage[]) : []))
      .catch(() => setMessages([]))
  }, [selectedConversation])

  const currentConversationMessages = messages

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedAccount) return
    setSending(true)
    setNotice(null)
    try {
      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accountId: selectedAccount,
          threadId: selectedConversation,
          content: message.trim(),
        }),
      })
      if (res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string; threadId?: string }
        if (payload.threadId && !selectedConversation) {
          setSelectedConversation(payload.threadId)
        }
        fetch(`/api/inbox/threads?accountId=${encodeURIComponent(selectedAccount)}`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .then((list) => setThreads(Array.isArray(list) ? (list as InboxThread[]) : []))
          .catch(() => null)
        setMessage('')
        setMessages((prev) => [...prev, { id: `sent-${Date.now()}`, sender: 'You', message: message.trim(), time: 'Just now' }])
        if (payload.message) {
          setNotice(payload.message)
        }
      }
    } finally {
      setSending(false)
    }
  }

  const [aiLoading, setAiLoading] = useState(false)
  const handleAiSuggestedReply = async () => {
    const context = messages.slice(-5).map((m) => `${m.sender}: ${m.message}`).join('\n')
    if (!context.trim()) {
      setMessage('Hi there! Thanks for reaching out. How can I help you today?')
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: `You are an AI influencer's assistant. Based on this conversation, suggest a friendly, engaging reply:\n\n${context}\n\nSuggest a concise reply:`,
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { reply?: string }
        setMessage(data.reply || 'Thanks for your message! I appreciate your support.')
      } else {
        setMessage('Thanks for your message! I appreciate your support.')
      }
    } catch {
      setMessage('Thanks for your message! I appreciate your support.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-theme(spacing.16))] bg-background">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <PageHeader
          title="Inbox"
          description="Manage DMs and conversations across your AI influencer accounts. Reply, use AI suggestions, and keep engagement in one place."
          breadcrumb={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Inbox' },
          ]}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          }
        />
      </div>

      <div className="flex flex-1 min-h-0 px-6 pb-6">
        {/* Left: Accounts */}
        <Card className="flex-none w-[240px] border-border rounded-lg overflow-hidden shrink-0">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Accounts
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Select an account to view its conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-theme(spacing.56))]">
              <nav className="p-1">
                {loading ? (
                  <div className="p-3 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : accounts.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Link accounts in Socials.</p>
                ) : (
                  accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`w-full text-left p-3 rounded-md border border-transparent transition-colors hover:bg-muted/80 ${
                        selectedAccount === account.id ? 'bg-muted border-border' : ''
                      }`}
                      onClick={() => {
                        setSelectedAccount(account.id)
                        setSelectedConversation(null)
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">{account.name}</p>
                        {account.unread > 0 && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {account.unread}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{account.platform}</p>
                    </button>
                  ))
                )}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Middle: Conversations */}
        <Card className="flex-none w-[280px] ml-4 border-border rounded-lg overflow-hidden shrink-0">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Conversations
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {selectedAccount
                ? `${threads.length} thread${threads.length !== 1 ? 's' : ''}`
                : 'Select an account first.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-theme(spacing.56))]">
              {selectedAccount && threads.length > 0 ? (
                <div className="p-1">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      className={`w-full text-left p-3 rounded-md border border-transparent transition-colors hover:bg-muted/80 ${
                        selectedConversation === thread.id ? 'bg-muted border-border' : ''
                      }`}
                      onClick={() => setSelectedConversation(thread.id)}
                    >
                      <p className="text-sm text-foreground truncate">{thread.title || `Thread ${thread.id.slice(0, 8)}…`}</p>
                      {thread.lastMessage ? (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{thread.lastMessage}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {selectedAccount ? 'No conversations for this account yet.' : 'Select an account to see threads.'}
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Chat */}
        <Card className="flex-1 min-w-0 ml-4 border-border rounded-lg overflow-hidden flex flex-col">
          <CardHeader className="py-4 border-b border-border">
            <CardTitle className="text-base font-medium text-foreground flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              {selectedAccount ? 'Chat' : 'Select an account'}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Reply below or use AI to suggest a response.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 p-0">
            <ScrollArea className="flex-1 p-4">
              {selectedAccount ? (
                currentConversationMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`mb-4 ${msg.sender === 'You' ? 'flex justify-end' : 'flex justify-start'}`}
                    >
                      <div className="max-w-[85%]">
                        <span
                          className={`inline-block px-3 py-2 rounded-lg text-sm ${
                            msg.sender === 'You'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {msg.message}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1.5 px-1">
                          {msg.sender} · {msg.time}
                        </p>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Select a conversation to view and send messages.</p>
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-4 flex flex-col gap-3">
              {!selectedConversation ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No thread selected. Sending will start a new conversation for this account.
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {notice}
                </div>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="w-fit self-end flex items-center gap-2"
                onClick={() => void handleAiSuggestedReply()}
                disabled={!selectedAccount || aiLoading}
              >
                <Sparkles className="h-4 w-4" />
                {aiLoading ? 'Thinking...' : 'AI Suggested Reply'}
              </Button>
              <div className="flex items-center gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="flex-1 resize-none bg-background border-border text-foreground placeholder:text-muted-foreground"
                  disabled={!selectedAccount || sending}
                />
                <Button
                  size="icon"
                  onClick={() => void handleSendMessage()}
                  disabled={!selectedAccount || !message.trim() || sending}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
