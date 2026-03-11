'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, Sparkles, Zap, Building2, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const plans = [
  {
    name: 'Starter',
    price: 49,
    currency: 'AUD',
    period: 'month',
    description: 'Perfect for individual creators getting started with AI content.',
    icon: Sparkles,
    features: [
      '1 Creator Profile',
      '50 Image Generations/month',
      'Basic Scheduling',
      'Community Support',
      'Standard Queue Priority',
    ],
    limitations: ['No custom models', 'No API access', 'No team collaboration'],
    credits: 4900,
    a100Hours: 22,
    popular: false,
  },
  {
    name: 'Pro',
    price: 279,
    currency: 'AUD',
    period: 'month',
    description: 'For professional creators who need more power and flexibility.',
    icon: Zap,
    features: [
      '5 Creator Profiles',
      '500 Image Generations/month',
      'Advanced Scheduling & Calendar',
      'Priority Support',
      'High Queue Priority',
      'Custom Model Training',
      'API Access',
    ],
    limitations: ['No white-label'],
    credits: 27900,
    a100Hours: 126,
    popular: true,
  },
  {
    name: 'Scale',
    price: 1099,
    currency: 'AUD',
    period: 'month',
    description: 'For teams and agencies managing multiple creators at scale.',
    icon: Building2,
    features: [
      'Unlimited Creator Profiles',
      'Unlimited Generations',
      'Team Collaboration',
      'Dedicated Support',
      'Highest Queue Priority',
      'Custom Model Training',
      'Full API Access',
      'White-label Options',
      'Analytics Dashboard',
    ],
    limitations: [],
    credits: 109900,
    a100Hours: 499,
    popular: false,
  },
  {
    name: 'Enterprise',
    price: null,
    currency: 'AUD',
    period: 'month',
    description: 'Custom solutions for large organizations with specific needs.',
    icon: Crown,
    features: [
      'Everything in Scale',
      'Custom Integrations',
      'SLA Guarantees',
      'Dedicated Infrastructure',
      'On-premise Options',
      'Custom Contracts',
      '24/7 Premium Support',
    ],
    limitations: [],
    credits: 'Custom',
    a100Hours: 'Unlimited',
    popular: false,
  },
]
