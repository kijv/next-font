import type { HookFilterExtension, ObjectHook } from 'rolldown'
import {
  type PluginFilter,
  type TransformHookFilter,
  createFilterForTransform,
  createIdFilter,
} from './filter'
import type { MaybePromise } from './declaration'
import { interpreterImpl } from '@rolldown/pluginutils'

export const hookFilterExt = <
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
  plugin: import('rolldown').Plugin,
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
  return Object.assign(
    typeof hook === 'object' && hook != null && 'order' in hook
      ? {
          order:
            typeof hook === 'object' && hook != null && 'order' in hook
              ? hook.order
              : undefined,
        }
      : {},
    {
      handler: async function (
        this: import('rollup').PluginContext,
        ...rawArgs: Parameters<typeof handler>
      ) {
        const [rolldownThis, ...args] = makeArgs.call(this, ...rawArgs)
        // @ts-expect-error args should be an array
        if (filter && !filter(...args)) return
        const result = cb.call(this, await handler.call(rolldownThis, ...args))
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
  )
}

export type HookHandler<T> = T extends ObjectHook<infer H> ? H : T

export function getHookHandler<const T>(hook: ObjectHook<T>): HookHandler<T> {
  return (
    typeof hook === 'object' &&
    hook != null &&
    'handler' in hook &&
    hook.handler
      ? hook.handler
      : hook
  ) as HookHandler<T>
}

export function extractFilter<const T, F>(
  hook: ObjectHook<T, { filter?: F }> | undefined
): F | undefined {
  return typeof hook === 'object' &&
    hook != null &&
    'filter' in hook &&
    hook.filter
    ? hook.filter
    : undefined
}

type FilterForPluginValue = {
  resolveId?: PluginFilter | undefined
  load?: PluginFilter | undefined
  transform?: TransformHookFilter | undefined
}
const filterForPlugin = new WeakMap<
  import('rolldown').Plugin,
  FilterForPluginValue
>()

export function getCachedFilterForPlugin<
  H extends 'resolveId' | 'load' | 'transform',
>(
  plugin: import('rolldown').Plugin,
  hookName: H
): FilterForPluginValue[H] | undefined {
  let filters = filterForPlugin.get(plugin)
  if (filters && hookName in filters) {
    return filters[hookName]
  }

  if (!filters) {
    filters = {}
    filterForPlugin.set(plugin, filters)
  }

  let filter: PluginFilter | TransformHookFilter | undefined
  switch (hookName) {
    case 'resolveId': {
      const rawFilter = extractFilter(plugin.resolveId)
      filters.resolveId = Array.isArray(rawFilter)
        ? (...args: Parameters<PluginFilter>) =>
            interpreterImpl(rawFilter, undefined, ...args)
        : createIdFilter(rawFilter?.id)
      filter = filters.resolveId
      break
    }
    case 'load': {
      const rawFilter = extractFilter(plugin.load)
      filters.load = Array.isArray(rawFilter)
        ? (...args: Parameters<PluginFilter>) =>
            interpreterImpl(rawFilter, undefined, ...args)
        : createIdFilter(rawFilter?.id)
      filter = filters.load
      break
    }
    case 'transform': {
      const rawFilters = extractFilter(plugin.transform)
      filters.transform = Array.isArray(rawFilters)
        ? (...args: Parameters<TransformHookFilter>) =>
            interpreterImpl(rawFilters, undefined, ...args)
        : createFilterForTransform(
            rawFilters?.id,
            rawFilters?.code,
            rawFilters?.moduleType
          )
      filter = filters.transform
      break
    }
  }
  return filter as FilterForPluginValue[H] | undefined
}
