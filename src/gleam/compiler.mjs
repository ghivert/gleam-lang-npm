import * as fs from 'node:fs'

/** @param {string} version @param {string} arch  @param {string} platform */
function endpoint(version, arch, platform) {
  const base = 'https://github.com/gleam-lang/gleam/releases/download'
  return `${base}/${version}/gleam-${version}-${arch}-${platform}.tar.gz`
}

/** @param {{ tgzPath: string, version: string, arch: string, platform: string }} options */
export async function download({ tgzPath, version, arch, platform }) {
  if (fs.existsSync(tgzPath)) return
  const endpt = endpoint(version, arch, platform)
  const res = await fetch(endpt)
  if (!res.ok) throw new Error('Unreachable')
  const tgz = await res.arrayBuffer()
  await fs.promises.writeFile(tgzPath, Buffer.from(tgz))
}
