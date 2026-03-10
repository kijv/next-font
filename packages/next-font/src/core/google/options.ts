import type { FontWeights } from './util'
import type { NextFontRequest } from './request'
import { arraify } from '@/util'

type Axis = {
  tag: string
  min: number
  max: number
  defaultValue?: number
}

export type FontDataEntry = {
  weights: string[]
  styles: string[]
  axes?: Axis[]
}

export type FontData = Record<string, FontDataEntry>

export type NextFontGoogleOptions = {
  fontFamily: string
  weights: FontWeights
  styles: string[]
  display: string
  preload: boolean
  selectedVariableAxes?: string[]
  fallback?: string[]
  adjustFontFallback: boolean
  variable?: string
  subsets?: string[]
}

const ALLOWED_DISPLAY_VALUES = ['auto', 'block', 'swap', 'fallback', 'optional']

export const optionsFromRequest = (
  request: NextFontRequest,
  data: Map<string, FontDataEntry>
): NextFontGoogleOptions => {
  if (request.arguments.length > 1) {
    throw new Error(
      'Only zero or one arguments to font functions are currently supported'
    )
  }

  // Invariant enforced above: either None or Some(the only item in the vec)
  let argument = request.arguments[0] ?? {}

  // `import` comes from the imported symbol in JS, which separates with _
  let fontFamily = request.import.replace('_', ' ')
  let fontData = data.get(fontFamily)
  if (!fontData) throw new Error('Unknown font')

  const requestedWeights = new Set<string>(arraify(argument.weight ?? []))

  const styles = arraify(argument.style ?? [])

  const supportsVariableWeight = fontData.weights.some(
    (weight) => weight === 'variable'
  )
  const weights:
    | {
        type: 'variable'
      }
    | {
        type: 'fixed'
        values: number[]
      } = (() => {
    if (requestedWeights.size === 0 || requestedWeights.has('variable')) {
      if (requestedWeights.size === 0 && !supportsVariableWeight) {
        throw new Error(
          `Missing weight for ${fontFamily}. Available weights: ${fontData.weights.join(', ')}`
        )
      }
      if (requestedWeights.has('variable') && requestedWeights.size > 1) {
        throw new Error(
          `Unexpected \`variable\` in weight array for font \`${fontFamily}\`. You only need \`variable\`, it includes all available weights.`
        )
      }
      return { type: 'variable' }
    } else {
      for (const requestedWeight of requestedWeights) {
        if (!fontData.weights.includes(requestedWeight)) {
          throw new Error(
            `Unexpected weight \`${requestedWeight}\` for font \`${fontFamily}\`. Available weights: ${fontData.weights.join(', ')}`
          )
        }
      }
      return {
        type: 'fixed',
        values: Array.from(requestedWeights).map((w) => parseInt(w, 10)),
      }
    }
  })()

  if (styles.length === 0) {
    if (fontData.styles.length === 1) {
      styles.push(fontData.styles[0]!)
    } else {
      styles.push('normal')
    }
  }

  for (const requestedStyle of styles) {
    if (!fontData.styles.includes(requestedStyle)) {
      throw new Error(
        `Unexpected style \`${requestedStyle}\` for font \`${fontFamily}\`. Available styles: ${fontData.styles.join(', ')}`
      )
    }
  }

  const display = argument.display ?? 'swap'

  if (!ALLOWED_DISPLAY_VALUES.includes(display)) {
    throw new Error(
      `Invalid display value ${display} for font ${fontFamily}.\nAvailable display values: ${ALLOWED_DISPLAY_VALUES.join(', ')}`
    )
  }

  if (argument.axes != null && argument.axes.length > 0) {
    if (!supportsVariableWeight) {
      throw new Error('Axes can only be defined for variable fonts.')
    }

    if (weights.type !== 'variable') {
      throw new Error(
        'Axes can only be defined for variable fonts when the weight property is nonexistent or set to `variable`.'
      )
    }
  }

  return {
    fontFamily,
    weights,
    styles,
    display,
    preload: argument.preload ?? true,
    selectedVariableAxes: argument.axes,
    fallback: argument.fallback,
    adjustFontFallback: argument.adjustFontFallback ?? true,
    variable: argument.variable,
    subsets: argument.subsets,
  }
}
