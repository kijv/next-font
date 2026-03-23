## next-font rolldown plugin

Use Next.js's Font API in Rolldown environments.

> ⚠️ `next-font/manifest` is current unsupported

### Install

```
npm install next-font rolldown-plugin-next-font
```

### Usage

Configuration:

```js
import { defineConfig } from 'rolldown'
import nextFont from 'rolldown-plugin-next-font'

export default defineConfig({
  plugins: [nextFont()],
})
```

Practically:

```js
import { Inter } from 'next-font/google'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return <h1 className={inter.className}>Hello World</h1>
}
```

See [the Next.js documentation](https://nextjs.org/docs/app/api-reference/components/font) for more details. Note that where it uses `next/font` imports, `next-font` imports should be used instead.
