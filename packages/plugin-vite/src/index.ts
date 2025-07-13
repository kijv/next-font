import type { NextFontManifest } from "next-font/manifest";
import type {
  PluginOption,
} from 'vite';
import { getPageIsUsingSizeAdjust, getPreloadedFontFiles } from './manifest';
import { nextFontLoaderPlugin, nextFontManifestPlugin, nextFontTransformerPlugin, type OnFinished } from './plugins';
import type { Mutable } from "./declarations";

// import { toOutputFilePathInCss } from "@vitejs/vite/packages/vite/src/node/build";
// import { slash, cleanUrl } from "@vitejs/vite/packages/vite/src/shared/utils";

const nextFontPlugin = (): PluginOption[] => {
  // const viteFontsResolvedId = fileURLToPath(import.meta.resolve('./fonts'));

  /*
  const preloadedFonts = new Set<string>();
  const preloadFont = (href: string): HtmlTagDescriptor => {
    const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(path.basename(href))![1];
    const type = `font/${ext}`;

    return {
      tag: 'link',
      injectTo: 'head',
      attrs: {
        as: 'font',
        rel: 'preload',
        crossorigin: 'anonymous',
        href,
        type,
      },
    };
  };

  const fileFontImports = new Map<string, string[]>();
  const targetCssCache = new Map<
    string,
    Awaited<ReturnType<typeof compileTargetCss>>
  >();
  const targetCssToFontFile = new Map<string, string[]>();

  const fontFileCache = new Map<string, Buffer>() as unknown as Omit<
    Map<string, Buffer>,
    'set' | 'delete'
  > & {
    _set: (id: string, content: Buffer) => void;
    _delete: (id: string) => void;
    set: (
      id: string,
      content: Buffer,
    ) => {
      preloaded: boolean;
    };
    delete: (id: string) => {
      preloaded: boolean;
    };
  };
  Object.assign(fontFileCache, {
    _set: fontFileCache.set,
    _delete: fontFileCache.delete,
    set: (id: string, content: Buffer) => {
      const lastPreloadFontsLength = structuredClone(preloadedFonts).size;

      fontFileCache._set(id, content);
      if (id.includes('.p') && !preloadedFonts.has(id)) {
        preloadedFonts.add(id);
      }

      return {
        preloaded: preloadedFonts.size !== lastPreloadFontsLength,
      };
    },
    delete: (id: string) => {
      const lastPreloadFontsLength = structuredClone(preloadedFonts).size;

      fontFileCache._delete(id);
      preloadedFonts.delete(id);

      return {
        preloaded: preloadedFonts.size !== lastPreloadFontsLength,
      };
    },
  });

  const getPreloadedFontsCode = () => {
    return `export function getPreloadedFonts() {
  return ${JSON.stringify(
    Array.from(preloadedFonts)
      .map(preloadFont)
      .map((p) => p.attrs),
  )};
}`;
  };

  const invalidatePreloadedFonts = async () => {
    for (const server of servers) {
      const preloadedFontsModule =
        server.moduleGraph.getModulesByFile(viteFontsResolvedId);
      console.log('preloadedFontsModule', !!preloadedFontsModule);
      const s = new MagicString(getPreloadedFontsCode());
      for (const mod of preloadedFontsModule ?? []) {
        server.moduleGraph.updateModuleTransformResult(
          mod,
          {
            code: s.toString(),
            map: s.generateMap({ hires: true }),
          },
          true,
        );
      }

      // server.ws.send({
      //   type: 'update',
      //   updates: [
      //     {
      //       type: 'js-update',
      //       path: '/@next-font/vite/fonts',
      //       acceptedPath: '/@next-font/vite/fonts',
      //       timestamp: Date.now(),
      //     },
      //   ],
      // });
      // server.moduleGraph.onFileChange(viteFontsResolvedId);
      // server.ws.send({
      //   type: 'full-reload',
      // });
      if (Array.from(preloadedFontsModule ?? []).length > 0)
        server.moduleGraph.invalidateAll();
    }
  };
  */

  const fontImports: Record<string, string[]> = new Proxy<
    Record<string, string[]>
  >(
    {},
    {
      get(t, p, r) {
        return Reflect.get(t, p, r);
      },
      set(t, p, v, r) {
        return Reflect.set(t, p, v, r);
      },
    },
  );

  const nextFontManifest = {
    isUsingSizeAdjust: false,
  } as Mutable<NextFontManifest>;

  const onFinished: OnFinished = async (fileToFontNames) => {
    for (const [id, fontFiles] of fileToFontNames) {
      // Look if size-adjust fallback font is being used
      if (!nextFontManifest.isUsingSizeAdjust) {
        nextFontManifest.isUsingSizeAdjust =
          getPageIsUsingSizeAdjust(fontFiles)
      }

      const preloadedFontFiles = getPreloadedFontFiles(fontFiles);

      // Add an entry of the module's font files in the manifest.
      // We'll add an entry even if no files should preload.
      // When an entry is present but empty, instead of preloading the font files, a preconnect tag is added.
      if (fontFiles.length > 0) {
        nextFontManifest[id] ||= [];
        nextFontManifest[id].push(...preloadedFontFiles);
      }
    }
  };

  return [
    nextFontTransformerPlugin({
      fontImports,
      onFontImportsChanged: () => { }
    }),
    nextFontLoaderPlugin({
      fontImports,
      onFinished,
    }),
    nextFontManifestPlugin({
      nextFontManifest,
    }),
    // {
    //   name: 'next-font:preloaded-fonts:pre',
    //   enforce: 'pre',
    //   handleHotUpdate({ file }) {
    //     console.log('handleHotUpdate', file);
    //   },
    //   async transform(_code, id) {
    //     const matchId = viteFontsResolvedId;
    //     let match = false;

    //     if (!match) match = id === matchId;
    //     if (!match) {
    //       const { data: resolvedId, error } = await tryCatch(
    //         importResolve(removeQuerySuffix(id)),
    //       );
    //       if (error) return null;

    //       match = resolvedId === matchId;
    //     }

    //     if (match) {
    //       console.log('match', id);

    //       if (!this.getWatchFiles().includes(id)) {
    //         this.addWatchFile(id);
    //       }

    //       for (const server of servers) {
    //         if (!(await server.moduleGraph.getModulesByFile(id))?.size) {
    //           server.moduleGraph.createFileOnlyEntry(id);
    //         }
    //       }

    //       return getPreloadedFontsCode();
    //     }
    //   },
    // },
    // {
    //   name: 'next-font:preloaded-fonts:post',
    //   enforce: 'post',

    // },
    // {
    //   name: 'next-font:manifest',
    // }
  ] as PluginOption[];
};

export default nextFontPlugin;
