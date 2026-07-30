import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      // Default to a deliberately wrong zone so a bare `npm test` still proves the
      // Amsterdam conversions are real: non-Amsterdam (so wall-clock conversion is
      // exercised) and positive-offset (so all-day dates slipping to the previous
      // day cannot hide, which a negative-offset zone would mask).
      //
      // Falls through to an explicit shell TZ so `npm run test:zones` genuinely
      // sweeps zones. Setting env.TZ unconditionally overrides the shell and makes
      // that loop a no-op — which is what it used to do.
      TZ: process.env.TZ ?? 'Asia/Tokyo',
    },
  },
})
