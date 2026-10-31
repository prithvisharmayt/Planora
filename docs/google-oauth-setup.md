# Google OAuth Setup Guide for Planora

This guide provides the exact, production-ready steps to configure **Google OAuth ("Continue with Google")** for Planora using Supabase Auth.

---

## 1. Google Cloud Console Configuration

### Step A: Create or Select a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top navigation project dropdown, click **New Project**.
3. Name it **Planora** (or your preferred name) and click **Create**.

### Step B: Configure the OAuth Consent Screen
1. In the sidebar, navigate to **APIs & Services** $\rightarrow$ **OAuth consent screen**.
2. Select User Type: **External** (unless you are using a Google Workspace organization), then click **Create**.
3. Fill in the required application details:
   - **App name**: `Planora`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. **Scopes**:
   - Click **Add or Remove Scopes**.
   - Select the 3 minimal identity scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`
   - *Note*: Planora does **not** request Gmail, Google Drive, or Calendar access.
   - Click **Update** $\rightarrow$ **Save and Continue**.
6. **Test Users** (while in "Testing" mode):
   - Add your own Google email address as a test user so you can log in during development.
   - Click **Save and Continue**.

### Step C: Create OAuth 2.0 Web Client Credentials
1. In the sidebar, navigate to **APIs & Services** $\rightarrow$ **Credentials**.
2. Click **+ Create Credentials** $\rightarrow$ **OAuth client ID**.
3. Set **Application type**: **Web application**.
4. Set **Name**: `Planora Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI**:
   - For local development: `http://localhost:5173`
   - For production (when deployed): `https://your-domain.com`
6. Under **Authorized redirect URIs**, click **+ Add URI**:
   - Enter your Supabase Auth callback URI:
     ```text
     https://<YOUR-SUPABASE-PROJECT-ID>.supabase.co/auth/v1/callback
     ```
     *(Replace `<YOUR-SUPABASE-PROJECT-ID>` with your real project reference from your Supabase Dashboard URL)*.
7. Click **Create**.
8. Copy your **Client ID** and **Client Secret**.

---

## 2. Supabase Dashboard Configuration

### Step A: Enable Google Provider
1. Open your [Supabase Dashboard](https://supabase.com/dashboard/projects).
2. Select your Planora project.
3. In the left navigation, click **Authentication** $\rightarrow$ **Providers**.
4. Find **Google** in the list and click to expand it.
5. Toggle **Enable Google provider** to **ON**.
6. Paste the credentials obtained from Google Cloud Console:
   - **Client ID**: Paste your Google Client ID
   - **Client Secret**: Paste your Google Client Secret
7. Click **Save**.

### Step B: Configure Redirect URLs
1. In the Supabase left navigation, go to **Authentication** $\rightarrow$ **URL Configuration**.
2. Set **Site URL** to:
   ```text
   http://localhost:5173
   ```
3. Under **Redirect URLs**, ensure the following pattern is present:
   ```text
   http://localhost:5173/**
   ```
4. Click **Save**.

---

## 3. Local Environment Configuration

Open `.env.local` in the root of your Planora project and ensure your Supabase public variables are populated:

```env
VITE_SUPABASE_URL=https://<YOUR-SUPABASE-PROJECT-ID>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR-SUPABASE-ANON-KEY>
```

> ⚠️ **Security Warning**:
> Never commit your Google Client Secret or Supabase service_role keys to Git. Planora uses PKCE OAuth flows where the client secret stays securely stored inside your Supabase backend.

---

## 4. Testing the Flow

1. Start the Planora development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:5173/login`.
3. Click the **"Continue with Google"** button.
4. You will be redirected to Google's consent screen. Sign in with your Google account.
5. Upon authorization, Google will redirect back to Supabase, which completes the session and returns you to `http://localhost:5173/app` (or `/setup` if you are a first-time user).
6. Verify your profile name and email appear in the sidebar/settings.

