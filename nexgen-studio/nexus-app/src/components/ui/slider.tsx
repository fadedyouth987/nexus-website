'use client'

import * as React from 'react'
import { cn } from '@/lib/core/utils'

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
}

export function Slider({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled,
  ...props
}: SliderProps) {
  const percentage = ((value[0] - min) / (max - min)) * 100

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute h-full bg-blue-600"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => {
          const newValue = parseFloat(e.target.value)
          onValueChange?.([newValue])
        }}
        disabled={disabled}
        className="absolute w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className={cn(
          'absolute block h-5 w-5 rounded-full border-2 border-blue-600 bg-white ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ left: `calc(${percentage}% - 10px)` }}
      />
    </div>
  )
}
