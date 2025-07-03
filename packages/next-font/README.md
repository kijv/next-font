## Next Font

Derived from `@next/font` for wider usage in React projects.

### Install

```
npm install next-font
```

### Usage

Exact same usage as `next/font`

A example using google fonts:

```jsx
import { Inter } from 'next-font/google'

const inter = Inter({
  subsets: ['latin']
}) // { className: '...' }
```

An example using local fonts:

```js
import localFont from 'next-font/local'

const myFont = localFont({
  src: './my-font.woff2'
}) // { className: '...' }
```

See the Next.js [API Page](https://nextjs.org/docs/app/api-reference/components/font) for more options.

