import * as crypto from 'node:crypto'

/** @typedef {{ version: string, file: string, sha256: string }} Release */

const timeout = 5 * 60 * 1000

// The archive is only returned when it matches the checksum of the manifest.
/** @param {Release} release */
export async function download({ version, file, sha256 }) {
  const base = 'https://github.com/gleam-lang/gleam/releases/download'
  const res = await fetch(`${base}/v${version}/${file}`, {
    signal: AbortSignal.timeout(timeout),
  })
  if (!res.ok) throw new Error(`Unable to download ${file} (${res.status}).`)
  const archive = Buffer.from(await res.arrayBuffer())
  const digest = crypto.createHash('sha256').update(archive).digest('hex')
  if (digest !== sha256) throw new Error(`Checksum mismatch for ${file}.`)
  return archive
}
