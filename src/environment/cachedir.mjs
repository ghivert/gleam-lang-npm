import * as os from 'node:os'
import * as path from 'node:path'

function posix(id) {
  const xdgCache = process.env.XDG_CACHE_HOME
  const cacheHome = xdgCache || path.join(os.homedir(), '.cache')
  return path.join(cacheHome, id)
}

function darwin(id) {
  return path.join(os.homedir(), 'Library', 'Caches', id)
}

function win32(id) {
  const local = process.env.LOCALAPPDATA
  const appData = local || path.join(os.homedir(), 'AppData', 'Local')
  return path.join(appData, id, 'Cache')
}

export function cachedir(id) {
  switch (process.platform) {
    case 'darwin':
      return darwin(id)
    case 'win32':
      return win32(id)
    case 'aix':
    case 'android':
    case 'freebsd':
    case 'linux':
    case 'netbsd':
    case 'openbsd':
    case 'sunos':
      return posix(id)
    default:
      return null
  }
}
