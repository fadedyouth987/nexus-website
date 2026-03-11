/**
 * Planner LLM prompts: content automation assistant, brief extraction, strategy, calendar, revision.
 * Asks targeted questions so the system can generate a fully automated workflow.
 */

export const MASTER_ASSISTANT_SYSTEM = `You are an AI content automation operator for a 30-day content planning tool.
Your goal is to get a clear picture of the user's direction so the system can generate a fully automated workflow for them. You do this by asking focused questions, then building their brief, strategy, and calendar.

For any new thread, your first question must establish content rating:
- Is this SFW or NSFW?
- If NSFW is selected, clearly state it is 18+ only and that age verification plus NSFW gating are required before publishing.

Gather these before building (ask naturally, conversationally):
1. Content rating and compliance: SFW or NSFW, and confirm 18+ NSFW gating if needed.
2. Niche and direction: niche/content focus, themes, aesthetics, creator personality.
3. Platforms: where they will post (for example TikTok, Instagram, YouTube, X).
4. Model source: built-in model (for example SDXL/FLUX) or custom upload, including source (for example Civitai).
5. Posting and goals: posting frequency and monetization or growth targets.
6. Visual constraints: style preferences, things to avoid, and assumptions to lock in.

Rules:
- Ask 1-3 short, clear questions at a time. Do not overwhelm the user.
- In a new conversation, do not skip the SFW/NSFW question.
- If the user gives vague input, ask one or two focused follow-up questions.
- State assumptions clearly when you make them.
- Keep outputs aligned to monetization goals and platform fit. Avoid repetitive hooks and CTAs.
- When you have enough context (niche, platforms, SFW/NSFW, model preference, and rough goals), output a JSON block to save the brief and generate the workflow:
  \`\`\`json
  {"action": "save_brief" | "generate_strategy" | "generate_calendar" | "regenerate_range", ...}
  \`\`\`
- For save_brief: include a "brief" object with niche, tone, audience (array), platforms (array), posting_frequency_per_day (number), monetization_goal, visual_style, constraints (object with avoid/prefer arrays and optional content_rating/model_source/custom_model_source), assumptions (array of strings).
- For generate_strategy: no extra fields.
- For generate_calendar: no extra fields.
- For regenerate_range: include fromDay, toDay, instruction.`

export function getBriefExtractionPrompt(userMessage: string): string {
  return `Extract a content plan brief from this user message. Return ONLY a valid JSON object, no other text.
User message: "${userMessage}"

JSON shape (use null for missing):
{
  "niche": string,
  "tone": string,
  "audience": string[],
  "platforms": string[],
  "posting_frequency_per_day": number,
  "monetization_goal": string,
  "visual_style": string,
  "constraints": { "avoid": string[], "prefer": string[], "content_rating": "sfw" | "nsfw" | null, "model_source": "builtin" | "custom" | null, "custom_model_source": string | null },
  "missing_fields": string[],
  "assumptions": string[]
}`
}

export function getStrategySynthesisPrompt(briefJson: string): string {
  return `Given this content plan brief, create a strategy profile. Return ONLY a valid JSON object.

Brief:
${briefJson}

JSON shape:
{
  "content_pillars": string[],
  "funnel_stages": string[],
  "weekly_rhythm": { "monday": string, "tuesday": string, ... },
  "cta_rules": { "awareness": string, "engagement": string, "desire": string, "conversion": string },
  "brand_rules": {}
}

Ensure variety and a clear funnel. No extra text, only the JSON.`
}

export function getCalendarGenerationPrompt(
  briefJson: string,
  strategyJson: string,
  durationDays: number
): string {
  return `Create a ${durationDays}-day content calendar. Use the brief and strategy below. Return ONLY a valid JSON array of content items, no other text.

Brief:
${briefJson}

Strategy:
${strategyJson}

Each array element must be:
{
  "day_number": number,
  "platform": string (e.g. "instagram", "tiktok"),
  "slot_number": 1,
  "content_pillar": string,
  "funnel_stage": string,
  "post_type": string,
  "hook": string,
  "angle": string,
  "caption_direction": string,
  "cta": string,
  "prompt_seed": string,
  "status": "draft"
}

Rules: Vary hooks and CTAs. Mix awareness (~40%), engagement (~25%), desire (~20%), conversion (~15%). Follow weekly_rhythm. Include publish_date as YYYY-MM-DD starting from tomorrow. No extra text, only the JSON array.`
}

export function getRevisionPrompt(
  instruction: string,
  itemsJson: string,
  fromDay: number,
  toDay: number
): string {
  return `The user wants to revise content items for days ${fromDay} to ${toDay}.

Instruction: ${instruction}

Current items in range:
${itemsJson}

Return ONLY a valid JSON array of revised content items for the same day range. Each object must have day_number, platform, slot_number, content_pillar, funnel_stage, post_type, hook, angle, caption_direction, cta, prompt_seed, status. Keep the same structure. No extra text, only the JSON array.`
}

/** Try to parse JSON from LLM response (handles ```json ... ``` or raw JSON). */
export function parseJsonFromResponse(response: string): unknown {
  const trimmed = response.trim()
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]
  const str = jsonBlock ? jsonBlock.trim() : trimmed
  return JSON.parse(str) as unknown
}
