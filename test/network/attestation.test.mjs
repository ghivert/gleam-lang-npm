import * as assert from 'node:assert/strict'
import * as test from 'node:test'
import { verifyAttestation } from '../../scripts/attestation.mjs'
import * as releases from '../../src/manifest.mjs'

const darwin = 'aarch64-apple-darwin'
const linux = 'x86_64-unknown-linux-musl'

/** @param {string} version @param {string} triple */
function archive(version, triple) {
  const asset = releases.manifest.versions[version]?.[triple]
  if (!asset) throw new Error(`${version} ${triple} is not in the manifest`)
  return asset
}

/** @param {string} version @param {string} triple */
async function bundle(version, triple) {
  const base = 'https://github.com/gleam-lang/gleam/releases/download'
  const file = archive(version, triple).file
  const res = await fetch(`${base}/v${version}/${file}.sigstore`)
  if (!res.ok) throw new Error(`Unable to download the bundle of ${file}.`)
  return res.json()
}

test.describe('attestation of a release', () => {
  test.it('accepts the bundle of the archive', async () => {
    const { file, sha256 } = archive('1.19.2', darwin)
    const signed = await bundle('1.19.2', darwin)
    await verifyAttestation('1.19.2', file, sha256, signed)
  })

  test.it('refuses the bundle of one release for another', async () => {
    const { file, sha256 } = archive('1.19.2', darwin)
    const signed = await bundle('1.19.2', darwin)
    await assert.rejects(
      verifyAttestation('1.19.1', file, sha256, signed),
      /certificate identity error/
    )
  })

  test.it('refuses a bundle replayed from an older release', async () => {
    const { file, sha256 } = archive('1.19.2', darwin)
    const replayed = await bundle('1.19.1', darwin)
    await assert.rejects(
      verifyAttestation('1.19.2', file, sha256, replayed),
      /certificate identity error/
    )
  })

  test.it('refuses a bundle signed for another archive', async () => {
    const { file, sha256 } = archive('1.19.2', linux)
    const signed = await bundle('1.19.2', darwin)
    await assert.rejects(
      verifyAttestation('1.19.2', file, sha256, signed),
      /does not cover this archive/
    )
  })

  test.it('refuses an archive whose checksum differs', async () => {
    const { file } = archive('1.19.2', darwin)
    const signed = await bundle('1.19.2', darwin)
    await assert.rejects(
      verifyAttestation('1.19.2', file, 'f'.repeat(64), signed),
      /does not cover this archive/
    )
  })

  test.it('refuses a statement that was altered', async () => {
    const { file, sha256 } = archive('1.19.2', darwin)
    const signed = await bundle('1.19.2', darwin)
    const statement = Buffer.from(signed.dsseEnvelope.payload, 'base64')
    const altered = statement.toString('utf-8').replace(sha256, 'f'.repeat(64))
    signed.dsseEnvelope.payload = Buffer.from(altered).toString('base64')
    await assert.rejects(
      verifyAttestation('1.19.2', file, 'f'.repeat(64), signed),
      /DSSE payload hash mismatch/
    )
  })
})
