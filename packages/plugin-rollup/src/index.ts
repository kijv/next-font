import type { Plugin } from 'rollup'
import { downUp } from 'rollxxx'
import rolldownNextFontGoogle from 'rolldown-plugin-next-font'

const rollupNextFont = (): Plugin[] =>
  downUp.pluginsCompat(rolldownNextFontGoogle())

export default rollupNextFont
