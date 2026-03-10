import type { FontData } from './options'

export type FontWeights =
  | { type: 'variable' }
  | { type: 'fixed'; values: number[] }

export type FontStyle = 'normal' | 'italic'

export type FontAxes = {
  wght: FontAxesWeights
  ital: Set<FontStyle>
  variableAxes?: [string, string][]
}

export type FontAxesWeights =
  | { type: 'variable'; range?: string }
  | { type: 'fixed'; values: number[] }

type VariantValue = string | number

export const getFontAxes = (
  fontData: FontData,
  fontFamily: string,
  weights: FontWeights,
  styles: string[],
  selectedVariableAxes?: string[]
): FontAxes => {
  const entry = fontData[fontFamily]
  if (!entry) throw new Error('Font family not found')

  const ital = new Set<FontStyle>()
  if (styles.includes('normal')) ital.add('normal')
  if (styles.includes('italic')) ital.add('italic')

  if (weights.type === 'variable') {
    const axes = entry.axes
    if (!axes) throw new Error(`Font ${fontFamily} has no definable \`axes\``)

    if (selectedVariableAxes) {
      const availableTags = axes.map((a) => a.tag)
      for (const tag of selectedVariableAxes) {
        if (!availableTags.includes(tag)) {
          throw new Error(
            `Invalid axes value ${tag} for font ${fontFamily}. Available axes: ${availableTags.join(', ')}`
          )
        }
      }
    }

    let weightRange: string | undefined = undefined
    const variableAxes: [string, string][] = []

    for (const axis of axes) {
      if (axis.tag === 'wght') {
        weightRange = `${axis.min}..${axis.max}`
      } else if (selectedVariableAxes?.includes(axis.tag)) {
        variableAxes.push([axis.tag, `${axis.min}..${axis.max}`])
      }
    }

    return {
      wght: { type: 'variable', range: weightRange },
      ital,
      variableAxes: variableAxes.length ? variableAxes : undefined,
    }
  }

  // Fixed weights
  return {
    wght: {
      type: 'fixed',
      values: weights.values.slice().sort((a, b) => a - b),
    },
    ital,
  }
}

export const getStylesheetUrl = (
  rootUrl: string,
  fontFamily: string,
  axes: FontAxes,
  display: string
): string => {
  const variants: Array<Array<[string, VariantValue]>> = []

  let weights: VariantValue[] = []
  if (axes.wght.type === 'variable' && axes.wght.range)
    weights = [axes.wght.range]
  else if (axes.wght.type === 'fixed') weights = axes.wght.values

  if (
    !weights.length &&
    axes.variableAxes != null &&
    axes.variableAxes.length > 0
  ) {
    variants.push(axes.variableAxes)
  } else {
    for (const w of weights) {
      if (axes.ital.size === 0) {
        variants.push(
          ([['wght', w]] as [string, VariantValue][]).concat(
            axes.variableAxes?.map(([k, v]) => [k, v]) ?? []
          )
        )
      } else {
        for (const ital of axes.ital) {
          variants.push(
            [
              ital === 'italic' || axes.ital.size > 1
                ? ['ital', ital === 'normal' ? '0' : '1']
                : [],
              ['wght', w],
            ].concat(axes.variableAxes ?? []) as unknown as [
              string,
              VariantValue,
            ][]
          )
        }
      }
    }
  }

  for (let i = 0; i < variants.length; i++) {
    variants[i] = variants[i]!.sort((a, b) => {
      const isALowercase = a[0]!.charCodeAt(0) > 96
      const isBLowercase = b[0]!.charCodeAt(0) > 96
      if (isALowercase && !isBLowercase) {
        return -1
      } else if (isBLowercase && !isALowercase) {
        return 1
      } else {
        return a[0].localeCompare(b[0])
      }
    })
  }

  const firstVariant = variants[0]!
  if (!firstVariant)
    return `${rootUrl}?family=${fontFamily.replace(/ /g, '+')}&display=${display}`

  const variantKeysStr = firstVariant.map(([k]) => k).join(',')
  const variantValues = variants
    .map((variant) => variant.map((pair) => pair[1]))
    .toSorted((a, b) => {
      for (let i = 0; i < Math.min(a.length, a.length); i++) {
        const ai = a[i]!,
          bi = b[i]!
        const cmp =
          typeof ai === typeof bi
            ? ai < bi
              ? -1
              : ai > bi
                ? 1
                : 0
            : typeof ai === 'string'
              ? -1
              : 1
        if (cmp !== 0) return cmp
      }
      return a.length - b.length
    })
  const variantValuesStr = variantValues
    .map((v) => v.map((v) => v.toString()).join(','))
    .join(';')

  return `${rootUrl}?family=${fontFamily.replace(/ /g, '+')}:${variantKeysStr}@${variantValuesStr}&display=${display}`
}
