import { describe, expect, test } from 'vitest'
import * as astUtils from '../../src/ast/utils'

// Minimal node types for the tests
interface BaseNode {
  type: string
  start: number
  end: number
}
interface IdentifierNode extends BaseNode {
  type: 'Identifier'
  name: string
}
interface LiteralNode extends BaseNode {
  type: 'Literal'
  value: any
}
// Restrict kind to allowed values
interface PropertyNode extends BaseNode {
  type: 'Property'
  kind: 'init' | 'get' | 'set'
  key: IdentifierNode | LiteralNode
  value: any
  method: boolean
  shorthand: boolean
  computed: boolean
}
interface SpreadElementNode extends BaseNode {
  type: 'SpreadElement'
  argument: any
}
interface ObjectExpressionNode extends BaseNode {
  type: 'ObjectExpression'
  properties: (PropertyNode | SpreadElementNode)[]
}
interface ArrayExpressionNode extends BaseNode {
  type: 'ArrayExpression'
  elements: (LiteralNode | SpreadElementNode)[]
}

describe('ast/utils', () => {
  const identifier = (name: string): IdentifierNode => ({
    type: 'Identifier',
    name,
    start: 0,
    end: 0,
  })
  const literal = (value: any): LiteralNode => ({
    type: 'Literal',
    value,
    start: 0,
    end: 0,
  })
  const property = (
    kind: 'init' | 'get' | 'set',
    key: IdentifierNode | LiteralNode,
    value: any
  ): PropertyNode => ({
    type: 'Property',
    kind,
    key,
    value,
    method: false,
    shorthand: false,
    computed: false,
    start: 0,
    end: 0,
  })
  const spreadElement = (): SpreadElementNode => ({
    type: 'SpreadElement',
    argument: null,
    start: 0,
    end: 0,
  })

  test('exprToJson handles literals', () => {
    expect(astUtils.exprToJson(literal(123))).toBe(123)
    expect(astUtils.exprToJson(literal('abc'))).toBe('abc')
  })

  test('exprToJson handles object expressions', () => {
    const expr: ObjectExpressionNode = {
      type: 'ObjectExpression',
      properties: [
        property('init', identifier('foo'), literal(1)),
        property('init', identifier('bar'), literal(2)),
      ],
      start: 0,
      end: 0,
    }
    expect(astUtils.exprToJson(expr)).toEqual({ foo: 1, bar: 2 })
  })

  test('exprToJson handles array expressions', () => {
    const expr: ArrayExpressionNode = {
      type: 'ArrayExpression',
      elements: [literal(1), literal(2)],
      start: 0,
      end: 0,
    }
    expect(astUtils.exprToJson(expr)).toEqual([1, 2])
  })

  test('exprToJson throws on spread in array', () => {
    const expr: ArrayExpressionNode = {
      type: 'ArrayExpression',
      elements: [spreadElement()],
      start: 0,
      end: 0,
    }
    expect(() => astUtils.exprToJson(expr)).toThrow('Unexpected spread')
  })

  test('exprToJson throws on non-literal', () => {
    expect(() => astUtils.exprToJson(identifier('foo'))).toThrow()
  })

  test('objectLitToJson throws on spread', () => {
    const expr: ObjectExpressionNode = {
      type: 'ObjectExpression',
      properties: [spreadElement()],
      start: 0,
      end: 0,
    }
    expect(() => astUtils.exprToJson(expr)).toThrow('Unexpected spread')
  })

  test('objectLitToJson throws on non-init property', () => {
    const expr: ObjectExpressionNode = {
      type: 'ObjectExpression',
      properties: [property('get', identifier('foo'), literal(1))],
      start: 0,
      end: 0,
    }
    expect(() => astUtils.exprToJson(expr)).toThrow('Unexpected key')
  })

  test('objectLitToJson throws on non-Identifier key', () => {
    const expr: ObjectExpressionNode = {
      type: 'ObjectExpression',
      properties: [property('init', literal('foo'), literal(1))],
      start: 0,
      end: 0,
    }
    expect(() => astUtils.exprToJson(expr)).toThrow('Unexpected object key type')
  })
})
