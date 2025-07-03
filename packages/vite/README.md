## Next Font for Vite

`next/font` (`next-font`) for Vite projects

### Install

```
npm install @next-font/vite
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