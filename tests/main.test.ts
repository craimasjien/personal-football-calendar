import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

describe('src/main.ts', () => {
  it('has no import side effects, so it never builds or writes on import', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('../src/main.ts')
    expect(typeof mod.run).toBe('function')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(existsSync('dist')).toBe(false)
    vi.unstubAllGlobals()
  })
})
