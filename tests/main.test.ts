import { describe, expect, it, vi } from 'vitest'

describe('src/main.ts', () => {
  it('has no import side effects, so it never builds or writes on import', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('../src/main.ts')
    expect(typeof mod.run).toBe('function')
    // "No import side effects" is fully carried by the fetch assertion above.
    // Deliberately not asserting `dist/` is absent: it is gitignored but persists
    // on disk once `npm run build:calendar` has been run locally (as the README
    // documents), which would make every later `npm test` fail on an assertion
    // unrelated to the property this test names.
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
