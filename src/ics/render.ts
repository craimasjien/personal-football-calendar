import ical, { ICalCalendarMethod } from 'ical-generator'
import type { CalendarEntry } from '../domain.ts'
import { describe, summary } from './dutch.ts'

const TIMEZONE = 'Europe/Amsterdam'
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000

/**
 * Format an instant as Amsterdam wall-clock time, floating (no zone suffix).
 *
 * ical-generator has no timezone database: given a Date plus a `timezone`, it writes the
 * TZID parameter but formats the value from system-local components. So we do the zone
 * conversion here with Intl (which does have the tzdb) and hand the library a floating
 * value it merely labels. Parse-as-local then read-local is the identity, making this
 * correct regardless of the process timezone — including UTC in CI.
 */
function amsterdamWallClock(utc: Date): string {
  // sv-SE renders as "YYYY-MM-DD HH:mm:ss"; ICS wants a 'T' separator.
  // hourCycle 'h23' avoids the "24:00" that hour12:false yields in some ICU builds.
  const formatted = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(utc)
  return formatted.replace(' ', 'T')
}

/**
 * Build the ICS document.
 *
 * Deliberately emits no VALARM: a subscribed feed that fires notifications on
 * someone else's phone for a match they are not watching makes the whole
 * calendar unwelcome.
 */
export function render(
  entries: CalendarEntry[],
  displayNames: Record<string, string>,
): string {
  const calendar = ical({
    name: 'Voetbal',
    description: 'Wedstrijden die ik wil kijken',
    prodId: { company: 'personal', product: 'football-calendar', language: 'NL' },
  })
  calendar.method(ICalCalendarMethod.PUBLISH)

  for (const entry of entries) {
    const { fixture } = entry

    const timing =
      fixture.kickoff.kind === 'confirmed'
        ? {
            start: amsterdamWallClock(fixture.kickoff.utc),
            end: amsterdamWallClock(new Date(fixture.kickoff.utc.getTime() + MATCH_DURATION_MS)),
            timezone: TIMEZONE,
            allDay: false,
          }
        : // Bare 'YYYY-MM-DD' deliberately. ical-generator formats an all-day date from UTC
          // components, so a floating '...T00:00:00' would parse as local midnight and land on
          // the previous day in any positive-offset zone — including Europe/Amsterdam itself.
          { start: fixture.kickoff.date, allDay: true }

    const event = calendar.createEvent({
      // Stability of this UID is what makes a postponed match move on the
      // phones instead of appearing twice. It depends only on the provider's
      // event id — never on the kickoff time or the inclusion.
      id: `fixture-${fixture.id}@football-calendar`,
      summary: summary(entry, displayNames),
      description: describe(fixture),
      ...timing,
    })

    if (fixture.venue) {
      event.location(`${fixture.venue.name}, ${fixture.venue.city}`)
    }
  }

  return calendar.toString()
}
