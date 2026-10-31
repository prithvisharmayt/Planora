import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Seo } from '../components/Seo';
import { dataService } from '../lib/dataService';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, signUp, resetPassword, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Check URL params for OAuth error messages
  useEffect(() => {
    const errorDesc = searchParams.get('error_description') || searchParams.get('error');
    if (errorDesc) {
      setErrorMsg(decodeURIComponent(errorDesc));
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      dataService.getSubjects(user.id).then((subs) => {
        if (subs.length > 0) {
          navigate('/app', { replace: true });
        } else {
          navigate('/setup', { replace: true });
        }
      });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setErrorMsg(res.error.message || 'Failed to sign in with Google.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate Google sign-in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      try {
        setSubmitting(true);
        const res = await resetPassword(email);
        if (res.error) {
          setErrorMsg(res.error.message);
        } else {
          setSuccessMsg('Password reset instructions sent to your email.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to send reset link.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'signup') {
        const res = await signUp(email, password, name || 'Student');
        if (res.error) {
          setErrorMsg(res.error.message);
        } else if (res.needsEmailConfirmation) {
          setMode('signin');
          setSuccessMsg('Check your email to confirm your account, then sign in.');
        } else {
          navigate('/setup', { replace: true });
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Seo
        title={mode === 'signup' ? 'Sign Up for Planora' : 'Sign In to Planora'}
        description="Sign in or create an account with Planora to start your stress-free study plan."
        canonicalPath="/login"
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="flex items-center gap-2.5 pressable">
            <span className="w-10 h-10 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-xl shadow-sm">
              P
            </span>
            <span className="font-heading font-bold text-2xl text-ink tracking-tight">Planora</span>
          </Link>
          <p className="mt-2 text-sm text-muted">Less Panic, More Progress.</p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 bg-surface py-8 px-6 sm:px-10 rounded-card shadow-card border border-border">
          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors min-h-[44px] flex items-center justify-center ${
                mode === 'signin'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors min-h-[44px] flex items-center justify-center ${
                mode === 'signup'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              Sign Up
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-input bg-rose/10 border border-rose/30 text-rose text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-input bg-mint-soft border border-mint/30 text-mint text-xs font-medium flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          {mode !== 'forgot' && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-input border border-border bg-surface hover:bg-surface-2 text-ink text-sm font-semibold flex items-center justify-center gap-3 transition-colors pressable shadow-sm min-h-[44px]"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-muted font-medium">or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="name-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex"
                    className="block w-full pl-10 pr-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink placeholder:text-muted/50 focus:border-primary transition-colors text-base"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email-input" className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@student.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink placeholder:text-muted/50 focus:border-primary transition-colors text-base"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="pwd-input" className="block text-xs font-semibold text-ink uppercase tracking-wider">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-primary hover:underline font-medium min-h-[30px] flex items-center"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="pwd-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3.5 py-2.5 rounded-input border border-border bg-surface-2 text-ink placeholder:text-muted/50 focus:border-primary transition-colors text-base"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-input bg-cta-gradient text-white text-sm font-semibold shadow-cta hover:opacity-95 transition-all min-h-[44px] pressable disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'signin'
                        ? 'Sign In'
                        : mode === 'signup'
                        ? 'Create Account'
                        : 'Send Reset Link'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {mode === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-xs font-medium text-primary hover:underline min-h-[36px]"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
