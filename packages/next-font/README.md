## Next Font

Derived from `@next/font`. Aimed to be used in conjunction with [@next-font/plugin- vite](https://npmjs.com/packages/@next-font/vite)

> This package is best used with the [@next-font/plugin-vite](https://npmjs.com/packages/@next-font/vite) package or any plugins under the [@next-font](https://npmjs.com/org/next-font) organization.

### Install

```
npm install next-font
```

### Usage

Exact same usage as `next/font`/`@next/font`.

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

This package also supports accessing the manifest, which contains per-file font information. This can be useful for generating preload or preconnect tags in the `<head>` of your HTML document.

```js
import nextFontManifest from 'next-font/manifest';

// raw manifest
const manifest = nextFontManifest.manifest;

// get fonts with preload enabled
const preloadableFonts = nextFontManifest.getPreloadableFonts(someFilePath /* ex. import.meta.url */);
// or skip accessing preloadableFonts and get data for <head>
const metadata = nextFontManifest.getFontMetadata(someFilePath /* ex. import.meta.url */);
```

See the Next.js [API Page](https://nextjs.org/docs/app/api-reference/components/font) for more options.
