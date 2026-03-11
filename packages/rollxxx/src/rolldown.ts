import type { DeepMutable } from './declaration'
import type { Program } from 'oxc-parser'

export function normalizedInputOptionsCompat<
  T extends import('rollup').NormalizedInputOptions,
>(normalizedInputOptions: T): import('rolldown').NormalizedInputOptions {
  return {
    ...normalizedInputOptions,
    cwd: process.cwd(),
    platform: 'neutral',
    // TODO
    plugins: [],
  }
}

export function inputOptionsCompat<T extends import('rollup').InputOptions>(
  inputOptions: T
): import('rolldown').InputOptions {
  return {
    ...inputOptions,
    treeshake:
      inputOptions.treeshake != null
        ? typeof inputOptions.treeshake === 'string'
          ? (
              {
                smallest: {
                  propertyReadSideEffects: false,
                  moduleSideEffects: false,
                  unknownGlobalSideEffects: false,
                },
                safest: {},
                recommended: {
                  unknownGlobalSideEffects: false,
                },
              } as Record<
                import('rollup').TreeshakingPreset,
                import('rolldown').TreeshakingOptions
              >
            )[inputOptions.treeshake]
          : typeof inputOptions.treeshake === 'object'
            ? {
                ...inputOptions.treeshake,
                propertyReadSideEffects: (inputOptions.treeshake
                  .propertyReadSideEffects || false) as false | 'always',
              }
            : inputOptions.treeshake
        : inputOptions.treeshake,
  } satisfies import('rolldown').InputOptions
}

export function outputOptionsCompat<T extends import('rollup').OutputOptions>(
  this: import('rollup').PluginContext,
  outputOptions: T
): import('rolldown').OutputOptions {
  return {
    ...(outputOptions as Omit<
      T,
      | 'format'
      | 'banner'
      | 'footer'
      | 'intro'
      | 'outro'
      | 'assetFileNames'
      | 'entryFileNames'
      | 'chunkFileNames'
      | 'generatedCode'
      | 'manualChunks'
      | 'hoistTransitiveImports'
    >),
    format:
      outputOptions.format === 'amd' ||
      outputOptions.format === 'system' ||
      outputOptions.format === 'systemjs'
        ? undefined
        : outputOptions.format,
    banner: addonFunctionCompat(outputOptions.banner),
    footer: addonFunctionCompat(outputOptions.footer),
    intro: addonFunctionCompat(outputOptions.intro),
    outro: addonFunctionCompat(outputOptions.outro),
    assetFileNames: preRenderedAssetFunctionCompat(
      outputOptions.assetFileNames
    ),
    entryFileNames: preRenderedChunkFunctionCompat(
      outputOptions.entryFileNames
    ),
    chunkFileNames: preRenderedChunkFunctionCompat(
      outputOptions.chunkFileNames
    ),
    generatedCode:
      outputOptions.generatedCode != null &&
      typeof outputOptions.generatedCode === 'string'
        ? {
            preset: outputOptions.generatedCode,
          }
        : outputOptions.generatedCode,
    manualChunks:
      outputOptions.manualChunks != null &&
      typeof outputOptions.manualChunks === 'object'
        ? (moduleId) => {
            return Object.entries(outputOptions.manualChunks ?? {}).find(
              ([, value]) => value.includes(moduleId)
            )?.[0]
          }
        : typeof outputOptions.manualChunks === 'function'
          ? (moduleId, meta) => {
              return (
                outputOptions.manualChunks as import('rollup').GetManualChunk
              )(moduleId, {
                getModuleInfo(...args) {
                  const result = meta.getModuleInfo(...args)
                  if (!result) return null
                  return {
                    ...result,
                    moduleSideEffects: result.moduleSideEffects ?? false,
                    dynamicallyImportedIdResolutions: [],
                    exportedBindings: {},
                    safeVariableNames: {},
                    hasDefaultExport: false,
                    implicitlyLoadedAfterOneOf: [],
                    implicitlyLoadedBefore: [],
                    importedIdResolutions: [],
                    isExternal: false,
                    isIncluded: false,
                    attributes: {},
                    syntheticNamedExports: false,
                  }
                },
                getModuleIds: this.getModuleIds,
              })
            }
          : outputOptions.manualChunks,
    hoistTransitiveImports: outputOptions.hoistTransitiveImports
      ? undefined
      : false,
  }
}

const preRenderedAssetFunctionCompat = <const T>(
  fn?: T | ((chunkInfo: import('rollup').PreRenderedAsset) => string)
): T | ((chunkInfo: import('rolldown').PreRenderedAsset) => string) =>
  fn != null && typeof fn === 'function'
    ? function (chunkInfo: import('rolldown').PreRenderedAsset) {
        return (fn as (chunkInfo: import('rollup').PreRenderedAsset) => string)(
          {
            ...chunkInfo,
            originalFileName: chunkInfo.originalFileName ?? null,
            name: undefined,
          }
        )
      }
    : (fn as T)

const preRenderedChunkFunctionCompat = <const T>(
  fn: T | ((chunkInfo: import('rollup').PreRenderedChunk) => string)
): T | ((chunkInfo: import('rolldown').PreRenderedChunk) => string) =>
  typeof fn === 'function'
    ? function (chunkInfo: import('rolldown').PreRenderedChunk) {
        return (fn as (chunkInfo: import('rollup').PreRenderedChunk) => string)(
          {
            ...chunkInfo,
            isImplicitEntry: false,
            type: 'chunk',
            facadeModuleId: chunkInfo.facadeModuleId ?? null,
          }
        )
      }
    : (fn as T)

