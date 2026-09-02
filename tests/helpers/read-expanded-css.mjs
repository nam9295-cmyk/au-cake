import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const localRelativeImport = /@import\s+(['"])(\.{1,2}\/[^'"\r\n]+)\1\s*;/g

function cssPath(entry) {
  if (entry instanceof URL) return fileURLToPath(entry)
  if (entry.startsWith('file:')) return fileURLToPath(entry)
  return entry
}

function importMatches(css) {
  return [...css.matchAll(localRelativeImport)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    path: match[2],
  }))
}

function replaceImports(css, imports, replacements) {
  let expanded = ''
  let cursor = 0

  for (let index = 0; index < imports.length; index += 1) {
    const imported = imports[index]
    expanded += css.slice(cursor, imported.start)
    expanded += replacements[index]
    cursor = imported.end
  }

  return expanded + css.slice(cursor)
}

function childPath(importerPath, importedPath) {
  return resolve(dirname(importerPath), importedPath)
}

function expandCssSync(path) {
  const css = readFileSync(path, 'utf8')
  const imports = importMatches(css)
  const replacements = imports.map((imported) => expandCssSync(childPath(path, imported.path)))
  return replaceImports(css, imports, replacements)
}

async function expandCss(path) {
  const css = await readFile(path, 'utf8')
  const imports = importMatches(css)
  const replacements = await Promise.all(imports.map((imported) => expandCss(childPath(path, imported.path))))
  return replaceImports(css, imports, replacements)
}

export function readExpandedCssSync(entry) {
  return expandCssSync(cssPath(entry))
}

export function readExpandedCss(entry) {
  return expandCss(cssPath(entry))
}
