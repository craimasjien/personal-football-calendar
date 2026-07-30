import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Deliberately neither Europe/Amsterdam nor a negative-offset zone. Non-Amsterdam
    // proves the wall-clock conversion is real; positive-offset catches all-day dates
    // slipping to the previous day, which a negative-offset zone silently hides.
    env: { TZ: 'Asia/Tokyo' },
  },
})
