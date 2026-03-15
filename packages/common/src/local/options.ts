import type { NextFontLocalRequestArguments } from './request'

export interface NextFontLocalDeclaration {
  prop: string
  value: string
}

export type FontWeight =
  | { type: 'variable'; start: string; end: string }
  | { type: 'fixed'; value: string }

export const parseFontWeight = (input: string): FontWeight => {
  const parts = input.trim().split(/\s+/)
  return parts.length === 2
    ? { type: 'variable', start: parts[0]!, end: parts[1]! }
    : { type: 'fixed', value: input }
}

export const fontWeightToString = (weight: FontWeight): string =>
  weight.type === 'variable' ? `${weight.start} ${weight.end}` : weight.value

export interface FontDescriptor {
  weight?: FontWeight
  style?: string
  path: string
  ext: string
}

export const fontDescriptorFromSrc = (src: {
  path: string
  weight?: string
  style?: string
}): FontDescriptor => {
  const parts = src.path.split('.')
  if (parts.length < 2) throw new Error('Extension required')

  return {
    path: src.path,
    weight: src.weight ? parseFontWeight(src.weight) : undefined,
    style: src.style,
    ext: parts.pop() as string,
  }
}

export interface NextFontLocalOptions {
  fonts: FontDescriptor | FontDescriptor[]
  defaultWeight?: FontWeight
  defaultStyle?: string
  display: string
  preload: boolean
  fallback?: string[]
  adjustFontFallback: NextFontLocalRequestArguments['adjustFontFallback']
  variable?: string
  variableName: string
  declarations?: NextFontLocalDeclaration[]
}

export const optionsFromRequest = (request: {
  variableName: string
  arguments: [
    {
      src: string | { path: string; weight?: string; style?: string }[]
      weight?: string
      style?: string
      preload?: boolean
      fallback?: string[]
      adjustFontFallback?: NextFontLocalRequestArguments['adjustFontFallback']
      variable?: string
      declarations?: NextFontLocalDeclaration[]
      display?: string
    },
  ]
}): NextFontLocalOptions => {
  const args = request.arguments[0]

  const fonts =
    typeof args.src === 'string'
      ? fontDescriptorFromSrc({
          path: args.src,
          weight: args.weight,
          style: args.style,
        })
      : args.src.map(fontDescriptorFromSrc)

  return {
    fonts,
    display: args.display ?? 'swap',
    preload: args.preload ?? true,
    fallback: args.fallback,
    adjustFontFallback: args.adjustFontFallback ?? 'Arial',
    variable: args.variable,
    variableName: request.variableName,
    defaultWeight: args.weight ? parseFontWeight(args.weight) : undefined,
    defaultStyle: args.style,
    declarations: args.declarations
      ? args.declarations.map((d) => ({ prop: d.prop, value: d.value }))
      : undefined,
  }
}
