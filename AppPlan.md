# Event Check-In App Plan

## 1. Goal
Build a mobile-first web app for event check-in and end-of-event feedback.

Key outcomes:
- Fast QR-entry experience.
- Required check-in fields (Name, Batch) with autocomplete suggestions from Google Sheets.
- Check-in data saved to the CheckIn Log tab.
- Completion screen shown after successful check-in.
- Persistent "already checked in" behavior on the same device.
- Separate feedback entry flow via second QR code, writing back to the same row in CheckIn Log.

## 2. Recommended Architecture
Because this app is hosted on GitHub Pages (static hosting), direct secure writes to Google Sheets are not practical from the browser alone. Use:

- Frontend: React + Vite + TypeScript (hosted on GitHub Pages)
- Backend-lite: Google Apps Script Web App (acts as API)
- Data store: Existing Google Spreadsheet

Why this works:
- GitHub Pages serves the UI.
- Apps Script safely writes to the sheet.
- Spreadsheet can remain anonymous read for suggestion data while write API is controlled via Apps Script.

## 3. User Flows

### Check-In Flow (QR 1)
1. User scans QR and opens / (or /checkin).
2. App checks localStorage for prior successful check-in.
3. If found: navigate to completed screen.
4. If not found: show check-in form.
5. User enters Name and Batch via autocomplete (free text allowed).
6. Timestamp shown as read-only current date/time.
7. User taps Check-In.
8. App posts data to Apps Script endpoint.
9. On success:
   - Save local check-in record in localStorage.
   - Navigate to completed screen.

### Completed Flow
1. Show read-only Name, Batch, Timestamp.
2. Show message: Lets party.
3. Include optional button/link for feedback route if needed.

### Feedback Flow (QR 2)
1. User scans second QR and opens /feedback.
2. App reads Name and Batch from localStorage (from check-in).
3. If missing: show guidance to check in first.
4. User types feedback in text area.
5. On submit, app posts feedback update with stored checkinId.
6. Apps Script updates Feedback column in the matching CheckIn Log row.
7. Show success state.

## 4. Data Model and Sheet Contract

### Sheet: CheckIn Log
Recommended columns:
- A: checkinId (UUID)
- B: name
- C: batch
- D: checkinTimestamp
- E: feedback
- F: feedbackTimestamp
- G: source (optional, ex: checkin_qr, feedback_qr)

### Suggestion Data
Two options:
- Option A (simple): use unique values from CheckIn Log name and batch columns.
- Option B (clean): create separate sheets named NameMaster and BatchMaster with one value per row.

Option B is cleaner and avoids noisy suggestions.

## 5. API Contract (Apps Script)

Base URL:
- https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

Endpoints:
- GET ?action=suggestions
  - Response:
    - names: string[]
    - batches: string[]

- POST action=checkin
  - Payload:
    - checkinId
    - name
    - batch
    - clientTimestamp
  - Behavior:
    - Validate required fields.
    - Append row in CheckIn Log.
    - Return normalized server timestamp.

- POST action=feedback
  - Payload:
    - checkinId
    - feedback
    - clientTimestamp
  - Behavior:
    - Find row by checkinId.
    - Update feedback and feedbackTimestamp.

## 6. Frontend Pages and Routes
- / : Check-in screen.
- /done : Check-in completed screen.
- /feedback : Feedback screen.

State storage keys:
- exxcheckin.checkedIn = true/false
- exxcheckin.record = { checkinId, name, batch, checkinTimestamp }

## 7. UI/UX Plan
- Mobile-first layout, large tap targets, sticky submit button on small screens.
- Use native-like form spacing and instant validation messages.
- Autocomplete behavior:
  - Starts suggesting after 1 character.
  - Allows custom entries not in list.
- Loading and submit states:
  - Disable button while saving.
  - Show clear success and error notices.
- Accessibility:
  - Proper labels, aria-live for status messages, keyboard support.

## 8. Validation and Business Rules
- Name required, non-empty after trim.
- Batch required, non-empty after trim.
- Feedback optional or required (decide; recommend required at least 5 chars).
- Prevent duplicate check-in submit by disabling button and storing pending flag.
- If already checked in (localStorage true), bypass check-in form.

## 9. Security and Abuse Mitigation
Static + anonymous flows are inherently exposed, so implement practical safeguards:
- Validate all required fields in Apps Script.
- Limit input length (for example, 100 chars name/batch, 1000 chars feedback).
- Add basic request throttling in Apps Script by IP/time window where possible.
- Log malformed requests separately (optional tab).

Note:
- Local storage is device-specific, not user-auth identity.
- Clearing browser data allows another check-in on same device.

## 10. Deployment Plan

### Frontend (GitHub Pages)
1. Create app with Vite.
2. Set base path for repository pages.
3. Build and deploy with GitHub Actions or gh-pages branch.
4. Configure custom short URL if desired.

### Apps Script
1. Bind script to target spreadsheet.
2. Implement doGet and doPost handlers.
3. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
4. Copy deployment URL into frontend environment config.

### QR Codes
- QR 1 points to: https://<org-or-user>.github.io/<repo>/
- QR 2 points to: https://<org-or-user>.github.io/<repo>/feedback

## 11. Implementation Milestones

### Milestone 1: Foundation
- Project scaffold (React + TS + routing).
- Basic check-in page UI.
- Local storage utility.

### Milestone 2: Data Integration
- Apps Script endpoints.
- Suggestion fetch and autocomplete components.
- Check-in submit integration.

### Milestone 3: Completion and Persistence
- Completed page.
- Redirect logic for already checked in users.

### Milestone 4: Feedback
- Feedback route and form.
- Update row by checkinId.
- Success state.

### Milestone 5: Hardening
- Error handling and retries.
- Input limits.
- Cross-device and browser testing.

## 12. Test Checklist
- First-time check-in works end-to-end.
- Required field validation blocks empty submits.
- Suggestions load from sheet and free text still allowed.
- Completed screen displays saved details.
- Reload after check-in keeps user on completed page.
- Feedback screen pre-fills name and batch.
- Feedback writes to correct row and column.
- Works on Android Chrome and iPhone Safari.
- Handles offline or API failure with clear error.

## 13. Open Decisions
- Theme direction (colors, typography, tone).
- Whether feedback is required or optional.
- Whether suggestions come from CheckIn Log or dedicated master tabs.
- Whether to include an admin/reset option for testing only.

## 14. Next Build Step
Start by implementing Apps Script endpoints first, then wire the frontend to real APIs. This reduces UI rework and confirms sheet write access early.
