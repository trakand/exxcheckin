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

## 2. Architecture
Because this app is hosted on GitHub Pages (static hosting), direct secure writes to Google Sheets are not practical from the browser alone. Use:

- Frontend: Preact + Vite + TypeScript (hosted on GitHub Pages)
- Backend-lite: Google Apps Script Web App (acts as API)
- Data store: Existing Google Spreadsheet

Why this works:
- GitHub Pages serves the UI.
- Apps Script safely writes to the sheet.
- Spreadsheet can remain anonymous read for suggestion data while write API is controlled via Apps Script.

## 3. User Flows

### Check-In Flow (QR 1)
1. User scans QR and opens /#/.
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

### Feedback Flow (QR 2)
1. User scans second QR and opens /#/feedback.
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
- G: source
- H: clientTimestamp

## 5. API Contract (Apps Script)
- GET ?action=suggestions
- POST action=checkin
- POST action=feedback

## 6. Local Testing
- If `VITE_API_BASE_URL` is empty, app runs with mock API.
- If set, app calls live Apps Script endpoint.
