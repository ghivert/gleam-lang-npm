export { cachedir } from './environment/cachedir.mjs'

export function infos() {
  const arch = getArch()
  const platform = getPlatform()
  return { arch, platform }
}

function getArch() {
  switch (process.arch) {
    case 'arm64':
      return 'aarch64'
    case 'x64':
      return 'x86_64'
    default:
      return null
  }
}

function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'apple-darwin'
    case 'win32':
      return 'pc-windows-msvc'
    case 'aix':
    case 'android':
    case 'freebsd':
    case 'linux':
    case 'netbsd':
    case 'openbsd':
    case 'sunos':
      return 'unknown-linux-musl'
    default:
      return null
  }
}
