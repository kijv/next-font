import { type FontAxes, getFontAxes, getStylesheetUrl } from './util'
import { describe, expect, it } from 'vitest'
import type { FontData } from './options'
import { GOOGLE_FONTS_STYLESHEET_URL } from '.'

describe('core/google/util', () => {
  it('errors on unknown font', () => {
    const data: FontData = {
      ABeeZee: {
        weights: ['variable'],
        styles: ['normal', 'italic'],
      },
    }

    expect(() =>
      getFontAxes(data, 'foobar', { type: 'variable' }, [], undefined)
    ).toThrowError('Font family not found')
  })

  it('errors on missing axes', () => {
    const data: FontData = {
      ABeeZee: {
        weights: ['variable'],
        styles: ['normal', 'italic'],
      },
    }

    expect(() =>
      getFontAxes(data, 'ABeeZee', { type: 'variable' }, [], undefined)
    ).toThrowError('Font ABeeZee has no definable `axes`')
  })

  it('selecting axes', () => {
    const data: FontData = {
      Inter: {
        weights: ['400', 'variable'],
        styles: ['normal', 'italic'],
        axes: [
          {
            tag: 'slnt',
            min: -10,
            max: 0,
            defaultValue: 0,
          },
          {
            tag: 'wght',
            min: 100,
            max: 900,
            defaultValue: 400,
          },
        ],
      },
    }

    expect(
      getFontAxes(data, 'Inter', { type: 'variable' }, [], ['slnt'])
    ).toStrictEqual({
      wght: {
        type: 'variable',
        range: '100..900',
      },
      ital: new Set(),
      variableAxes: [['slnt', '-10..0']],
    } satisfies FontAxes)
  })

  it('no wght axis', () => {
    const data: FontData = {
      Inter: {
        weights: ['400', 'variable'],
        styles: ['normal', 'italic'],
        axes: [
          {
            tag: 'slnt',
            min: -10,
            max: 0,
            defaultValue: 0,
          },
        ],
      },
    }

    expect(
      getFontAxes(data, 'Inter', { type: 'variable' }, [], ['slnt'])
    ).toEqual({
      variableAxes: [['slnt', '-10..0']],
      wght: {
        type: 'variable',
      },
      ital: new Set(),
    } satisfies FontAxes)
  })

  it('no variable', () => {
    const data: FontData = {
      Hind: {
        weights: ['300', '400', '500', '600', '700'],
        styles: ['normal'],
      },
    }

    expect(
      getFontAxes(data, 'Hind', { type: 'fixed', values: [500] }, [], undefined)
    ).toEqual({
      wght: {
        type: 'fixed',
        values: [500],
      },
      ital: new Set(),
    } satisfies FontAxes)
  })

  it('stylesheet url no axes', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Roboto Mono',
        {
          wght: {
            type: 'fixed',
            values: [500],
          },
          ital: new Set(),
          variableAxes: [],
        },
        'optional'
      )
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@500&display=optional'
    )
  })

  it('stylesheet url sorts axes', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Roboto Serif',
        {
          wght: {
            type: 'fixed',
            values: [500],
          },
          ital: new Set(),
          variableAxes: [
            ['GRAD', '-50..100'],
            ['opsz', '8..144'],
            ['wdth', '50..150'],
          ],
        },
        'optional'
      )
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Roboto+Serif:opsz,wdth,wght,GRAD@8..144,50..150,500,-50..100&display=optional'
    )
  })

  it('stylesheet url sorts weights numerically', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Roboto Serif',
        {
          wght: {
            type: 'fixed',
            values: [1000, 500, 200],
          },
          ital: new Set(),
          variableAxes: [],
        },
        'optional'
      )
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Roboto+Serif:wght@200;500;1000&display=optional'
    )
  })

  it('stylesheet url encodes all weight ital combinations', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Roboto Serif',
        {
          wght: {
            type: 'fixed',
            values: [500, 300],
          },
          ital: new Set(['normal', 'italic']),
          variableAxes: [
            ['GRAD', '-50..100'],
            ['opsz', '8..144'],
            ['wdth', '50..150'],
          ],
        },
        'optional'
      )
    ).toBe(
      // Note ;-delimited sections for normal@300, normal@500, italic@300, italic@500
      'https://fonts.googleapis.com/css2?family=Roboto+Serif:ital,opsz,wdth,wght,GRAD@0,8..144,50..150,300,-50..100;0,8..144,50..150,500,-50..100;1,8..144,50..150,300,-50..100;1,8..144,50..150,500,-50..100&display=optional'
    )
  })

  it('stylesheet url variable font without wgth axis', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Nabla',
        {
          variableAxes: [
            ['EDPT', '0..200'],
            ['EHLT', '0..24'],
          ],
          ital: new Set(),
          wght: { type: 'fixed', values: [] },
        },
        'optional'
      )
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Nabla:EDPT,EHLT@0..200,0..24&display=optional'
    )
  })

  it('stylesheet url variable font without anything', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Nabla',
        {
          variableAxes: [],
          ital: new Set(),
          wght: { type: 'fixed', values: [] },
        },
        'swap'
      )
    ).toBe('https://fonts.googleapis.com/css2?family=Nabla&display=swap')
  })

  it('stylesheet url variable font with empty variable axes', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Nabla',
        {
          variableAxes: [],
          ital: new Set(),
          wght: { type: 'fixed', values: [] },
        },
        'swap'
      )
    ).toBe('https://fonts.googleapis.com/css2?family=Nabla&display=swap')
  })

  it('stylesheet url with no variable', () => {
    expect(
      getStylesheetUrl(
        GOOGLE_FONTS_STYLESHEET_URL,
        'Hind',
        {
          ital: new Set(),
          wght: { type: 'fixed', values: [500] },
        },
        'optional'
      )
    ).toBe(
      'https://fonts.googleapis.com/css2?family=Hind:wght@500&display=optional'
    )
  })
})
