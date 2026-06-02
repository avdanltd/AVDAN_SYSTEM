import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) files.push(full)
  }
  return files
}

const replacements = [
  ['â¦', '…'],
  ['â¢', '•'],
  ['â', '—'],
  ['â', '’'],
]

let fixed = 0
for (const file of walk('apps')) {
  let content = readFileSync(file, 'utf8')
  if (!content.includes('â')) continue
  for (const [bad, good] of replacements) content = content.replaceAll(bad, good)
  writeFileSync(file, content, 'utf8')
  console.log('Fixed:', basename(file))
  fixed++
}
console.log('Done, fixed', fixed, 'files')
