import { describe, expect, it } from 'vitest'
import { nextFontLoaders } from '@/transform'

import { parseSync } from 'oxc-parser'
import { print } from 'esrap'
import ts from 'esrap/languages/ts'

describe('transform', () => {
  const transformer = nextFontLoaders({
    relativeFilePathFromRoot: 'pages/test.tsx',
    fontLoaders: ['@next/font/google', 'cool-fonts'],
  })

  const transform = (code: string) => {
    const { program } = parseSync('pages/test.tsx', code)
    transformer(program)
    return print(program, ts(), {
      indent: '  ',
    }).code
  }

  it('default import', () => {
    expect(
      transform(
        `import cool from 'cool-fonts'

    const font = cool({ prop: true })`
      )
    ).toBe(
      `import font from 'cool-fonts/target.css?{"path":"pages/test.tsx","import":"","arguments":[{"prop":true}],"variableName":"font"}';`
    )
  })

  it('export const', () => {
    expect(
      transform(`import React from 'react'
      import { Abel, Inter } from '@next/font/google'

      export const firaCode = Abel()
      export const inter = Inter()`)
    ).toBe(`import React from 'react';
import firaCode from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Abel","arguments":[],"variableName":"firaCode"}';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[],"variableName":"inter"}';

export { firaCode };
export { inter };`)
  })

  it('exports', () => {
    expect(
      transform(`import React from 'react'
      import { Abel, Inter } from '@next/font/google'

      const firaCode = Abel()
      const inter = Inter()

      export { firaCode }
      export default inter`)
    ).toBe(`import React from 'react';
import firaCode from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Abel","arguments":[],"variableName":"firaCode"}';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[],"variableName":"inter"}';

export { firaCode };

export default inter;`)
  })

  it('font options', () => {
    expect(
      transform(`import React from 'react'
    import { Fira_Code } from '@next/font/google'

    const firaCode = Fira_Code({
      variant: '400',
      fallback: ['system-ui', { key: false }, []],
      preload: true,
      key: { key2: {} },
    })

    console.log(firaCode)`)
    ).toBe(`import React from 'react';
import firaCode from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Fira_Code","arguments":[{"variant":"400","fallback":["system-ui",{"key":false},[]],"preload":true,"key":{"key2":{}}}],"variableName":"firaCode"}';

console.log(firaCode);`)
  })

  it('import as', () => {
    expect(
      transform(`import React from 'react'
  import { Acme as a } from 'cool-fonts'

  const acme1 = a({
    variant: '400',
  })`)
    ).toBe(`import React from 'react';
import acme1 from 'cool-fonts/target.css?{"path":"pages/test.tsx","import":"Acme","arguments":[{"variant":"400"}],"variableName":"acme1"}';`)
  })

  it('many args', () => {
    expect(
      transform(`import { Geo } from '@next/font/google'

    const geo = Geo('test', [1], { a: 2 }, 3)`)
    ).toBe(
      `import geo from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Geo","arguments":["test",[1],{"a":2},3],"variableName":"geo"}';`
    )
  })

  it('multiple calls', () => {
    expect(
      transform(`import React from 'react'
  import { Inter } from '@next/font/google'

  const inter = Inter({
    variant: '900',
    display: 'swap',
  })

  const inter = Inter({
    variant: '900',
    display: 'swap',
  })`)
    ).toBe(`import React from 'react';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[{"variant":"900","display":"swap"}],"variableName":"inter"}';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[{"variant":"900","display":"swap"}],"variableName":"inter"}';`)
  })

  it('multiple font downloaders', () => {
    expect(
      transform(`import React from 'react'
      import { Inter } from '@next/font/google'
      import { Fira_Code } from 'cool-fonts'

      const inter = Inter({
        variant: '900',
      })

      const fira = Fira_Code({
        variant: '400',
        display: 'swap',
      })`)
    ).toBe(`import React from 'react';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[{"variant":"900"}],"variableName":"inter"}';
import fira from 'cool-fonts/target.css?{"path":"pages/test.tsx","import":"Fira_Code","arguments":[{"variant":"400","display":"swap"}],"variableName":"fira"}';`)
  })

  it('multiple fonts', () => {
    expect(
      transform(`import React from 'react'
    import { Fira_Code, Inter } from '@next/font/google'

    const firaCode = Fira_Code({
      variant: '400',
      fallback: ['system-ui'],
    })
    const inter = Inter({
      variant: '900',
      display: 'swap',
    })`)
    ).toBe(`import React from 'react';
import firaCode from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Fira_Code","arguments":[{"variant":"400","fallback":["system-ui"]}],"variableName":"firaCode"}';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[{"variant":"900","display":"swap"}],"variableName":"inter"}';`)
  })

  it('multiple imports', () => {
    expect(
      transform(`import React from 'react'
    import { Inter } from '@next/font/google'
    import { Fira_Code } from '@next/font/google'

    const inter = Inter({
      variant: '900',
    })

    const fira = Fira_Code({
      variant: '400',
      display: 'swap',
    })`)
    ).toBe(`import React from 'react';
import inter from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Inter","arguments":[{"variant":"900"}],"variableName":"inter"}';
import fira from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Fira_Code","arguments":[{"variant":"400","display":"swap"}],"variableName":"fira"}';`)
  })

  it('no args', () => {
    expect(
      transform(`import { Fira_Code } from '@next/font/google'

    const fira = Fira_Code()`)
    ).toBe(
      `import fira from '@next/font/google/target.css?{"path":"pages/test.tsx","import":"Fira_Code","arguments":[],"variableName":"fira"}';`
    )
  })
})
