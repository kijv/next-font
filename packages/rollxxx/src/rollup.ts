import * as rolldownCompat from './rolldown'
import {
  BindingMagicString,
  type HookFilterExtension,
  type ModuleInfo,
  type ObjectHook,
} from 'rolldown'
import {
  type HookHandler,
  getCachedFilterForPlugin,
  getHookHandler,
} from './shared'
import { arraify, flatten, isPromise } from './util'
import type { DeepMutable } from './declaration'
import path from 'node:path'

type MaybePromise<T> = T | Promise<T>
type NullValue<T = void> = T | undefined | null | void
type Optionify<T> = MaybePromise<
  | NullValue<T>
  | {
      name: string
    }
  | false
  | Optionify<T>[]
>

export function pluginsCompat<const T>(
  p: Optionify<T> | false | null | undefined
): import('rollup').Plugin[] {
  return p != null
    ? flatten(arraify(p))
        .map((plugin) =>
          plugin != false && plugin != null
            ? isPromise(plugin)
              ? plugin.then((p) =>
                  p != false && p != null ? pluginsCompat(p) : p
                )
              : typeof plugin === 'object' && plugin != null
                ? 'name' in plugin
                  ? pluginCompat(plugin)
                  : undefined
                : plugin
            : undefined
        )
        .filter((v): v is import('rollup').Plugin => !!v)
    : []
}

