import * as sigstore from 'sigstore'

const issuer = 'https://token.actions.githubusercontent.com'
const workflow = 'gleam-lang/gleam/.github/workflows/release.yaml'

// The attestation must come from the release workflow of this very tag, and
// must have been signed for this very archive.
/** @param {string} version @param {string} file @param {string} digest @param {any} bundle */
export async function verifyAttestation(version, file, digest, bundle) {
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
