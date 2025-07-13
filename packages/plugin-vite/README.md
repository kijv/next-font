## Next Font for Vite

`next/font` (or [`next-font`](https://npmjs.org/package/next-font)) for Vite projects

### Install

```
npm install @next-font/plugin-vite
```

### Usage

Vite config file:

```js
import { defineConfig } from 'vite'
import nextFont from '@next-font/vite'

export default defineConfig({
  plugins: [nextFont()],
})
```

> You can use `next/font`, `@next/font`, or `next-font` when loading fonts, and it will work with this plugin