export const addonFunctionCompat = <const T>(
  fn: T | import('rollup').AddonFunction
): T | import('rolldown').AddonFunction =>
  fn != null && typeof fn === 'function'
    ? async (chunk: import('rolldown').RenderedChunk) => {
        const result = await (fn as import('rollup').AddonFunction)({
          ...chunk,
          implicitlyLoadedBefore: [],
          importedBindings: {},
          referencedFiles: [],
          isImplicitEntry: false,
          modules: Object.fromEntries(
            Object.entries(chunk.modules).map(([key, value]) => [
              key,
              {
                ...value,
                originalLength: 0,
                removedExports: [],
              } satisfies import('rollup').RenderedModule,
            ])
          ),
        })
        return result
      }
    : (fn as T)

export function pluginContextCompat(
  plugin: { name: string },
  context: import('rollup').PluginContext
): import('rolldown').PluginContext {
  return {
    ...context,
    ...minimalPluginContextCompat(plugin, context),
    getModuleInfo(...args) {
      const result = context.getModuleInfo(...args)
      if (!result) return null
      return moduleInfoCompat(result)
    },
    async load(...args) {
      const result = await context.load(...args)
      return moduleInfoCompat(result)
    },
    parse(input, options) {
      const result = context.parse(input, {
        jsx: options?.lang === 'jsx' || options?.lang === 'tsx',
        allowReturnOutsideFunction: true,
      })
      return result as Program
    },
  }
}

export function transformPluginContext(
  plugin: { name: string },
  context: import('rollup').PluginContext
): import('rolldown').TransformPluginContext {
  return {
    ...context,
    ...pluginContextCompat(plugin, context),
    getCombinedSourcemap() {
      return {
        file: '',
        mappings: '',
        names: [],
        sources: [],
        sourcesContent: [],
        version: 3,
        toUrl(): string {
          return ''
        },
        toString(): string {
          return ''
        },
      }
    },
  }
}

export function minimalPluginContextCompat(
  plugin: { name: string },
  context: import('rollup').MinimalPluginContext
): import('rolldown').MinimalPluginContext {
  return {
    ...context,
    pluginName: plugin.name,
    meta: {
      rolldownVersion: undefined as unknown as string,
      rollupVersion: context.meta.rollupVersion,
      watchMode: context.meta.watchMode,
    },
  } satisfies import('rolldown').MinimalPluginContext
}

export function normalizedOutputOptionsCompat<
  T extends import('rollup').NormalizedOutputOptions,
>(
  this: import('rollup').PluginContext,
  normalizedOutputOptions: T
): import('rolldown').NormalizedOutputOptions {
  const outputOptions = outputOptionsCompat.bind(this)(normalizedOutputOptions)
  const forceAddonFunction = (
    value?: string | import('rolldown').AddonFunction
  ) => (value != null && typeof value === 'string' ? () => value : value!)

  return {
    ...outputOptions,
    assetFileNames: outputOptions.assetFileNames!,
    chunkFileNames: outputOptions.chunkFileNames!,
    entryFileNames: outputOptions.entryFileNames!,
    globals: outputOptions.globals!,
    paths: outputOptions.paths!,
    sourcemapIgnoreList: outputOptions.sourcemapIgnoreList!,
    sourcemapPathTransform: outputOptions.sourcemapPathTransform!,
    virtualDirname: outputOptions.virtualDirname!,
    banner: forceAddonFunction(outputOptions.banner),
    footer: forceAddonFunction(outputOptions.footer),
    intro: forceAddonFunction(outputOptions.intro),
    outro: forceAddonFunction(outputOptions.outro),
    exports: normalizedOutputOptions.exports ?? [],
    sourcemap: normalizedOutputOptions.sourcemap ?? false,
    sourcemapBaseUrl: outputOptions.sourcemapBaseUrl!,
    inlineDynamicImports: outputOptions.inlineDynamicImports ?? false,
    dynamicImportInCjs: outputOptions.dynamicImportInCjs ?? false,
    externalLiveBindings: outputOptions.externalLiveBindings ?? false,
    esModule: outputOptions.esModule ?? false,
    extend: outputOptions.extend ?? false,
    sourcemapDebugIds: outputOptions.sourcemapDebugIds ?? false,
    preserveModules: outputOptions.preserveModules ?? false,
    hashCharacters: outputOptions.hashCharacters ?? 'base64',
    codeSplitting: false,
    postBanner: () => '',
    postFooter: () => '',
    minify: false,
    legalComments: 'none',
    comments: {
      annotation: false,
      jsdoc: false,
      legal: false,
    },
    polyfillRequire: false,
    name: outputOptions.name,
    file: outputOptions.file,
    dir: outputOptions.dir,
    format:
      normalizedOutputOptions.format === 'amd' ||
      normalizedOutputOptions.format === 'system'
        ? 'es'
        : normalizedOutputOptions.format,
    // TODO
    plugins: [],
  }
}

export function outputBundleCompat(
  bundle: import('rollup').OutputBundle
): import('rolldown').OutputBundle {
  return Object.fromEntries(
    Object.entries(bundle).map(([fileName, chunk]) => [
      fileName,
      chunk satisfies Omit<
        import('rolldown').OutputAsset | import('rolldown').OutputChunk,
        '__rolldown_external_memory_handle__'
      > as unknown as
        | import('rolldown').OutputAsset
        | import('rolldown').OutputChunk,
    ])
  )
}

export function moduleInfoCompat(
  moduleInfo: import('rollup').ModuleInfo
): import('rolldown').ModuleInfo {
  return Object.assign(
    {},
    moduleInfo as DeepMutable<typeof moduleInfo>,
    {
      inputFormat: 'unknown',
      exports: moduleInfo.exports ?? [],
    } as const
  )
}
