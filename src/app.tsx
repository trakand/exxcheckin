import { useEffect, useMemo, useState } from 'preact/hooks'

type Route = 'checkin' | 'done' | 'feedback'

type CheckInRecord = {
  checkinId: string
  name: string
  batch: string
  checkinTimestamp: string
}

type SuggestionResponse = {
  names: string[]
  batches: string[]
}

type AutocompleteFieldProps = {
  id: string
  label: string
  placeholder: string
  value: string
  suggestions: string[]
  onValueChange: (value: string) => void
}

const STORAGE_KEY = 'exxcheckin.record'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const USE_MOCK_API =
  (import.meta.env.VITE_USE_MOCK_API ?? 'false').trim().toLowerCase() === 'true' ||
  API_BASE_URL.length === 0

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
    const parsed = JSON.parse(raw) as CheckInRecord
    if (!parsed.checkinId || !parsed.name || !parsed.batch || !parsed.checkinTimestamp) {
      return null
    }
    return parsed
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

async function submitFeedback(checkinId: string, feedback: string): Promise<void> {
  if (USE_MOCK_API) {
    return
  }

  const requestBody = new URLSearchParams({
    action: 'feedback',
    checkinId,
    feedback,
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

function AutocompleteField({
  id,
  label,
  placeholder,
  value,
  suggestions,
  onValueChange,
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
  const [liveTimestamp, setLiveTimestamp] = useState(nowIso())
  const [feedbackText, setFeedbackText] = useState('')

  const [names, setNames] = useState<string[]>([])
  const [batches, setBatches] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')

  const handleCheckInAgain = () => {
    clearRecord()
    setRecord(null)
    setName('')
    setBatch('')
    setFeedbackText('')
    setError('')
    setFeedbackSuccess('')
    navigate('checkin')
    setRoute('checkin')
  }

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
        setNames(data.names ?? [])
        setBatches(data.batches ?? [])
      })
      .catch(() => {
        setError('Could not load suggestions. You can still type manually.')
      })
  }, [])

  useEffect(() => {
    if (route === 'checkin' && record) {
      navigate('done')
      setRoute('done')
    }
  }, [route, record])

  const subtitle = useMemo(() => {
    if (USE_MOCK_API) {
      return 'Local test mode is active. Data writes are mocked.'
    }
    return 'Live mode connected to Google Apps Script API.'
  }, [])

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
    setFeedbackSuccess('')

    if (!record) {
      setError('Check-in record is missing. Please check in first.')
      return
    }

    const trimmedFeedback = feedbackText.trim()
    if (trimmedFeedback.length < 5) {
      setError('Please enter at least 5 characters of feedback.')
      return
    }

    setBusy(true)
    try {
      await submitFeedback(record.checkinId, trimmedFeedback)
      setFeedbackText('')
      setFeedbackSuccess('Thank you for the feedback!')
    } catch {
      setError('Could not submit feedback. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="app-shell">
      <section class="card">
        <p class="mode-badge">EXX Check-In</p>
        <h1>Event Entry</h1>
        <p class="subtitle">{subtitle}</p>

        {error && (
          <p class="status error" role="alert">
            {error}
          </p>
        )}

        {feedbackSuccess && (
          <p class="status success" role="status">
            {feedbackSuccess}
          </p>
        )}

        {route === 'checkin' && (
          <form class="form" onSubmit={handleCheckInSubmit}>
            <AutocompleteField
              id="name"
              label="Name"
              placeholder="Enter your name"
              value={name}
              suggestions={names}
              onValueChange={setName}
            />

            <AutocompleteField
              id="batch"
              label="Batch"
              placeholder="Enter your batch"
              value={batch}
              suggestions={batches}
              onValueChange={setBatch}
            />

            <label for="timestamp">Timestamp</label>
            <input id="timestamp" name="timestamp" value={formatDateTime(liveTimestamp)} readOnly />

            <button type="submit" disabled={busy}>
              {busy ? 'Checking in...' : 'Check-In'}
            </button>
          </form>
        )}

        {route === 'done' && record && (
          <section class="done" aria-live="polite">
            <p>
              <strong>Name:</strong> {record.name}
            </p>
            <p>
              <strong>Batch:</strong> {record.batch}
            </p>
            <p>
              <strong>Timestamp:</strong> {formatDateTime(record.checkinTimestamp)}
            </p>
            <h2>Lets party</h2>
            <div class="actions">
              <button type="button" onClick={() => navigate('feedback')}>
                Leave Feedback
              </button>
              <button type="button" class="secondary-button" onClick={handleCheckInAgain}>
                Check in again
              </button>
            </div>
          </section>
        )}

        {route === 'feedback' && (
          <section>
            {!record && (
              <div class="status error">
                No check-in found on this device. Please scan the check-in QR first.
              </div>
            )}

            {record && (
              <form class="form" onSubmit={handleFeedbackSubmit}>
                <label for="feedback-name">Name</label>
                <input id="feedback-name" value={record.name} readOnly />

                <label for="feedback-batch">Batch</label>
                <input id="feedback-batch" value={record.batch} readOnly />

                <label for="feedback">Feedback</label>
                <textarea
                  id="feedback"
                  value={feedbackText}
                  onInput={(event) => setFeedbackText((event.target as HTMLTextAreaElement).value)}
                  placeholder="Tell us how the event was"
                  rows={5}
                  maxLength={1000}
                  required
                />

                <button type="submit" disabled={busy}>
                  {busy ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button type="button" class="secondary-button" onClick={handleCheckInAgain}>
                  Check in again
                </button>
              </form>
            )}
          </section>
        )}
      </section>
    </main>
  )
}
