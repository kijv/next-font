import type * as acorn from 'acorn';

export const exprToJson = (expr: acorn.Expression): any => {
  switch (expr.type) {
    case 'Literal':
      return expr.value;
    case 'ObjectExpression':
      return objectLitToJson(expr);
    case 'ArrayExpression': {
      const elements = expr.elements.map((e) => {
        if (e) {
          if (e.type === 'SpreadElement') throw new Error('Unexpected spread');
          return exprToJson(e);
        } else {
          throw new Error('Unexpected empty value in array');
        }
      });

      return elements;
    }
    default:
      throw new Error(
        'Font loader values must be explicitly written literals.',
      );
  }
};

const objectLitToJson = (objectLit: acorn.ObjectExpression): any => {
  const values: Record<string, any> = {};

  for (const prop of objectLit.properties) {
    if (prop.type === 'SpreadElement') throw new Error('Unexpected spread');

    if (prop.kind !== 'init') throw new Error('Unexpected key');

    if (prop.key.type !== 'Identifier')
      throw new Error('Unexpected object key type');

    values[prop.key.name] = exprToJson(prop.value);
  }

  return values;
};
