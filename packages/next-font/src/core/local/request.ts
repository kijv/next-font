export interface NextFontLocalRequest {
  arguments: [NextFontLocalRequestArguments]
  variableName: string
}

export interface NextFontLocalDeclaration {
  prop: string
  value: string
}

export interface NextFontLocalRequestArguments {
  src: string | SrcDescription[]
  weight?: string
  style?: string
  display: string
  preload: boolean
  fallback?: string[]
  adjustFontFallback: 'Arial' | 'Times New Roman' | undefined
  variable: string
  declarations: NextFontLocalDeclaration[]
}

export interface SrcDescription {
  path: string
  weight?: string
  style?: string
}

export const DEFAULT_ADJUST_FONT_FALLBACK: NextFontLocalRequestArguments['adjustFontFallback'] =
  'Arial'

export const DEFAULT_PRELOAD = true

export const DISPALY_DISPLAY = 'swap'
