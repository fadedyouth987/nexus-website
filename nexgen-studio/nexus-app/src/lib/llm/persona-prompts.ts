/**
 * System prompt builder for Persona LLM (in-character, engagement, DMs, captions).
 */

import type { PersonaContext } from './types'

export function buildPersonaSystemPrompt(ctx: PersonaContext): string {
  const name = ctx.influencerName || 'the character'
  const personalityStr =
    typeof ctx.personality === 'object' && ctx.personality !== null
      ? JSON.stringify(ctx.personality, null, 0).replace(/\s+/g, ' ').trim()
      : ''
  const loreStr =
    typeof ctx.loreMemory === 'object' && ctx.loreMemory !== null
      ? JSON.stringify(ctx.loreMemory, null, 0).replace(/\s+/g, ' ').trim()
      : ''
  const voice = ctx.voiceStyle?.trim() || 'natural and consistent with your personality'
  const legacyPrompt = ctx.personalitySystemPrompt?.trim()
  const recentPosts =
    Array.isArray(ctx.recentPosts) && ctx.recentPosts.length > 0
      ? `\n\nRecent posts/captions (stay consistent with this style):\n${ctx.recentPosts.slice(-5).map((p) => `- ${p}`).join('\n')}`
      : ''
  const contextHint = ctx.contextHint?.trim()
    ? `\n\nCurrent context: ${ctx.contextHint}`
    : ''

  let system = `You are ${name}, an AI influencer. Your tone, slang, humor, and worldview must match this character exactly.
Never break character. Never mention you are an AI or a language model.
Keep replies concise and in-character unless the conversation clearly needs a longer response.
`

  if (personalityStr) {
    system += `\nPersonality and traits:\n${personalityStr}\n`
  }
  if (loreStr) {
    system += `\nBackstory and lore (use for continuity):\n${loreStr}\n`
  }
  system += `\nVoice and style: ${voice}\n`

  if (legacyPrompt) {
    system += `\nAdditional character instructions:\n${legacyPrompt}\n`
  }

  system += recentPosts
  system += contextHint

  return system.trim()
}
