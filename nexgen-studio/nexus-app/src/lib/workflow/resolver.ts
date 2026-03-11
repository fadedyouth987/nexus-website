import type { WorkflowVariableBindings } from './types'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function deepSet(target: Record<string, any>, path: string, value: unknown) {
  const parts = path.split('.')
  let current: Record<string, any> = target

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key]
  }

  current[parts[parts.length - 1]!] = value
}

export function resolveWorkflow(
  templateWorkflow: Record<string, any>,
  variableBindings: WorkflowVariableBindings,
  finalInputs: Record<string, unknown>
) {
  const workflow = deepClone(templateWorkflow || {})
  const fields = variableBindings?.fields || {}

  for (const [fieldName, spec] of Object.entries(fields)) {
    if (!(fieldName in finalInputs)) {
      continue
    }

    if (!workflow[spec.node]) {
      throw new Error(`Template missing node ${spec.node} for ${fieldName}`)
    }

    deepSet(workflow[spec.node], spec.path, finalInputs[fieldName])
  }

  return workflow
}
