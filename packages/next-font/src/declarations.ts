export type FontLoaderOptions = Omit<
  {
    functionName: string;
    variableName: string;
    data: any[];
    emitFontFile: (
      content: Buffer,
      ext: string,
      preload: boolean,
      isUsingSizeAdjust?: boolean,
    ) => string;
    resolve: (src: string) => string;
    isDev: boolean;
    isServer: boolean;
    loaderContext: any;
  },
  'loaderContext'
> & {
  id: string;
  ctx: {
    fs?: {
      readFile: (...args: any[]) => Promise<Buffer | Uint8Array | string>;
    },
    error: (message: string) => any;
  };
  cache?: {
    css?: Map<string, string | null>;
    font?: Map<string, string | null>;
  };
};

export type FontLoader = (options: FontLoaderOptions) => Promise<{
  css: string;
  fallbackFonts?: string[];
  variable?: string;
  adjustFontFallback?: AdjustFontFallback;
  weight?: string;
  style?: string;
}>;

export type AdjustFontFallback = {
  fallbackFont: string;
  ascentOverride?: string;
  descentOverride?: string;
  lineGapOverride?: string;
  sizeAdjust?: string;
};
