import { execSync } from 'node:child_process'

/**
 * Returns a nightly version string, e.g. "0.0.0-nightly-240601.0"
 * @param pkgName Optional package name to prefix the tag
 */
export function getNightlyVersion(pkgName?: string): string {
  const tagPrefix = pkgName ? `${pkgName}-` : 'nightly-'
  const now = new Date()
  // Format date as yyMMdd
  const dateStr = now
    .toLocaleDateString('en-GB')
    .split('/')
    .reverse()
    .map((s, i) => (i === 0 ? s.slice(-2) : s.padStart(2, '0')))
    .join('')

  let nightlyTag: string
  try {
    nightlyTag = execSync(`git tag -l "${tagPrefix}*"`).toString()
  } catch {
    throw new Error('Failed to list nightly tags')
  }

  const tags = nightlyTag.split('\n').filter((tag) => tag.startsWith(tagPrefix))

  const latestNightlyTag = tags.length > 0 ? tags.sort().reverse()[0] : ''

  let patch: number | undefined
  if (latestNightlyTag) {
    const lastPart = latestNightlyTag.split('.').pop()
    patch = lastPart ? parseInt(lastPart, 10) : undefined
  }

  return `0.0.0-${tagPrefix}${dateStr}.${patch !== undefined ? patch + 1 : 0}`
}