export function pluginCompat(
  plugin: import('rolldown').Plugin
): import('rollup').Plugin {
  const objectHookWithAddonHook = (
    hook?: ObjectHook<string | import('rolldown').AddonFunction>
  ) => {
    const handler = getHookHandler(hook)
    return typeof handler === 'object' || typeof handler === 'function'
      ? addonHookCompat(handler)
      : handler
  }
  const hookFilterExt = <
    H extends 'resolveId' | 'load' | 'transform',
    T extends (...args: any[]) => any,
    C extends (
      this: import('rollup').PluginContext,
      result: Awaited<ReturnType<T>>
    ) => any = (
      this: import('rollup').PluginContext,
      result: Awaited<ReturnType<T>>
    ) => ReturnType<T>,
  >(
    hookName: H,
    hook: ObjectHook<T, HookFilterExtension<H>> | undefined,
    makeArgs: (
      this: import('rollup').PluginContext,
      ...args: Parameters<
        // @ts-expect-error
        NonNullable<HookHandler<import('rollup').PluginHooks[H]>>
      >
    ) => [
      import('rolldown').PluginContext,
      ...Parameters<NonNullable<HookHandler<import('rolldown').Plugin[H]>>>,
    ],
    cb: C = ((result) => result) as C
  ):
    | {
        order?: 'pre' | 'post' | null
        handler: (
          this: import('rollup').PluginContext,
          ...args: Parameters<
            // @ts-expect-error
            NonNullable<HookHandler<import('rollup').PluginHooks[H]>>
          >
        ) => Promise<Awaited<ReturnType<typeof cb>>>
      }
    | undefined => {
    if (!hook) return undefined
    const handler = getHookHandler(hook)
    const filter = getCachedFilterForPlugin(plugin, hookName)
    return {
      order:
        typeof hook === 'object' && hook != null && 'order' in hook
          ? hook.order
          : undefined,
      handler: async function (
        this: import('rollup').PluginContext,
        ...rawArgs: Parameters<typeof handler>
      ) {
        const args = makeArgs.call(this, ...rawArgs)
        // @ts-expect-error args should be an array
        if (filter && !filter(...args)) return
        const result = await handler.call(this, ...args)
        if (cb) return cb.call(this, result)
        return result
      } as typeof cb extends (...args: any[]) => any
        ? (
            this: import('rollup').PluginContext,
            ...args: Parameters<
              // @ts-expect-error
              NonNullable<HookHandler<import('rollup').PluginHooks[H]>>
            >
          ) => MaybePromise<ReturnType<typeof cb>>
        : NonNullable<HookHandler<import('rollup').PluginHooks[H]>>,
    }
  }

  return {
    ...plugin,
    name: plugin.name,

    options:
      plugin.options != null
        ? async function (inputOptions) {
            const handler = getHookHandler(plugin.options!)
            const result = await handler.bind(
              rolldownCompat.minimalPluginContextCompat(plugin, this)
            )(rolldownCompat.inputOptionsCompat(inputOptions))
            if (!result) return result
            return inputOptionsCompat(result)
          }
        : undefined,
    outputOptions:
      plugin.outputOptions != null
        ? function (options) {
            if (plugin.outputOptions == null) return null
            const handler = getHookHandler(plugin.outputOptions)
            const result = handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(rolldownCompat.outputOptionsCompat.bind(this)(options))
            if (!result) return result
            return outputOptionsCompat(result)
          }
        : plugin.outputOptions,

    banner: objectHookWithAddonHook(plugin.banner),
    footer: objectHookWithAddonHook(plugin.footer),
    intro: objectHookWithAddonHook(plugin.intro),
    outro: objectHookWithAddonHook(plugin.outro),

    resolveId: hookFilterExt(
      'resolveId',
      plugin.resolveId,
      function (source, importer, options) {
        return [
          rolldownCompat.pluginContextCompat(plugin, this),
          source,
          importer,
          {
            ...options,
            kind: 'import-statement',
          },
        ]
      }
    ),
    load: hookFilterExt(
      'load',
      plugin.load,
      function (id) {
        return [rolldownCompat.pluginContextCompat(plugin, this), id]
      },
      sourceDescriptionCompat
    ),
    transform: hookFilterExt(
      'transform',
      plugin.transform,
      function (code, id, options) {
        return [
          rolldownCompat.pluginContextCompat(plugin, this),
          code,
          id,
          {
            ...options,
            moduleType: path.extname(id).slice(1),
          },
        ]
      },
      (result) => sourceDescriptionCompat(result, true)
    ),
    augmentChunkHash:
      plugin.augmentChunkHash != null
        ? function (...args) {
            if (plugin.augmentChunkHash == null) return void 0
            const handler = getHookHandler(plugin.augmentChunkHash)
            return handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(...args)
          }
        : plugin.augmentChunkHash,

    renderChunk:
      plugin.renderChunk != null
        ? async function (code, chunk, normalizedOutputOptions, meta) {
            if (!plugin.renderChunk) return null
            const handler = getHookHandler(plugin.renderChunk)
            const result = await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(
              code,
              chunk,
              rolldownCompat.normalizedOutputOptionsCompat.bind(this)(
                normalizedOutputOptions
              ),
              meta
            )
            if (!result) return null
            return result instanceof BindingMagicString
              ? result.original
              : typeof result === 'object'
                ? {
                    code:
                      result.code instanceof BindingMagicString
                        ? result.code.original
                        : result.code,
                    map:
                      result.map != null
                        ? typeof result.map !== 'string'
                          ? {
                              ...result.map,
                              file: result.map.file ?? undefined,
                              names: result.map.names ?? [],
                              sources:
                                result.map.sources?.filter<string>(
                                  (n) => n != null
                                ) ?? [],
                              sourcesContent:
                                result.map.sourcesContent?.filter<string>(
                                  (n) => n != null
                                ) ?? [],
                              version: result.map.version ?? 3,
                            }
                          : result.map
                        : undefined,
                  }
                : result
          }
        : plugin.renderChunk,
    renderStart:
      plugin.renderStart != null
        ? async function (normalizedOutputOptions, normalizedInputOptions) {
            if (!plugin.renderStart) return
            const handler = getHookHandler(plugin.renderStart)
            return await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(
              rolldownCompat.normalizedOutputOptionsCompat.bind(this)(
                normalizedOutputOptions
              ),
              rolldownCompat.normalizedInputOptionsCompat.bind(this)(
                normalizedInputOptions
              )
            )
          }
        : plugin.renderStart,
    renderError:
      plugin.renderError != null
        ? async function (error) {
            if (error == null) return
            const handler = getHookHandler(plugin.renderError!)
            return await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(error)
          }
        : plugin.renderError,

    writeBundle:
      plugin.writeBundle != null
        ? async function (noramlizedOutputOptions, outputBundle) {
            const handler = getHookHandler(plugin.writeBundle!)
            return await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(
              rolldownCompat.normalizedOutputOptionsCompat.bind(this)(
                noramlizedOutputOptions
              ),
              rolldownCompat.outputBundleCompat(outputBundle)
            )
          }
        : plugin.writeBundle,
    generateBundle:
      plugin.generateBundle != null
        ? async function (normalizedOutputOptions, outputBundle, isWrite) {
            const handler = getHookHandler(plugin.generateBundle!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(
              rolldownCompat.normalizedOutputOptionsCompat.bind(this)(
                normalizedOutputOptions
              ),
              rolldownCompat.outputBundleCompat(outputBundle),
              isWrite
            )
          }
        : plugin.generateBundle,
    closeBundle:
      plugin.closeBundle != null
        ? async function () {
            const handler = getHookHandler(plugin.closeBundle!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )()
          }
        : plugin.closeBundle,

    buildStart:
      plugin.buildStart != null
        ? async function (normalizedInputOptions) {
            const handler = getHookHandler(plugin.buildStart!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(
              rolldownCompat.normalizedInputOptionsCompat.bind(this)(
                normalizedInputOptions
              )
            )
          }
        : plugin.buildStart,
    buildEnd:
      plugin.buildEnd != null
        ? async function () {
            const handler = getHookHandler(plugin.buildEnd!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )()
          }
        : plugin.buildEnd,

    watchChange:
      plugin.watchChange != null
        ? function (id, change) {
            const handler = getHookHandler(plugin.watchChange!)
            return handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(id, change)
          }
        : undefined,
    closeWatcher:
      plugin.closeWatcher != null
        ? async function () {
            const handler = getHookHandler(plugin.closeWatcher!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )()
          }
        : plugin.closeWatcher,

    moduleParsed:
      plugin.moduleParsed != null
        ? async function (moduleInfo) {
            const handler = getHookHandler(plugin.moduleParsed!)
            await handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(rolldownCompat.moduleInfoCompat(moduleInfo))
          }
        : undefined,

    resolveDynamicImport:
      plugin.resolveDynamicImport != null
        ? function (source, importer) {
            const handler = getHookHandler(plugin.resolveDynamicImport!)
            if (typeof source !== 'string') {
              console.warn(
                '[rollxxx] attempted to pass `source` that is not a string to resolveDynamicImport hook'
              )
              return
            }
            return handler.bind(
              rolldownCompat.pluginContextCompat(plugin, this)
            )(source, importer)
          }
        : undefined,

    onLog:
      plugin.onLog != null
        ? function (level, log) {
            const handler = getHookHandler(plugin.onLog!)
            return handler.bind(
              rolldownCompat.minimalPluginContextCompat(plugin, this)
            )(level, log)
          }
        : undefined,
  } satisfies import('rollup').Plugin
}

export function sourceDescriptionCompat<
  T extends NullValue | string,
  const U extends boolean = false,
>(
  value:
    | T
    | (U extends true
        ? Omit<import('rolldown').SourceDescription, 'code'> & {
            code?: string | BindingMagicString
          }
        : import('rolldown').SourceDescription),
  magicStringCode: U = false as U
):
  | T
  | (U extends true
      ? Omit<import('rollup').SourceDescription, 'code'> & {
          code?: string
        }
      : import('rollup').SourceDescription) {
  return value != null && typeof value === 'object'
    ? {
        code: magicStringCode
          ? (value.code as unknown as string | BindingMagicString) instanceof
            BindingMagicString
            ? (value.code as unknown as BindingMagicString).original
            : (value.code as string)
          : (value.code! as string),
        map:
          value.map != null
            ? typeof value.map !== 'string'
              ? {
                  ...value.map,
                  file: value.map.file ?? undefined,
                  names: value.map.names ?? [],
                  sources:
                    (value.map.sources?.filter(Boolean) as string[]) ?? [],
                  sourcesContent:
                    (value.map.sourcesContent?.filter(Boolean) as string[]) ??
                    [],
                  version: value.map.version ?? 3,
                }
              : value.map
            : undefined,
      }
    : value
}

function inputOptionsCompat<T extends import('rolldown').InputOptions>(
  inputOptions: T
): import('rollup').InputOptions {
  return {
    ...inputOptions,
    plugins:
      inputOptions.plugins != null
        ? pluginsCompat<import('rolldown').RolldownPlugin>(inputOptions.plugins)
        : undefined,
    treeshake:
      inputOptions.treeshake != null &&
      typeof inputOptions.treeshake === 'object'
        ? {
            ...(inputOptions.treeshake as DeepMutable<
              typeof inputOptions.treeshake
            >),
            moduleSideEffects:
              inputOptions.treeshake.moduleSideEffects != null &&
              typeof inputOptions.treeshake.moduleSideEffects === 'function'
                ? (
                    (fn: typeof inputOptions.treeshake.moduleSideEffects) =>
                    (...args) =>
                      fn(...args) ?? false
                  )(inputOptions.treeshake.moduleSideEffects)
                : Array.isArray(inputOptions.treeshake.moduleSideEffects) &&
                    inputOptions.treeshake.moduleSideEffects.length > 0 &&
                    typeof inputOptions.treeshake.moduleSideEffects[0] ===
                      'object'
                  ? (
                      (
                        moduleSifeEffects: typeof inputOptions.treeshake.moduleSideEffects
                      ) =>
                      (id, external) => {
                        const rule = moduleSifeEffects.find(
                          (rule) => rule.test?.test(id) ?? false
                        )
                        return rule?.sideEffects ?? rule?.external ?? external
                      }
                    )(inputOptions.treeshake.moduleSideEffects)
                  : (inputOptions.treeshake.moduleSideEffects as
                      | boolean
                      | string[]
                      | 'no-external'
                      | undefined),
            propertyReadSideEffects:
              inputOptions.treeshake.propertyReadSideEffects ?? undefined,
          }
        : inputOptions.treeshake,
  }
}

function outputOptionsCompat<T extends import('rolldown').OutputOptions>(
  outputOptions: T
): import('rollup').OutputOptions {
  return {
    ...outputOptions,
    assetFileNames:
      typeof outputOptions.assetFileNames === 'function'
        ? function (chunkInfo: import('rollup').PreRenderedAsset) {
            return (
              (
                outputOptions.assetFileNames as (
                  chunkInfo: import('rolldown').PreRenderedAsset
                ) => string
              )({
                ...chunkInfo,
                originalFileName: chunkInfo.originalFileName ?? undefined,
                name: undefined,
              }) ?? null
            )
          }
        : outputOptions.assetFileNames,
    chunkFileNames:
      typeof outputOptions.chunkFileNames === 'function'
        ? function (chunkInfo) {
            return (
              outputOptions.chunkFileNames as (
                chunkInfo: import('rolldown').PreRenderedChunk
              ) => string
            )({
              ...chunkInfo,
              facadeModuleId: chunkInfo.facadeModuleId ?? undefined,
            })
          }
        : outputOptions.chunkFileNames,
    entryFileNames:
      typeof outputOptions.entryFileNames === 'function'
        ? function (chunkInfo) {
            return (
              outputOptions.entryFileNames as (
                chunkInfo: import('rolldown').PreRenderedChunk
              ) => string
            )({
              ...chunkInfo,
              facadeModuleId: chunkInfo.facadeModuleId ?? undefined,
            })
          }
        : outputOptions.entryFileNames,
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
                outputOptions.manualChunks as (
                  moduleId: string,
                  meta: {
                    getModuleInfo: (moduleId: string) => ModuleInfo | null
                  }
                ) => string | NullValue
              )(moduleId, {
                getModuleInfo(...args) {
                  const result = meta.getModuleInfo(...args)
                  if (!result) return null
                  return {
                    ...(result as DeepMutable<typeof result>),
                    exports: result.exports ?? [],
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
                    inputFormat: 'unknown',
                  }
                },
              })
            }
          : outputOptions.manualChunks,
    hoistTransitiveImports: outputOptions.hoistTransitiveImports
      ? undefined
      : false,
    plugins:
      outputOptions.plugins != null
        ? pluginsCompat(flatten(arraify(outputOptions.plugins)))
        : undefined,
    sourcemapIgnoreList:
      typeof outputOptions.sourcemapIgnoreList === 'string' ||
      outputOptions.sourcemapIgnoreList instanceof RegExp
        ? (source) =>
            typeof outputOptions.sourcemapIgnoreList === 'string'
              ? source === outputOptions.sourcemapIgnoreList
              : (outputOptions.sourcemapIgnoreList as RegExp).test(source)
        : outputOptions.sourcemapIgnoreList,
    strict: outputOptions.strict === 'auto' ? false : outputOptions.strict,
  } satisfies import('rollup').OutputOptions
}

function addonHookCompat<
  const T extends ObjectHook<import('rolldown').AddonFunction>,
>(
  hook?: T
): import('rollup').ObjectHook<import('rollup').AddonHook> | undefined {
  return hook != null &&
    (typeof hook === 'object' || typeof hook === 'function')
    ? {
        handler: addonFunctionCompat(
          typeof hook === 'object' ? hook.handler : hook
        ),
        order: typeof hook === 'object' ? hook.order : null,
      }
    : hook
}

function addonFunctionCompat<const T extends import('rolldown').AddonFunction>(
  fn?: T
): import('rollup').AddonFunction {
  return fn != null && typeof fn === 'function'
    ? ((async (chunk: import('rollup').RenderedChunk) => {
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
      }) as import('rollup').AddonFunction)
    : (fn as any)
}
