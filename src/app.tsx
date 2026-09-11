import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

type Route = 'checkin' | 'done' | 'feedback' | 'details' | 'thanks'

type CheckInRecord = {
  checkinId: string
  name: string
  batch: string
  phoneNumber: string
  checkinTimestamp: string
}

type SuggestionResponse = {
  names: string[]
  batches: string[]
  nameBatchPairs?: Array<{ name: string; batch: string }>
}

type AutocompleteFieldProps = {
  id: string
  label: string
  placeholder: string
  value: string
  suggestions: string[]
  onValueChange: (value: string) => void
  onSuggestionSelect?: (value: string) => void
}

const STORAGE_KEY = 'exxcheckin.record'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const USE_MOCK_API =
  (import.meta.env.VITE_USE_MOCK_API ?? 'false').trim().toLowerCase() === 'true' ||
  API_BASE_URL.length === 0
const EVENT_TITLE_TOP = 'Peradeniya'
const EVENT_TITLE_MAIN = 'E-XX Reunion'
const EVENT_TITLE_BOTTOM = 'Melbourne 2026'
const EVENT_DATE = '12 September 2026'
const EVENT_TIME = '6:30 PM to Midnight'
const EVENT_LOCATION = 'Whitehouse, 247 Princes Hwy, Dandenong VIC 3175'
const NON_ALUMNI_BATCH_VALUE = 'N/A'
const SWIPE_EDGE_THRESHOLD_PX = 28
const SWIPE_OPEN_DISTANCE_PX = 52

function nowIso(): string {
  return new Date().toISOString()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function getRouteFromHash(): Route {
  const normalized = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (normalized === 'done') return 'done'
  if (normalized === 'feedback') return 'feedback'
  if (normalized === 'details') return 'details'
  if (normalized === 'thanks') return 'thanks'
  return 'checkin'
}

function navigate(route: Route): void {
  const hash = route === 'checkin' ? '#/' : `#/${route}`
  if (window.location.hash !== hash) {
    window.location.hash = hash
  }
}

function loadRecord(): CheckInRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CheckInRecord>
    if (!parsed.checkinId || !parsed.name || !parsed.batch || !parsed.checkinTimestamp) {
      return null
    }
    return {
      checkinId: parsed.checkinId,
      name: parsed.name,
      batch: parsed.batch,
      phoneNumber: parsed.phoneNumber ?? '',
      checkinTimestamp: parsed.checkinTimestamp,
    }
  } catch {
    return null
  }
}

