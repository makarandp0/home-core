// Intentionally uses `as` to demonstrate the lint rule banning TS `as` assertions
const value: unknown = 21;
// This `as` assertion should be flagged by the `TSAsExpression` enforcement in eslint.config.js
// eslint-disable-next-line no-restricted-syntax -- expected lint violation for demonstration
const num = value as number;
export const doubled = num * 2;

console.log('doubled:', doubled);
