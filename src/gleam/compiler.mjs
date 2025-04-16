import * as fs from 'node:fs'

function endpoint(version, arch, platform) {
  const base = 'https://github.com/gleam-lang/gleam/releases/download'
  return `${base}/${version}/gleam-${version}-${arch}-${platform}.tar.gz`
}

export async function download({ tgzPath, version, arch, platform }) {
  if (fs.existsSync(tgzPath)) return
  const endpt = endpoint(version, arch, platform)
  const res = await fetch(endpt)
  if (!res.ok) throw new Error('Unreachable')
  const tgz = await res.arrayBuffer()
  await fs.promises.writeFile(tgzPath, Buffer.from(tgz))
}