function saveRecord(record: CheckInRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

function clearRecord(): void {
  localStorage.removeItem(STORAGE_KEY)
}

function generateCheckinId(): string {
  if (crypto && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `chk_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function requestSuggestions(): Promise<SuggestionResponse> {
  if (USE_MOCK_API) {
    return {
      names: ['Alex', 'Jordan', 'Taylor', 'Sam'],
      batches: ['2022', '2023', '2024', '2025'],
      nameBatchPairs: [
        { name: 'Alex', batch: '2022' },
        { name: 'Jordan', batch: '2023' },
        { name: 'Taylor', batch: '2024' },
        { name: 'Sam', batch: '2025' },
      ],
    }
  }

  const response = await fetch(`${API_BASE_URL}?action=suggestions`, {
    method: 'GET',
  })
  if (!response.ok) {
    throw new Error('Unable to load suggestions')
  }
  return (await response.json()) as SuggestionResponse
}

async function submitCheckIn(payload: CheckInRecord): Promise<{ serverTimestamp: string }> {
  if (USE_MOCK_API) {
    return { serverTimestamp: nowIso() }
  }

  const requestBody = new URLSearchParams({
    action: 'checkin',
    checkinId: payload.checkinId,
    name: payload.name,
    batch: payload.batch,
    phoneNumber: payload.phoneNumber,
    phone: payload.phoneNumber,
    phone_number: payload.phoneNumber,
    checkinTimestamp: payload.checkinTimestamp,
    clientTimestamp: nowIso(),
  })

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    body: requestBody,
  })
  if (!response.ok) {
    throw new Error('Check-in failed')
  }
  return (await response.json()) as { serverTimestamp: string }
}

async function submitFeedback(checkinId: string, feedback: string, phoneNumber: string): Promise<void> {
  if (USE_MOCK_API) {
    return
  }

  const requestBody = new URLSearchParams({
    action: 'feedback',
    checkinId,
    feedback,
    phoneNumber,
    phone: phoneNumber,
    phone_number: phoneNumber,
    clientTimestamp: nowIso(),
  })

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    body: requestBody,
  })
  if (!response.ok) {
    throw new Error('Feedback submission failed')
  }
}

function filterSuggestions(suggestions: string[], value: string): string[] {
  const query = value.trim().toLowerCase()
  if (!query) {
    return suggestions.slice(0, 8)
  }

  return suggestions
    .filter((item) => item.toLowerCase().includes(query))
    .slice(0, 8)
}

function sortSuggestions(suggestions: string[]): string[] {
  return [...suggestions].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
  )
}

function withDefaultBatchOption(suggestions: string[]): string[] {
  const hasDefault = suggestions.some(
    (item) => normalizeSuggestion(item) === normalizeSuggestion(NON_ALUMNI_BATCH_VALUE),
  )

  if (hasDefault) {
    return suggestions
  }

  return [...suggestions, NON_ALUMNI_BATCH_VALUE]
}

function normalizeSuggestion(value: string): string {
  return value.trim().toLowerCase()
}

function AutocompleteField({
  id,
  label,
  placeholder,
  value,
  suggestions,
  onValueChange,
  onSuggestionSelect,
}: AutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const filteredSuggestions = useMemo(
    () => filterSuggestions(suggestions, value),
    [suggestions, value],
  )

  const showSuggestions = isOpen && filteredSuggestions.length > 0

  return (
    <div class="autocomplete-field">
      <label for={id}>{label}</label>
      <div class="autocomplete-shell">
        <input
          id={id}
          name={id}
          value={value}
          onInput={(event) => {
            onValueChange((event.target as HTMLInputElement).value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 100)}
          placeholder={placeholder}
          autoComplete="off"
          required
        />

        {showSuggestions && (
          <div class="autocomplete-menu" role="listbox" aria-label={`${label} suggestions`}>
            {filteredSuggestions.map((item) => (
              <button
                type="button"
                class="autocomplete-option"
                key={`${id}-${item}`}
                onMouseDown={() => {
                  onValueChange(item)
                  onSuggestionSelect?.(item)
                  setIsOpen(false)
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash())
  const [record, setRecord] = useState<CheckInRecord | null>(() => loadRecord())
  const [name, setName] = useState(record?.name ?? '')
  const [batch, setBatch] = useState(record?.batch ?? '')
  const [phoneNumber, setPhoneNumber] = useState(record?.phoneNumber ?? '')
  const [liveTimestamp, setLiveTimestamp] = useState(nowIso())
  const [feedbackText, setFeedbackText] = useState('')

  const [names, setNames] = useState<string[]>([])
  const [batches, setBatches] = useState<string[]>([])
  const [nameToBatch, setNameToBatch] = useState<Record<string, string>>({})

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [isSwipeMenuOpen, setIsSwipeMenuOpen] = useState(false)
  const [confirmClearArmed, setConfirmClearArmed] = useState(false)

  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  const isEdgeSwipeCandidateRef = useRef(false)

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setLiveTimestamp(nowIso()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    requestSuggestions()
      .then((data) => {
        setNames(sortSuggestions(data.names ?? []))
        setBatches(sortSuggestions(withDefaultBatchOption(data.batches ?? [])))

        const mapping = (data.nameBatchPairs ?? []).reduce<Record<string, string>>((accumulator, pair) => {
          if (pair.name && pair.batch) {
            accumulator[normalizeSuggestion(pair.name)] = pair.batch
          }
          return accumulator
        }, {})

        setNameToBatch(mapping)
      })
      .catch(() => {
        setError('Could not load suggestions. You can still type manually.')
      })
  }, [])

  useEffect(() => {
    const matchedBatch = nameToBatch[normalizeSuggestion(name)]
    if (matchedBatch && matchedBatch !== batch) {
      setBatch(matchedBatch)
    }
  }, [name, batch, nameToBatch])

  useEffect(() => {
    if (route === 'checkin' && record) {
      navigate('feedback')
      setRoute('feedback')
    }
  }, [route, record])

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isSwipeMenuOpen) {
        isEdgeSwipeCandidateRef.current = false
        return
      }

      const touch = event.touches[0]
      touchStartXRef.current = touch.clientX
      touchStartYRef.current = touch.clientY
      isEdgeSwipeCandidateRef.current = touch.clientX >= window.innerWidth - SWIPE_EDGE_THRESHOLD_PX
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!isEdgeSwipeCandidateRef.current || event.touches.length !== 1) {
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - touchStartXRef.current
      const deltaY = touch.clientY - touchStartYRef.current
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.2

      if (deltaX <= -SWIPE_OPEN_DISTANCE_PX && isHorizontalSwipe) {
        setIsSwipeMenuOpen(true)
        isEdgeSwipeCandidateRef.current = false
      }
    }

    const onTouchEnd = () => {
      isEdgeSwipeCandidateRef.current = false
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isSwipeMenuOpen])

  useEffect(() => {
    if (!isSwipeMenuOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSwipeMenuOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSwipeMenuOpen])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (isSwipeMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      setConfirmClearArmed(false)
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isSwipeMenuOpen])

  const handleMenuNavigate = (targetRoute: Route) => {
    navigate(targetRoute)
    setRoute(targetRoute)
    setIsSwipeMenuOpen(false)
  }

  const handleClearCheckIn = () => {
    if (!confirmClearArmed) {
      setConfirmClearArmed(true)
      return
    }

    clearRecord()
    setRecord(null)
    setName('')
    setBatch('')
    setPhoneNumber('')
    setFeedbackText('')
    setError('')
    navigate('checkin')
    setRoute('checkin')
    setIsSwipeMenuOpen(false)
  }

  const handleCheckInSubmit = async (event: Event) => {
    event.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const trimmedBatch = batch.trim()

    if (!trimmedName || !trimmedBatch) {
      setError('Name and Batch are required.')
      return
    }

    const payload: CheckInRecord = {
      checkinId: generateCheckinId(),
      name: trimmedName,
      batch: trimmedBatch,
      phoneNumber: phoneNumber.trim(),
      checkinTimestamp: nowIso(),
    }

    setBusy(true)
    try {
      const result = await submitCheckIn(payload)
      const saved = { ...payload, checkinTimestamp: result.serverTimestamp ?? payload.checkinTimestamp }
      saveRecord(saved)
      setRecord(saved)
      setName(saved.name)
      setBatch(saved.batch)
      setPhoneNumber(saved.phoneNumber)
      navigate('done')
      setRoute('done')
    } catch {
      setError('We could not complete check-in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleFeedbackSubmit = async (event: Event) => {
    event.preventDefault()
    setError('')
    setFeedbackError('')

    if (!record) {
      setError('Check-in record is missing. Please check in first.')
      return
    }

    const trimmedFeedback = feedbackText.trim()
    if (trimmedFeedback.length < 5) {
      setFeedbackError('Please enter at least 5 characters of feedback.')
      return
    }

    setBusy(true)
    try {
      await submitFeedback(record.checkinId, trimmedFeedback, record.phoneNumber)
      setFeedbackText('')
      navigate('thanks')
      setRoute('thanks')
    } catch {
      setError('Could not submit feedback. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="app-shell">
      <div
        class={`swipe-menu-overlay ${isSwipeMenuOpen ? 'is-open' : ''}`}
        onClick={() => setIsSwipeMenuOpen(false)}
        aria-hidden={isSwipeMenuOpen ? 'false' : 'true'}
      />
      <aside class={`swipe-menu ${isSwipeMenuOpen ? 'is-open' : ''}`} aria-label="Quick menu">
        <div class="swipe-menu-header">
          <h3>Quick Menu</h3>
          <button
            type="button"
            class="swipe-menu-close"
            onClick={() => setIsSwipeMenuOpen(false)}
            aria-label="Close menu"
          >
            Close
          </button>
        </div>
        <div class="swipe-menu-body">
          <div class="swipe-menu-primary">
            {!record && (
              <button
                type="button"
                class="swipe-menu-item"
                onClick={() => handleMenuNavigate('checkin')}
                disabled={route === 'checkin'}
              >
                Check-In Form
              </button>
            )}
            {record && (
              <button
                type="button"
                class="swipe-menu-item"
                onClick={() => handleMenuNavigate('details')}
                disabled={route === 'details'}
              >
                Check-In Details
              </button>
            )}
            <button
              type="button"
              class="swipe-menu-item"
              onClick={() => handleMenuNavigate('feedback')}
              disabled={route === 'feedback'}
            >
              Feedback
            </button>
          </div>

          {record && (
            <div class="swipe-menu-danger">
              <button
                type="button"
                class={`swipe-menu-item secondary ${confirmClearArmed ? 'confirm-armed' : ''}`}
                onClick={handleClearCheckIn}
                aria-label={confirmClearArmed ? 'Tap again to clear check-in' : 'Clear check-in'}
              >
                {confirmClearArmed ? 'Tap Again to Confirm Clear' : 'Clear Check-In'}
              </button>
            </div>
          )}
        </div>
      </aside>
      <section class="card">
        <h1 class="event-title">
          <span class="event-title-top">{EVENT_TITLE_TOP}</span>
          <span class="event-title-main">{EVENT_TITLE_MAIN}</span>
          <span class="event-title-bottom">{EVENT_TITLE_BOTTOM}</span>
        </h1>
        <p class="event-meta">{EVENT_DATE} · {EVENT_TIME}</p>
        <p class="event-location">{EVENT_LOCATION}</p>

        {error && (
          <p class="status error" role="alert">
            {error}
          </p>
        )}

        {route === 'checkin' && (
          <form class="form" onSubmit={handleCheckInSubmit}>
            <AutocompleteField
              id="name"
              label="Full Name"
              placeholder="Start typing your name"
              value={name}
              suggestions={names}
              onValueChange={setName}
              onSuggestionSelect={(selectedName) => {
                const matchedBatch = nameToBatch[normalizeSuggestion(selectedName)]
                if (matchedBatch) {
                  setBatch(matchedBatch)
                }
              }}
            />

            <AutocompleteField
              id="batch"
              label="Batch"
              placeholder="Select or type your batch"
              value={batch}
              suggestions={batches}
              onValueChange={setBatch}
            />

            <label for="phone-number">Phone Number (Optional)</label>
            <input
              id="phone-number"
              name="phone-number"
              type="tel"
              value={phoneNumber}
              onInput={(event) => setPhoneNumber((event.target as HTMLInputElement).value)}
              placeholder="Enter phone number"
              inputMode="tel"
            />

            <label for="timestamp">Check-In Time</label>
            <input
              id="timestamp"
              name="timestamp"
              class="readonly-input"
              value={formatDateTime(liveTimestamp)}
              readOnly
              aria-readonly="true"
            />

            <button type="submit" disabled={busy}>
              {busy ? 'Checking you in...' : 'Check In to Reunion'}
            </button>
          </form>
        )}

        {route === 'done' && record && (
          <section class="done" aria-live="polite">
            <p class="done-kicker">You are checked in for the reunion.</p>
            <p>
              <strong>Full Name:</strong> {record.name}
            </p>
            <p>
              <strong>Batch:</strong> {record.batch}
            </p>
            {record.phoneNumber && (
              <p>
                <strong>Phone Number:</strong> {record.phoneNumber}
              </p>
            )}
            <p>
              <strong>Check-In Time:</strong> {formatDateTime(record.checkinTimestamp)}
            </p>
            <h2>Lets party</h2>
          </section>
        )}

        {route === 'feedback' && (
          <section>
            <h2 class="feedback-title">Reunion Feedback</h2>
            {!record && (
              <div class="status error">
                No check-in data found. Please check in first.
              </div>
            )}

            {record && (
              <>
                <form class="form" onSubmit={handleFeedbackSubmit}>
                  <label for="feedback-name">Full Name</label>
                  <input id="feedback-name" value={record.name} readOnly />

                  <label for="feedback-batch">Batch</label>
                  <input id="feedback-batch" value={record.batch} readOnly />

                  <label for="feedback">Feedback</label>
                  <textarea
                    id="feedback"
                    value={feedbackText}
                    onInput={(event) => {
                      setFeedbackText((event.target as HTMLTextAreaElement).value)
                      if (feedbackError) {
                        setFeedbackError('')
                      }
                    }}
                    placeholder="Tell us about the reunion experience"
                    rows={5}
                    maxLength={1000}
                    required
                  />

                  {feedbackError && (
                    <p class="status error inline-error" role="alert">
                      {feedbackError}
                    </p>
                  )}

                  <button type="submit" disabled={busy}>
                    {busy ? 'Submitting feedback...' : 'Submit Feedback'}
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {route === 'details' && (
          <section class="done" aria-live="polite">
            <h2>Check-In Details</h2>
            {!record && (
              <div class="status error">
                No check-in data found. Please check in first.
              </div>
            )}

            {record && (
              <>
                <p>
                  <strong>Full Name:</strong> {record.name}
                </p>
                <p>
                  <strong>Batch:</strong> {record.batch}
                </p>
                <p>
                  <strong>Phone Number:</strong> {record.phoneNumber || 'Not provided'}
                </p>
                <p>
                  <strong>Check-In Time:</strong> {formatDateTime(record.checkinTimestamp)}
                </p>
              </>
            )}
          </section>
        )}

        {route === 'thanks' && (
          <section class="done thanks-view" aria-live="polite">
            <p class="done-kicker">Feedback saved.</p>
            <h2>Thanks for the feedback</h2>
            <p>
              We’ve received your thoughts and saved them to the reunion record.
            </p>
            <p>
              You can close this page now.
            </p>
          </section>
        )}
      </section>
    </main>
  )
}
