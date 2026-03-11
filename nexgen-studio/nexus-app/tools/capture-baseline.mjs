import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const [, , outputFile, ...commandParts] = process.argv

if (!outputFile || commandParts.length === 0) {
  console.error('Usage: node tools/capture-baseline.mjs <output-file> "<command>"')
  process.exit(0)
}

const command = commandParts.join(' ')
const startedAt = new Date().toISOString()
const result =
  process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
        encoding: 'utf8',
        env: process.env,
      })
    : spawnSync(command, {
        shell: true,
        encoding: 'utf8',
        env: process.env,
      })

const endedAt = new Date().toISOString()
const output = [
  `# Baseline Capture`,
  `started_at=${startedAt}`,
  `ended_at=${endedAt}`,
  `command=${command}`,
  `exit_code=${result.status ?? 1}`,
  '',
  '## stdout',
  result.stdout || '',
  '',
  '## stderr',
  result.stderr || '',
  '',
  '## error',
  result.error ? String(result.error) : '',
  '',
].join('\n')

mkdirSync(dirname(outputFile), { recursive: true })
writeFileSync(outputFile, output, 'utf8')
console.log(`Captured baseline -> ${outputFile} (exit ${result.status ?? 1})`)

process.exit(0)
