export interface NextFontRequest {
  import: string
  arguments: NextFontRequestArguments[]
}

export interface NextFontRequestArguments {
  weight?: string | string[]
  subsets?: string[]
  style?: string | string[]
  display?: string
  preload?: boolean
  axes?: string[]
  fallback?: string[]
  adjustFontFallback?: boolean
  variable?: string
}
