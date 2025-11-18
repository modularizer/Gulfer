# filters

Filter system for querying and evaluating data. Provides a structured way to build complex query conditions that can be evaluated against entities.

The filter system supports a wide range of operators including equality, comparison, string matching, and logical operations (AND, OR, NOT). Filters can be nested to create complex query conditions. The evaluator can match entities against these conditions, making it useful for in-memory filtering or as a query builder foundation.

## Usage

```typescript
import { eq, and, or, gt, contains } from './filters';
import { evaluateCondition } from './filters';

// Build filter conditions
const filter = and(
  eq('status', 'active'),
  or(
    gt('age', 18),
    contains('tags', 'vip')
  )
);

// Evaluate against an entity
const matches = evaluateCondition({ status: 'active', age: 25, tags: ['vip'] }, filter);
// Returns: true
```
