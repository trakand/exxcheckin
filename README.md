# EXX Check-In App

Preact + Vite app for QR-based event check-in and feedback.

## 1. Run Locally
1. Install dependencies:
   npm install
2. Start dev server:
   npm run dev
3. Open:
   http://localhost:5173/

By default, local run is in mock mode when `VITE_API_BASE_URL` is empty.

## 2. Local Config
1. Create `.env.local` from `.env.example`.
2. For local UI-only testing, keep `VITE_API_BASE_URL` empty.
3. For live API testing, set:
   VITE_API_BASE_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec

## 3. Routes and QR Links
This app uses hash routes for GitHub Pages compatibility.

1. Check-in URL:
   https://<user>.github.io/<repo>/#/
2. Feedback URL:
   https://<user>.github.io/<repo>/#/feedback

## 4. Build and Preview
1. Build:
   npm run build
2. Preview build:
   npm run preview

## 5. Deploy Apps Script Backend
1. Open the target spreadsheet.
2. Go to Extensions -> Apps Script.
3. Paste the code from `apps-script/Code.gs`.
4. Deploy -> New deployment -> Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Copy the Web App URL and use it as `VITE_API_BASE_URL`.

## 6. Deploy Frontend to GitHub Pages
1. Push this repo to GitHub.
2. In GitHub repo settings, enable Pages via GitHub Actions.
3. Build and deploy static files from workflow.
4. Use hash route URLs for QR codes.
