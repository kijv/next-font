import {
  type Fallback,
  type FontMetricsMap,
  lookupFallback,
} from './font-fallback'
import { describe, expect, it } from 'vitest'

describe('core/google/font-fallback', () => {
  it('fallback from metrics sans serif', () => {
    const fontMetrics: FontMetricsMap = {
      inter: {
        familyName: 'Inter',
        category: 'sans-serif',
        capHeight: 2048,
        ascent: 2728,
        descent: -680,
        lineGap: 0,
        unitsPerEm: 2816,
        xHeight: 1536,
        xWidthAvg: 1335,
      },
      arial: {
        familyName: 'Arial',
        category: 'sans-serif',
        capHeight: 1467,
        ascent: 1854,
        descent: -434,
        lineGap: 67,
        unitsPerEm: 2048,
        xHeight: 1062,
        xWidthAvg: 904,
      },
    }

    expect(lookupFallback('Inter', fontMetrics, true)).toEqual({
      fontFamily: 'Arial',
      adjustment: {
        ascent: 0.901_989_700_374_532,
        descent: -0.224_836_142_322_097_4,
        lineGap: 0.0,
        sizeAdjust: 1.074_014_481_094_127,
      },
    })
  })

  it('fallback from metrics serif', () => {
    const fontMetrics: FontMetricsMap = {
      robotoSlab: {
        familyName: 'Roboto Slab',
        category: 'serif',
        capHeight: 1456,
        ascent: 2146,
        descent: -555,
        lineGap: 0,
        unitsPerEm: 2048,
        xHeight: 1082,
        xWidthAvg: 969,
      },
      timesNewRoman: {
        familyName: 'Times New Roman',
        category: 'serif',
        capHeight: 1356,
        ascent: 1825,
        descent: -443,
        lineGap: 87,
        unitsPerEm: 2048,
        xHeight: 916,
        xWidthAvg: 819,
      },
    }

    expect(lookupFallback('Roboto Slab', fontMetrics, true)).toStrictEqual({
      fontFamily: 'Times New Roman',
      adjustment: {
        ascent: 0.885_645_438_273_993_8,
        descent: -0.229_046_234_036_377_7,
        lineGap: 0.0,
        sizeAdjust: 1.183_150_183_150_183_2,
      },
    } satisfies Fallback)
  })
})
