/**
 * FormShell - Shared form container for consistent form UX
 *
 * Provides consistent:
 * - Loading states
 * - Error handling
 * - Submit button patterns
 * - Form header/footer structure
 * - Validation state display
 */

import { useState, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface FormShellProps {
  /** Form title displayed in header */
  title: string
  /** Optional subtitle/description */
  description?: string
  /** Form content */
  children: React.ReactNode
  /** Primary submit button text */
  submitLabel?: string
  /** Secondary action (e.g., Cancel) */
  secondaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
  /** Form submission handler - return error message on failure, undefined/null on success */
  onSubmit: () => Promise<string | undefined | void>
  /** Optional: Control disabled state of submit button */
  isValid?: boolean
  /** Optional: Additional validation message shown when form is invalid */
  validationMessage?: string
  /** Optional: Show success state with custom message */
  successMessage?: string
  /** Optional: Footer content below submit button */
  footer?: React.ReactNode
  /** Optional: Card className override */
  className?: string
  /** Optional: Full-width layout (no max-width constraint) */
  fullWidth?: boolean
}

/**
 * FormShell - Consistent form container with built-in state management
 *
 * @example
 * <FormShell
 *   title="Create Campaign"
 *   description="Set up a new content campaign"
 *   submitLabel="Create Campaign"
 *   onSubmit={async () => {
 *     const result = await api.createCampaign(data)
 *     return result.error // undefined on success
 *   }}
 *   isValid={formValid}
 * >
 *   <CampaignFormFields />
 * </FormShell>
 */
export function FormShell({
  title,
  description,
  children,
  submitLabel = 'Submit',
  secondaryAction,
  onSubmit,
  isValid = true,
  validationMessage = 'Please fix validation errors before submitting',
  successMessage = 'Success!',
  footer,
  className,
  fullWidth = false,
}: FormShellProps) {
  const [status, setStatus] = useState<FormStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setError(validationMessage)
      return
    }

    setStatus('submitting')
    setError(null)

    try {
      const result = await onSubmit()

      if (result) {
        setError(result)
        setStatus('error')
      } else {
        setStatus('success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setStatus('error')
    }
  }, [isValid, onSubmit, validationMessage])

  const isSubmitting = status === 'submitting'
  const showSuccess = status === 'success'

  return (
    <Card className={`${fullWidth ? '' : 'max-w-2xl'} ${className || ''}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Global Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success State */}
        {showSuccess && (
          <Alert className="border-green-500/50 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <div className={isSubmitting ? 'pointer-events-none opacity-70' : ''}>
          {children}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          {secondaryAction && (
            <Button
              type="button"
              variant="outline"
              onClick={secondaryAction.onClick}
              disabled={isSubmitting || secondaryAction.disabled}
              className="flex-1 sm:flex-none"
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || showSuccess}
            className="flex-1 sm:flex-none gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {showSuccess ? 'Done' : submitLabel}
          </Button>
        </div>

        {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
      </CardFooter>
    </Card>
  )
}

/**
 * FormSection - Reusable form section with consistent spacing
 */
interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={`space-y-3 ${className || ''}`}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * FormField - Reusable field wrapper with label and error
 */
interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, required, children, className }: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

/**
 * FormGrid - 2-column grid for side-by-side fields
 */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}
