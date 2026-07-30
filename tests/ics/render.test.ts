import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Fixture } from '../../src/domain.ts'
import { render } from '../../src/ics/render.ts'

function confirmed(iso: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: '401875655',
    competition: 'eredivisie',
    stage: 'regular-season',
    leg: null,
    home: { id: 139, name: 'Ajax Amsterdam' },
    away: { id: 142, name: 'Feyenoord Rotterdam' },
    venue: { name: 'Johan Cruijff ArenA', city: 'Amsterdam' },
    kickoff: { kind: 'confirmed', utc: new Date(iso) },
    ...overrides,
  }
}

const entry = (f: Fixture, inclusion: 'required' | 'optional' = 'required'): CalendarEntry => ({
  fixture: f,
  inclusion,
})

/** ICS folds long lines; unfold before asserting on content. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '')
}

describe('render', () => {
  it('produces a valid calendar envelope', () => {
    const ics = render([entry(confirmed('2026-03-15T13:30:00Z'))], {})
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
  })

  it('writes winter kickoffs in Amsterdam local time (CET, +1)', () => {
    // 13:30 UTC on 15 March 2026 is 14:30 in Amsterdam — DST starts 29 March.
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20260315T143000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20260315T163000')
  })

  it('writes summer kickoffs in Amsterdam local time (CEST, +2)', () => {
    // 17:00 UTC on 10 May 2026 is 19:00 in Amsterdam.
    const ics = unfold(render([entry(confirmed('2026-05-10T17:00:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20260510T190000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20260510T210000')
  })

  it('runs in a resolved, non-Amsterdam zone, so the conversions below are genuinely exercised', () => {
    // Must not pass merely because TZ is unset: on an Amsterdam machine, unset IS Amsterdam.
    expect(process.env.TZ).toBeDefined()
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe('Europe/Amsterdam')
  })

  it('makes a confirmed event exactly two hours long', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20260315T143000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20260315T163000')
  })

  it('keeps an event across the October fall-back two real hours long', () => {
    // 2026-10-25 00:30Z is 02:30 CEST; +2h real time is 03:30 CET, not 04:30.
    const ics = unfold(render([entry(confirmed('2026-10-25T00:30:00Z'))], {}))
    expect(ics).toContain('DTSTART;TZID=Europe/Amsterdam:20261025T023000')
    expect(ics).toContain('DTEND;TZID=Europe/Amsterdam:20261025T033000')
  })

  it('writes DTSTAMP in UTC with a Z suffix, as RFC 5545 requires', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/)
  })

  it('renders a provisional kickoff as an all-day event on that date', () => {
    const f = confirmed('2026-04-18T12:00:00Z', {
      kickoff: { kind: 'provisional', date: '2026-04-18' },
    })
    const ics = unfold(render([entry(f)], {}))
    expect(ics).toContain('DTSTART;VALUE=DATE:20260418')
    expect(ics).not.toContain('DTSTART;TZID=Europe/Amsterdam:20260418')
  })

  it('renders the all-day date from the fixture date, not the process timezone', () => {
    const f = confirmed('2026-04-18T00:00:00Z', {
      kickoff: { kind: 'provisional', date: '2026-04-18' },
    })
    const ics = unfold(render([entry(f)], {}))
    // Must be 18 April in every process timezone. A floating local-midnight start
    // would emit 20260417 wherever the offset is positive.
    expect(ics).toContain('DTSTART;VALUE=DATE:20260418')
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260417')
  })

  it('uses a stable UID derived from the provider event id', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('UID:fixture-401875655@football-calendar')
  })

  it('produces the same UID across separate renders, so events move rather than duplicate', () => {
    const a = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    const b = unfold(render([entry(confirmed('2026-03-22T18:45:00Z'))], {}))
    const uid = (ics: string) => /UID:(.+)/.exec(ics)![1].trim()
    expect(uid(a)).toBe(uid(b))
  })

  it('keeps the UID stable when a fixture becomes provisional', () => {
    const timed = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    const allDay = unfold(
      render(
        [entry(confirmed('2026-03-15T13:30:00Z', {
          kickoff: { kind: 'provisional', date: '2026-03-15' },
        }))],
        {},
      ),
    )
    const uid = (ics: string) => /UID:(.+)/.exec(ics)![1].trim()
    expect(uid(timed)).toBe(uid(allDay))
  })

  it('prefixes optional entries and applies display names', () => {
    const ics = unfold(
      render([entry(confirmed('2026-03-15T13:30:00Z'), 'optional')], {
        'Ajax Amsterdam': 'AFC Ajax',
        'Feyenoord Rotterdam': 'Feyenoord',
      }),
    )
    expect(ics).toContain('SUMMARY:Optioneel: AFC Ajax vs. Feyenoord')
  })

  it('writes the venue as name, city', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('LOCATION:Johan Cruijff ArenA')
    expect(ics).toContain('Amsterdam')
  })

  it('omits the location entirely when the venue is unknown', () => {
    const f = confirmed('2026-03-15T13:30:00Z', { venue: null })
    const ics = unfold(render([entry(f)], {}))
    expect(ics).not.toContain('LOCATION:')
  })

  it('writes the Dutch description', () => {
    const ics = unfold(render([entry(confirmed('2026-03-15T13:30:00Z'))], {}))
    expect(ics).toContain('DESCRIPTION:Eredivisie')
  })

  it('never emits alarms', () => {
    const ics = render([entry(confirmed('2026-03-15T13:30:00Z'))], {})
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  it('renders an empty calendar without throwing', () => {
    const ics = render([], {})
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('renders one VEVENT per entry', () => {
    const entries = [
      entry(confirmed('2026-03-15T13:30:00Z')),
      entry(confirmed('2026-03-22T18:45:00Z', { id: '401875656' })),
    ]
    const ics = render(entries, {})
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
  })
})
