// Adds Gleam releases to src/manifest.mjs, after checking each archive.
// Usage: npm run manifest -- add 1.19.0 [...]
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'
import * as prettier from 'prettier'
import * as sigstore from 'sigstore'

const repo = 'gleam-lang/gleam'
const workflow = `${repo}/.github/workflows/release.yaml`
const issuer = 'https://token.actions.githubusercontent.com'
const manifestUrl = new URL('../src/manifest.mjs', import.meta.url)

const arches = ['aarch64', 'x86_64']
const platforms = ['apple-darwin', 'pc-windows-msvc', 'unknown-linux-musl']

/**
 * @typedef {import('../src/manifest.mjs').Asset} Asset
 * @typedef {import('../src/manifest.mjs').Manifest} Manifest
 */

/** @param {string} address */
async function get(address) {
  const res = await fetch(address)
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${address}.`)
  return res
}

/** @param {string} version @param {string} name @param {string} dir */
async function download(version, name, dir) {
  const base = `https://github.com/${repo}/releases/download`
  const res = await get(`${base}/v${version}/${name}`)
  const file = path.join(dir, name)
  await fs.promises.writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

/** @param {string} version */
async function listAssets(version) {
  const api = `https://api.github.com/repos/${repo}/releases/tags`
  const release = await (await get(`${api}/v${version}`)).json()
  return release.assets.map(
    (/** @type {{ name: string }} */ asset) => asset.name
  )
}

/** @param {string} file */
async function sha256(file) {
  const hash = crypto.createHash('sha256')
  hash.update(await fs.promises.readFile(file))
  return hash.digest('hex')
}

// The attestation must come from the release workflow of this very tag, and
// must have been signed for this very archive.
/** @param {string} version @param {string} file @param {string} digest @param {string} bundlePath */
async function verifyAttestation(version, file, digest, bundlePath) {
  const bundle = JSON.parse(await fs.promises.readFile(bundlePath, 'utf-8'))
  await sigstore.verify(bundle, {
    certificateIssuer: issuer,
    certificateIdentityURI: `https://github.com/${workflow}@refs/tags/v${version}`,
  })
  const payload = Buffer.from(bundle.dsseEnvelope.payload, 'base64')
  const { subject } = JSON.parse(payload.toString('utf-8'))
  const signed = subject.find(
    (/** @type {{ name: string }} */ s) => s.name === file
  )
  if (signed?.digest?.sha256 !== digest) {
    throw new Error(`${file}: the attestation does not cover this archive.`)
  }
}

/** @param {string} version @param {string} triple @param {string[]} available @param {string} dir @returns {Promise<Asset | null>} */
async function record(version, triple, available, dir) {
  const file = available.find(name => {
    const prefix = `gleam-v${version}-${triple}.`
    return name === `${prefix}tar.gz` || name === `${prefix}zip`
  })
  if (!file) return null

  const archive = await download(version, file, dir)
  const digest = await sha256(archive)

  const published = await download(version, `${file}.sha256`, dir)
  const expected = (await fs.promises.readFile(published, 'utf-8'))
    .trim()
    .split(/\s+/)[0]
  if (digest !== expected)
    throw new Error(`${file}: sha256 mismatch (${digest} != ${expected})`)

  const bundle = `${file}.sigstore`
  if (!available.includes(bundle))
    return { file, sha256: digest, provenance: 'sha256-only' }

  const bundlePath = await download(version, bundle, dir)
  await verifyAttestation(version, file, digest, bundlePath)
  return { file, sha256: digest, provenance: 'sigstore' }
}

/** @param {string} version @returns {Promise<Record<string, Asset>>} */
async function collect(version) {
  const available = await listAssets(version)
  const dir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'gleam-manifest-')
  )
  try {
    /** @type {Record<string, Asset>} */
    const assets = {}
    for (const arch of arches) {
      for (const platform of platforms) {
        const triple = `${arch}-${platform}`
        const asset = await record(version, triple, available, dir)
        if (asset) assets[triple] = asset
        console.log(`  ${triple}: ${asset ? asset.provenance : 'no asset'}`)
      }
    }
    return assets
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}

/** @param {string} left @param {string} right */
function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** @returns {Promise<Manifest>} */
async function read() {
  try {
    return (await import(manifestUrl.href)).manifest
  } catch {
    return { versions: {} }
  }
}

const HEADER = `// Generated by scripts/manifest.mjs, do not edit.

/**
 * @typedef {{
 *   file: string
 *   sha256: string
 *   provenance: 'sigstore' | 'sha256-only'
 * }} Asset
 * @typedef {{ versions: Record<string, Record<string, Asset>> }} Manifest
 */

/** @type {Manifest} */
`

/** @param {Manifest} manifest */
async function write(manifest) {
  const sorted = Object.keys(manifest.versions).sort(compareVersions)
  const versions = Object.fromEntries(
    sorted.map(v => [v, manifest.versions[v]])
  )
  const code = `${HEADER}export const manifest = ${JSON.stringify({ versions })}\n`
  const file = url.fileURLToPath(manifestUrl)
  const options = await prettier.resolveConfig(file)
  const formatted = await prettier.format(code, { ...options, filepath: file })
  await fs.promises.writeFile(file, formatted)
}

const [command, ...versions] = process.argv.slice(2)
if (command !== 'add' || versions.length === 0) {
  console.error('Usage: npm run manifest -- add <version> [<version>...]')
  process.exit(1)
}
for (const version of versions) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Invalid version "${version}": expected stable X.Y.Z.`)
    process.exit(1)
  }
}

const manifest = await read()
for (const version of versions) {
  console.log(`v${version}`)
  manifest.versions[version] = await collect(version)
  await write(manifest)
}
