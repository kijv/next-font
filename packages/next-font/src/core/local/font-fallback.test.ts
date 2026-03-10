import type { FontDescriptor, FontWeight } from '@/core/local/options'
import { describe, expect, it } from 'vitest'
import { pickFontFileForFallbackGeneration } from './font-fallback'

function generateFontDescriptor(
  weight: FontWeight,
  style?: string
): FontDescriptor {
  return {
    ext: 'ttf',
    path: 'foo.ttf',
    style,
    weight,
  }
}

describe('core/local/font-fallback', () => {
  it('picks weight closest to 400', () => {
    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'fixed', value: '300' }),
        generateFontDescriptor({ type: 'fixed', value: '600' }),
      ])
    ).toStrictEqual(generateFontDescriptor({ type: 'fixed', value: '300' }))

    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'fixed', value: '200' }),
        generateFontDescriptor({ type: 'fixed', value: '500' }),
      ])
    ).toStrictEqual(generateFontDescriptor({ type: 'fixed', value: '500' }))

    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'fixed', value: 'normal' }),
        generateFontDescriptor({ type: 'fixed', value: '700' }),
      ])
    ).toStrictEqual(generateFontDescriptor({ type: 'fixed', value: 'normal' }))

    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'fixed', value: 'bold' }),
        generateFontDescriptor({ type: 'fixed', value: '900' }),
      ])
    ).toStrictEqual(generateFontDescriptor({ type: 'fixed', value: 'bold' }))
  })

  it('picks thinner weight if same distance to 400', () => {
    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'fixed', value: '300' }),
        generateFontDescriptor({ type: 'fixed', value: '500' }),
      ])
    ).toStrictEqual(generateFontDescriptor({ type: 'fixed', value: '300' }))
  })

  it('picks variable closest to 400', () => {
    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'variable', start: '100', end: '300' }),
        generateFontDescriptor({ type: 'variable', start: '600', end: '900' }),
      ])
    ).toStrictEqual(
      generateFontDescriptor({ type: 'variable', start: '100', end: '300' })
    )

    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'variable', start: '100', end: '200' }),
        generateFontDescriptor({ type: 'variable', start: '500', end: '800' }),
      ])
    ).toStrictEqual(
      generateFontDescriptor({ type: 'variable', start: '500', end: '800' })
    )

    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({ type: 'variable', start: '100', end: '900' }),
        generateFontDescriptor({ type: 'variable', start: '300', end: '399' }),
      ])
    ).toStrictEqual(
      generateFontDescriptor({ type: 'variable', start: '100', end: '900' })
    )
  })

  it('prefers normal over italic', () => {
    expect(
      pickFontFileForFallbackGeneration([
        generateFontDescriptor(
          {
            type: 'fixed',
            value: '400',
          },
          'normal'
        ),
        generateFontDescriptor(
          {
            type: 'fixed',
            value: '400',
          },
          'italic'
        ),
      ])
    ).toStrictEqual(
      generateFontDescriptor({ type: 'fixed', value: '400' }, 'normal')
    )
  })

  it('errors on invalid weight', () => {
    expect(() =>
      pickFontFileForFallbackGeneration([
        generateFontDescriptor({
          type: 'variable',
          start: 'normal',
          end: 'bold',
        }),
        generateFontDescriptor({
          type: 'variable',
          start: '400',
          end: 'bold',
        }),
        generateFontDescriptor({
          type: 'variable',
          start: 'normal',
          end: '700',
        }),
        generateFontDescriptor({
          type: 'variable',
          start: '100',
          end: 'abc',
        }),
      ])
    ).toThrowError(
      'Invalid weight value in src array: `abc`. Expected `normal`, `bold` or a number'
    )
  })
})
