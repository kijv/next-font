export interface FontCssProperties {
  fontFamily: string
  weight?: string
  style?: string
  variable?: string
}

export const getRequestHash = (query: string): number => {
  const params = new URLSearchParams(query)
  const toHash: string[] = []

  for (const [k, v] of params.entries()) {
    toHash.push(k, v)
  }

  const input = toHash.join('')
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash *= prime
  }

  return Number(hash & 0xffffffffn)
}

export type FontFamilyType = 'webFont' | 'fallback'

export const getScopedFontFamily = (
  ty: FontFamilyType,
  fontFamilyName: string
): string => (ty === 'webFont' ? fontFamilyName : `${fontFamilyName} Fallback`)

export const getRequestId = (fontFamily: string, requestHash: number): string =>
  `${fontFamily.toLowerCase().replace(/ /g, '_')}_${requestHash.toString(16)}`

interface HasPath {
  path: string
}

const DOCUMENT_RE = /^(src\/)?_document\.[^/]+$/

export const canUseNextFont = async (
  projectPath: string,
  query: string
): Promise<boolean> => {
  const params = new URLSearchParams(query)
  const firstKey = params.keys().next().value

  if (!firstKey) {
    throw new Error('expected one entry')
  }

  const request: HasPath = JSON.parse(firstKey)
  const fullPath = `${projectPath}/${request.path}`

  const canUse = !DOCUMENT_RE.test(request.path)

  if (!canUse) {
    console.error(
      `next/font error: Cannot be used within ${request.path} (${fullPath})`
    )
  }

  return canUse
}
