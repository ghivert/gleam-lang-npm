import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import * as toml from 'smol-toml'
import * as releases from './manifest.mjs'

/** @typedef {(version: string) => boolean} Requirement */

/** @param {string} text @returns {Requirement | null} */
function comparator(text) {
  const match = text
    .trim()
    .match(/^(==|!=|>=|<=|>|<|~>)?\s*(\d+(?:\.\d+){0,2})$/)
  if (!match) return null
  const [, operator = '==', raw = ''] = match
  const parts = raw.split('.')
  const version = [...parts, '0', '0'].slice(0, 3).join('.')
  switch (operator) {
    case '==':
      return v => semver.eq(v, version)
    case '!=':
      return v => semver.neq(v, version)
    case '>=':
      return v => semver.gte(v, version)
    case '<=':
      return v => semver.lte(v, version)
    case '>':
      return v => semver.gt(v, version)
    case '<':
      return v => semver.lt(v, version)
    default: {
      if (parts.length < 2) return null
      const major = Number(parts[0])
      const minor = Number(parts[1])
      const upper =
        parts.length === 2 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
      return v => semver.gte(v, version) && semver.lt(v, upper)
    }
  }
}

// gleam.toml uses the Hex syntax: `>= 1.0.0 and < 2.0.0`, `~> 1.6`.
/** @param {string} spec @returns {Requirement | null} */
function hex(spec) {
  const groups = spec
    .split(/\s+or\s+/)
    .map(group => group.split(/\s+and\s+/).map(comparator))
  if (groups.some(group => group.includes(null))) return null
  return v => groups.some(group => group.every(test => test?.(v)))
}

// engines and mise use semver ranges, where `1.19` means any 1.19.x.
/** @param {string} spec @returns {Requirement | null} */
function range(spec) {
  const text = spec.trim().replace(/^(v|prefix:)/, '')
  if (text === 'latest') return () => true
  if (!semver.validRange(text)) return null
  return v => semver.satisfies(v, text)
}

/** @param {string} content */
function parseToml(content) {
  try {
    return toml.parse(content)
  } catch {
    return {}
  }
}

/** @param {string} content */
function readGleamToml(content) {
  const gleam = parseToml(content).gleam
  return typeof gleam === 'string' ? gleam : null
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isTable(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// mise accepts a string, a list of versions or a table with a `version`.
/** @param {string} content */
function readMise(content) {
  const tools = parseToml(content).tools
  const gleam = isTable(tools) ? tools.gleam : null
  const first = Array.isArray(gleam) ? gleam[0] : gleam
  const entry = isTable(first) ? first.version : first
  return typeof entry === 'string' ? entry : null
}

/** @param {string} content */
function readEngines(content) {
  try {
    const gleam = JSON.parse(content)?.engines?.gleam
    return typeof gleam === 'string' ? gleam : null
  } catch {
    return null
  }
}

/** @param {string} content */
function readToolVersions(content) {
  for (const line of content.split(/\r?\n/)) {
    const [tool, version] = line.replace(/#.*/, '').trim().split(/\s+/)
    if (tool === 'gleam') return version ?? null
  }
  return null
}

const sources = [
  { files: ['gleam.toml'], read: readGleamToml, parse: hex },
  { files: ['package.json'], read: readEngines, parse: range },
  {
    files: ['mise.local.toml', 'mise.toml', '.mise.toml'],
    read: readMise,
    parse: range,
  },
  { files: ['.tool-versions'], read: readToolVersions, parse: range },
]

/** @param {string} file */
function readFile(file) {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch {
    return null
  }
}

/** @param {string} start @param {string[]} files @param {(content: string) => string | null} read */
function findUp(start, files, read) {
  let dir = path.resolve(start)
  while (true) {
    for (const name of files) {
      const file = path.join(dir, name)
      const content = readFile(file)
      const spec = content === null ? null : read(content)
      if (spec) return { file, spec }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

// Highest first.
function available() {
  return Object.keys(releases.manifest.versions).sort(semver.rcompare)
}

export function latest() {
  const [version] = available()
  if (!version) throw new Error('The manifest does not list any release.')
  return version
}

/** @param {string} cwd */
export function fromProject(cwd) {
  for (const source of sources) {
    const found = findUp(cwd, source.files, source.read)
    if (!found) continue
    const requirement = source.parse(found.spec)
    if (!requirement) {
      throw new Error(`Invalid Gleam version "${found.spec}" in ${found.file}.`)
    }
    const version = available().find(requirement)
    if (!version) {
      throw new Error(
        `No Gleam release matches "${found.spec}" from ${found.file}. ` +
          'Update @chouquette/gleam to get newer releases.'
      )
    }
    return { version, file: found.file }
  }
  return null
}
