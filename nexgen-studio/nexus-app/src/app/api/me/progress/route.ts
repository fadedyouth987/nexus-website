import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function GET(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const admin = getEngineSupabaseAdmin()

    // Check for creators (legacy or v2)
    const [legacyCreators, v2Creators] = await Promise.all([
      admin.from('creators').select('id').eq('user_id', authUserId).limit(1),
      admin.from('creators_v2').select('id').eq('user_id', authUserId).limit(1),
    ])
    const hasCreator = (legacyCreators.data?.length || 0) > 0 || (v2Creators.data?.length || 0) > 0

    // Check for generated content (assets)
    const { data: assets } = await admin
      .from('assets')
      .select('id')
      .eq('user_id', authUserId)
      .limit(1)
    const hasContent = (assets?.length || 0) > 0

    // Check for content plans
    const { data: plans } = await admin
      .from('planner_plans')
      .select('id')
      .eq('user_id', authUserId)
      .limit(1)
    const hasPlan = (plans?.length || 0) > 0

    // Check for social accounts
    const { data: socialAccounts } = await admin
      .from('social_accounts')
      .select('id')
      .eq('user_id', authUserId)
      .limit(1)
    const hasSocialAccounts = (socialAccounts?.length || 0) > 0

    // Check for scheduled posts
    const { data: scheduledPosts } = await admin
      .from('schedules_v2')
      .select('id')
      .eq('created_by', authUserId)
      .limit(1)
    // Also check legacy posts
    const { data: legacyPosts } = await admin
      .from('posts')
      .select('id')
      .eq('user_id', authUserId)
      .in('status', ['scheduled', 'published'])
      .limit(1)
    const hasScheduledPosts =
      (scheduledPosts?.length || 0) > 0 || (legacyPosts?.length || 0) > 0

    return NextResponse.json({
      hasCreator,
      hasContent,
      hasPlan,
      hasSocialAccounts,
      hasScheduledPosts,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to fetch progress' },
      { status }
    )
  }
}
