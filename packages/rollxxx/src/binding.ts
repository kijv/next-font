import type { StringOrRegExp } from './declaration'

export interface BindingHookFilter {
  value?: Array<Array<BindingFilterToken>>
}

export interface BindingFilterToken {
  kind: FilterTokenKind
  payload?: StringOrRegExp | number | boolean
}

export type FilterTokenKind =
  | 'Id'
  | 'ImporterId'
  | 'Code'
  | 'ModuleType'
  | 'And'
  | 'Or'
  | 'Not'
  | 'Include'
  | 'Exclude'
  | 'CleanUrl'
  | 'QueryKey'
  | 'QueryValue'
