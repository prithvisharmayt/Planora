import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet, Download, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../lib/dataService';
import { googleSheetsService } from '../lib/googleSheetsService';
import { Seo } from '../components/Seo';
import { Modal } from '../components/Modal';

export const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.name || '');
  const [college, setCollege] = useState(profile?.college || '');
  const [program, setProgram] = useState(profile?.program || 'Engineering');
  const [dailyHours, setDailyHours] = useState(profile?.daily_hours || 2);
  const [sessionMin, setSessionMin] = useState(profile?.session_min || 45);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Sheets integration state
  const [sheetUrl, setSheetUrl] = useState(googleSheetsService.getGoogleSheetUrl());
  const [sheetSaved, setSheetSaved] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setCollege(profile.college || '');
      setProgram(profile.program || 'Engineering');
      setDailyHours(profile.daily_hours || 2);
      setSessionMin(profile.session_min || 45);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      setSavedSuccess(false);

      await dataService.upsertProfile({
        id: user.id,
        name: name.trim(),
        college: college.trim(),
        program,
        daily_hours: Number(dailyHours),
        session_min: Number(sessionMin),
        break_min: profile?.break_min || 10,
      });

      await refreshProfile();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMsg(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSheetUrl = () => {
    googleSheetsService.setGoogleSheetUrl(sheetUrl);
    setSheetSaved(true);
    setTimeout(() => setSheetSaved(false), 3000);
  };

  const handleExportCsv = () => {
    if (user) {
      dataService.exportToGoogleSheetsCsv(user.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      setErrorMsg('Failed to delete account. Please try again.');
      setDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const isConnected = googleSheetsService.isGoogleSheetConnected();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Seo
        title="Settings — Study Preferences"
        description="Update your college, program, daily study hours, session length, and data settings."
        noIndex={true}
        canonicalPath="/settings"
      />

      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Configure your study profile and data storage.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-card bg-mint-soft border border-mint/30 text-mint text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-mint" />
          <span>Your preferences have been saved successfully.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-card bg-rose/10 border border-rose/30 text-rose text-sm font-medium flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-surface border border-border rounded-card p-6 shadow-card space-y-6">
        <div>
          <h2 className="font-heading font-semibold text-lg text-ink">Study Profile</h2>
          <p className="text-xs text-muted mt-0.5">
            These parameters govern your timetable schedules and recoveries.
          </p>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="settings-name" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
            Your Name
          </label>
          <input
            id="settings-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink focus:border-primary transition-colors text-base"
          />
        </div>

        {/* College & Program */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-college" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              College Name
            </label>
            <input
              id="settings-college"
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. Stanford University"
              className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink focus:border-primary transition-colors text-base"
            />
          </div>

          <div>
            <label htmlFor="settings-program" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
              Program / Major
            </label>
            <select
              id="settings-program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink focus:border-primary transition-colors text-base"
            >
              <option value="Engineering">Engineering</option>
              <option value="Medical">Medical</option>
              <option value="Science">Science</option>
              <option value="Commerce">Commerce</option>
              <option value="Arts">Arts</option>
              <option value="Management">Management</option>
              <option value="Law">Law</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Email Read-only */}
        <div>
          <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
            Account / Email
          </label>
          <input
            type="email"
            disabled
            value={user?.email || 'Student'}
            className="w-full px-3.5 py-2.5 rounded-input border border-border bg-surface-2/60 text-muted cursor-not-allowed text-base"
          />
        </div>

        {/* Daily Hours */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider">
              Daily Study Cap
            </label>
            <span className="font-heading font-bold text-base text-primary">
              {dailyHours} hours / day
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[1.5, 2, 3, 4].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setDailyHours(hrs)}
                className={`py-2 rounded-input text-sm font-semibold border transition-all min-h-[44px] flex items-center justify-center pressable ${
                  dailyHours === hrs
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-2 text-muted border-border hover:border-primary/40'
                }`}
              >
                {hrs}h
              </button>
            ))}
          </div>
        </div>

        {/* Session Length */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
            Session Length (minutes)
          </label>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[30, 45, 60].map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => setSessionMin(len)}
                className={`py-2 rounded-input text-sm font-semibold border transition-all min-h-[44px] flex items-center justify-center pressable ${
                  sessionMin === len
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface-2 text-muted border-border hover:border-primary/40'
                }`}
              >
                {len} mins
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-input bg-primary text-white text-sm font-semibold shadow-cta hover:bg-primary-hi transition-colors min-h-[44px] flex items-center justify-center gap-2 pressable disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Google Sheets Storage & Export Section */}
      <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-input bg-mint-soft text-mint flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg text-ink">Google Sheets Data Storage</h2>
              <p className="text-xs text-muted">Use local spreadsheet tables or sync live with Google Sheets.</p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-semibold self-start sm:self-auto ${
              isConnected
                ? 'bg-mint-soft text-mint border border-mint/30'
                : 'bg-primary-soft text-primary border border-primary/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-mint' : 'bg-primary'}`}
            />
            {isConnected ? 'Google Sheet Connected' : 'Local Sheet Mode (Active)'}
          </span>
        </div>

        {sheetSaved && (
          <div className="p-3 rounded-input bg-mint-soft text-mint text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint flex-shrink-0" />
            <span>Google Sheet URL updated!</span>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="gs-url" className="block text-xs font-semibold text-ink uppercase tracking-wider">
            Google Sheets Apps Script Web App URL (Optional)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="gs-url"
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 px-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink text-sm focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={handleSaveSheetUrl}
              className="px-5 py-2.5 rounded-input bg-primary text-white text-xs font-semibold shadow-cta hover:bg-primary-hi min-h-[44px] pressable"
            >
              Save URL
            </button>
          </div>
          <p className="text-xs text-muted">
            Leave blank to use lightning-fast Local Sheet storage in your browser.
          </p>
        </div>

        <div className="p-4 rounded-input bg-surface-2 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Export Plan to CSV / Google Sheets</p>
            <p className="text-xs text-muted">Download all subjects, chapters, and scheduled blocks as an open spreadsheet file.</p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-input bg-surface border border-border hover:bg-surface-2 text-xs font-semibold text-ink flex items-center justify-center gap-2 min-h-[44px] pressable flex-shrink-0"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Export CSV</span>
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showInstructions ? 'Hide setup instructions' : 'How to connect your live Google Sheet in 30 seconds'}</span>
          </button>

          {showInstructions && (
            <div className="mt-3 p-4 rounded-card bg-surface-2 border border-border text-xs text-muted space-y-2">
              <p className="font-semibold text-ink">3-Step Google Sheet Connection:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a new Google Sheet at <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-primary underline">sheets.new</a></li>
                <li>In Google Sheets, click <strong>Extensions → Apps Script</strong></li>
                <li>Delete any code there and paste the contents of <code className="px-1.5 py-0.5 bg-surface border rounded text-ink">google-sheets-backend.gs</code></li>
                <li>Click <strong>Deploy → New deployment</strong>, choose type <strong>Web app</strong>, set <em>Who has access</em> to <strong>Anyone</strong>, and click <strong>Deploy</strong></li>
                <li>Copy the Web App URL and paste it into the box above!</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Account Actions Section */}
      <div className="bg-surface border border-border rounded-card p-6 shadow-card space-y-4">
        <h2 className="font-heading font-semibold text-lg text-ink">Account & Session</h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-semibold text-ink">Sign Out</p>
            <p className="text-xs text-muted">End your active session on this device.</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-5 py-2.5 rounded-input border border-border bg-surface-2 text-sm font-semibold text-ink hover:bg-surface-2/80 transition-colors min-h-[44px] flex items-center justify-center gap-2 pressable"
          >
            <LogOut className="w-4 h-4 text-muted" />
            <span>Sign Out</span>
          </button>
        </div>

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose">Delete Account</p>
            <p className="text-xs text-muted">Permanently remove all your subjects, chapters, and blocks.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-5 py-2.5 rounded-input bg-rose/15 text-rose border border-rose/30 text-sm font-semibold hover:bg-rose/25 transition-colors min-h-[44px] flex items-center justify-center gap-2 pressable"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Planora Account"
        description="This action cannot be undone. All study plans and subjects will be deleted."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Are you sure you want to delete your account? All your subjects, chapters, and study history will be permanently wiped.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2.5 rounded-input border border-border text-sm font-semibold text-muted hover:text-ink min-h-[44px] pressable"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="px-5 py-2.5 rounded-input bg-rose text-white text-sm font-semibold hover:opacity-90 min-h-[44px] pressable disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete Everything'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
