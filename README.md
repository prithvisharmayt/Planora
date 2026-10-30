# PLANORA — The Study Buddy
> **"Less Panic, More Progress."**

Planora is a mobile-first study-planning web app built with React, Vite, TypeScript, and Tailwind CSS. It replaces study panic with realistic, stress-free momentum through deterministic scheduling.

---

## 🚀 How to Run Planora

### Option 1: Double-click `run.bat` (Easiest on Windows)
Simply double-click the `run.bat` file in this folder. It will start the server and open your browser automatically!

### Option 2: From PowerShell / Command Prompt
In your terminal inside `c:\Users\ANSHU\Desktop\Planora`:
```powershell
npm.cmd run dev
```

> **Note on Windows PowerShell:**  
> If you get an error saying `File npm.ps1 cannot be loaded because running scripts is disabled on this system`, use `npm.cmd run dev` instead of `npm run dev`. This bypasses the PowerShell execution policy without changing system settings.

Then open your browser at:
👉 **http://localhost:5173**

---

## 📊 Google Sheets Storage

Planora now supports **Google Sheets data storage** out of the box! You do not need any Supabase cloud account or database setup.

### 1. Local Sheet Mode (Default — Zero Setup Needed)
- Everything runs immediately in your browser using local spreadsheet table stores (`profiles`, `subjects`, `chapters`, `blocks`).
- Data persists across browser refreshes and page reloads.
- You can export your entire study plan anytime as a CSV file to open directly in Google Sheets or Microsoft Excel from **Settings → Export Plan to CSV**.

### 2. Live Google Sheets Cloud Sync (Optional)
If you want your schedule saved directly into a live Google Sheet in Google Drive:
1. Open [sheets.new](https://sheets.new) to create a new blank Google Sheet.
2. In Google Sheets, click **Extensions → Apps Script**.
3. Delete any boilerplate code and paste the complete contents of [`google-sheets-backend.gs`](./google-sheets-backend.gs).
4. Click **Deploy → New deployment**.
   - Choose type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the resulting Web App URL.
5. In Planora, go to **Settings → Google Sheets Data Storage**, paste the Web App URL, and click **Save URL**.

Planora will automatically create and sync all 4 sheet tabs:
- `profiles`
- `subjects`
- `chapters`
- `blocks`

---

## 🧪 Running the Test Suite

To run the deterministic scheduler and end-to-end integration test suite:
```powershell
npx.cmd vitest run
```

All 8 tests will verify:
1. Daily cap strictly respected
2. Earlier exam deadlines scheduled first
3. Breaks automatically inserted after sessions
4. Long chapters spread across multiple days instead of marathons
5. Calm deficit banner reported when work won't fit before exam
6. Full end-to-end onboarding, done toggle, and recovery rebuild
7. Multi-user data isolation

---

## 🛠️ Build for Production

```powershell
npm.cmd run build
```
Creates an optimized, code-split production build in `dist/`.
