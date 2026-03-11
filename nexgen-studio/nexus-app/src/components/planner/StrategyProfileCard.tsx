'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StrategyProfile = {
  content_pillars_json?: string[]
  funnel_stages_json?: string[]
  weekly_rhythm_json?: Record<string, string>
  cta_rules_json?: Record<string, string>
}

type StrategyProfileCardProps = {
  strategy: StrategyProfile | null
}

export function StrategyProfileCard({ strategy }: StrategyProfileCardProps) {
  if (!strategy) return null

  const pillars = Array.isArray(strategy.content_pillars_json) ? strategy.content_pillars_json : []
  const stages = Array.isArray(strategy.funnel_stages_json) ? strategy.funnel_stages_json : []
  const rhythm = strategy.weekly_rhythm_json && typeof strategy.weekly_rhythm_json === 'object' ? strategy.weekly_rhythm_json : {}
  const ctaRules = strategy.cta_rules_json && typeof strategy.cta_rules_json === 'object' ? strategy.cta_rules_json : {}

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Strategy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {pillars.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Content pillars</p>
            <ul className="list-disc list-inside text-foreground">
              {pillars.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {stages.length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Funnel stages</p>
            <p className="text-foreground">{stages.join(' → ')}</p>
          </div>
        )}
        {Object.keys(ctaRules).length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">CTA rules</p>
            <ul className="space-y-0.5 text-foreground">
              {Object.entries(ctaRules).map(([k, v]) => (
                <li key={k}><span className="capitalize">{k}</span>: {v}</li>
              ))}
            </ul>
          </div>
        )}
        {Object.keys(rhythm).length > 0 && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Weekly rhythm</p>
            <ul className="space-y-0.5 text-foreground">
              {Object.entries(rhythm).map(([day, theme]) => (
                <li key={day}><span className="capitalize">{day}</span>: {theme}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
