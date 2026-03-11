import {
  type PluginFilter,
  type TransformHookFilter,
  createFilterForTransform,
  createIdFilter,
} from './filter'
import type { ObjectHook } from 'rolldown'
import { interpreterImpl } from '@rolldown/pluginutils'

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
