export const NEXT_FONT_SOURCES = ['next/font', '@next/font', 'next-font']
export const NEXT_FONT_LOADERS = NEXT_FONT_SOURCES.flatMap((mod) => [
  `${mod}/google`,
  `${mod}/local`,
])
