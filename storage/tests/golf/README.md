# Golf Tests

Test suite for golf-specific storage functionality.

## Files

- **`test-web.ts`** - Web-compatible test that can be run in a browser. Exports `runGolfTest()` function.
- **`index.ts`** - Barrel export for easy imports.

## Usage

### Web (React Native/Expo)
```typescript
import { runGolfTest } from '../storage/tests/golf';

await runGolfTest((message, type) => {
  console.log(message);
});
```

### Node.js
```bash
npm run db:test
# or
npx tsx storage/tests/golf/test-web.ts
```

## Test Coverage

The golf test suite covers:
1. Database setup with sqlite-web adapter
2. Creating players (participants)
3. Creating golf courses (venues with event formats)
4. Creating golf rounds (events)
5. Adding scores to holes
6. Verifying data integrity

