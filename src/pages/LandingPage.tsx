import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, ShieldCheck, RefreshCw, Zap, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { Seo } from '../components/Seo';

export const LandingPage: React.FC = () => {
  const faqs = [
    {
      q: 'How does Planora prevent study burnout?',
      a: 'Planora enforces your realistic daily study cap, splits long chapters across multiple days, and automatically schedules mandatory rest breaks between every study session.',
    },
    {
      q: 'What happens if I miss a study session?',
      a: "No guilt, no streaks lost. Tap 'Fix my plan' and Planora recalculates the remaining work starting today while preserving what you already finished.",
    },
    {
      q: 'Does Planora use AI or third-party bots to schedule?',
      a: 'No. Planora uses a 100% deterministic, constraint-based algorithm based on deadline pressure, subject priority, and difficulty so your schedule is predictable and private.',
    },
    {
      q: 'How long does setup take?',
      a: 'Exactly 3 minutes. Enter your subjects with exam dates, list chapters with estimated time chips, and set your daily study hours.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-primary-soft selection:text-primary">
      <Seo
        title="Planora — The Study Buddy | Less Panic, More Progress"
        description="Planora creates realistic, stress-free study schedules that adapt when life happens. Less panic, more progress."
        canonicalPath="/"
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border">
        <nav aria-label="Main Navigation" className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 pressable">
            <span className="w-8 h-8 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-lg shadow-sm">
              P
            </span>
            <span className="font-heading font-bold text-xl text-ink tracking-tight">Planora</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink transition-colors min-h-[44px] flex items-center"
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=signup"
              className="px-4 sm:px-5 py-2 rounded-input bg-cta-gradient text-white text-sm font-semibold shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center gap-1.5 pressable"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section with soft glow and subtle grid */}
        <section aria-labelledby="hero-heading" className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
          {/* Subtle Grid and Radial Glow */}
          <div className="absolute inset-0 hero-grid-pattern opacity-100 pointer-events-none" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-hero-glow pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Copy & Primary CTA */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-primary-soft border border-primary/30 text-primary-hi text-xs sm:text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>The Study Buddy</span>
                </div>

                <h1
                  id="hero-heading"
                  className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-ink tracking-tight leading-[1.12]"
                >
                  Less Panic, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue">
                    More Progress.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-muted max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
                  The study-planning web app that replaces panic with realistic momentum.
                  Deterministic scheduling that spreads marathon chapters, protects rest, and rebuilds when life happens — with zero guilt.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <Link
                    to="/login?mode=signup"
                    className="w-full sm:w-auto px-7 py-3.5 rounded-input bg-cta-gradient text-white text-base font-semibold shadow-cta hover:opacity-95 transition-all min-h-[44px] flex items-center justify-center gap-2 pressable"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="w-full sm:w-auto px-5 py-3.5 rounded-input bg-surface-2 border border-border text-ink text-base font-medium hover:bg-surface-2/80 transition-colors min-h-[44px] flex items-center justify-center pressable"
                  >
                    See How It Works
                  </a>
                </div>

                <div className="flex items-center justify-center lg:justify-start gap-6 text-xs text-muted pt-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-mint" /> 3-minute setup
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-mint" /> No timer anxiety
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-mint" /> Zero guilt recovery
                  </span>
                </div>
              </div>

              {/* Right Column: Hero CSS Reshuffle Schedule Card */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-sm sm:max-w-md bg-surface/90 backdrop-blur-md border border-border rounded-hero p-5 sm:p-6 shadow-card relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-border">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">Today's Schedule</p>
                      <p className="font-heading font-semibold text-ink text-base">Tuesday Focus</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-pill bg-mint-soft text-mint text-xs font-semibold border border-mint/20">
                      Balanced
                    </span>
                  </div>

                  {/* Reshuffling Blocks (Pure CSS animation) */}
                  <div className="py-4 space-y-3 relative h-[220px]">
                    {/* Animated Block 1 */}
                    <div className="p-3.5 rounded-input bg-surface-2 border border-border flex items-center justify-between animate-reshuffle-1 relative">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                          C
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink leading-tight">Chemistry</p>
                          <p className="text-xs text-muted mt-0.5">Thermodynamics (45m)</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-primary-hi bg-primary-soft px-2 py-0.5 rounded-pill border border-primary/20">
                        09:00 AM
                      </span>
                    </div>

                    {/* Animated Block 2 */}
                    <div className="p-3.5 rounded-input bg-surface-2 border border-border flex items-center justify-between animate-reshuffle-2 relative">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-mint text-bg text-xs font-bold flex items-center justify-center">
                          M
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink leading-tight">Mathematics</p>
                          <p className="text-xs text-muted mt-0.5">Calculus Integrals (45m)</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-mint bg-mint-soft px-2 py-0.5 rounded-pill border border-mint/20">
                        10:00 AM
                      </span>
                    </div>

                    {/* Static Break Block */}
                    <div className="p-2.5 rounded-input bg-primary-soft/30 border border-primary/20 flex items-center justify-center gap-2 text-xs text-primary font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>15m Rest Break Scheduled</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                    <span>Target: 2h 30m</span>
                    <span className="text-primary font-medium flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Auto-rebuilt
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem in Three Short Cards */}
        <section aria-labelledby="problem-heading" className="py-16 bg-surface/50 border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 id="problem-heading" className="font-heading font-bold text-2xl sm:text-3xl text-ink">
                Why Standard Timetables Always Fail
              </h2>
              <p className="text-sm sm:text-base text-muted mt-2">
                Traditional calendars treat humans like robots. When reality hits, they break.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <article className="p-6 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-input bg-rose/15 text-rose flex items-center justify-center mb-4 font-bold text-lg">
                    1
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-ink">Day Two Collapse</h3>
                  <p className="text-sm text-muted mt-2 leading-relaxed">
                    Overambitious timetables pack 8 uninterrupted hours on a Monday. By Tuesday evening, one missed session ruins the entire week.
                  </p>
                </div>
              </article>

              <article className="p-6 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-input bg-amber/15 text-amber flex items-center justify-center mb-4 font-bold text-lg">
                    2
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-ink">The Guilt Spiral</h3>
                  <p className="text-sm text-muted mt-2 leading-relaxed">
                    Streak counters and red badges make you feel like a failure for catching the flu or taking an evening off. You end up quitting the app.
                  </p>
                </div>
              </article>

              <article className="p-6 rounded-card bg-surface border border-border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-input bg-primary-soft text-primary flex items-center justify-center mb-4 font-bold text-lg">
                    3
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-ink">Rescheduling Fatigue</h3>
                  <p className="text-sm text-muted mt-2 leading-relaxed">
                    Dragging and dropping 30 calendar blocks by hand takes more mental energy than studying the actual chapters.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works in Four Steps */}
        <section id="how-it-works" aria-labelledby="how-heading" className="py-16 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs uppercase font-bold tracking-wider text-primary">Simple & Calm</span>
              <h2 id="how-heading" className="font-heading font-bold text-2xl sm:text-3xl lg:text-4xl text-ink mt-1">
                How Planora Works in Four Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-card bg-surface border border-border shadow-sm relative">
                <span className="font-heading text-4xl font-bold text-primary/20 absolute top-4 right-4">01</span>
                <Clock className="w-7 h-7 text-primary mb-4" />
                <h3 className="font-heading font-semibold text-lg text-ink">Set it up in 3 min</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  Enter your college, degree, subjects, chapters (paste or upload), and your realistic daily hours.
                </p>
              </div>

              <div className="p-6 rounded-card bg-surface border border-border shadow-sm relative">
                <span className="font-heading text-4xl font-bold text-mint/20 absolute top-4 right-4">02</span>
                <ShieldCheck className="w-7 h-7 text-mint mb-4" />
                <h3 className="font-heading font-semibold text-lg text-ink">Deterministic Plan</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  Our algorithm splits long chapters, inserts breaks, avoids subject fatigue, and stops the day before exams.
                </p>
              </div>

              <div className="p-6 rounded-card bg-surface border border-border shadow-sm relative">
                <span className="font-heading text-4xl font-bold text-amber/20 absolute top-4 right-4">03</span>
                <Zap className="w-7 h-7 text-amber mb-4" />
                <h3 className="font-heading font-semibold text-lg text-ink">Mark reality</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  Only two actions: Done or Not yet. No timers counting down, no streaks, no guilt badges.
                </p>
              </div>

              <div className="p-6 rounded-card bg-surface border border-border shadow-sm relative">
                <span className="font-heading text-4xl font-bold text-blue/20 absolute top-4 right-4">04</span>
                <RefreshCw className="w-7 h-7 text-blue mb-4" />
                <h3 className="font-heading font-semibold text-lg text-ink">One-tap Recovery</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  Missed something? Tap 'Fix my plan'. It rebuilds remaining work from today and shows a clear change list.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section Matching JSON-LD */}
        <section aria-labelledby="faq-heading" className="py-16 sm:py-24 border-t border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <span className="text-xs uppercase font-bold tracking-wider text-primary">Got Questions?</span>
              <h2 id="faq-heading" className="font-heading font-bold text-2xl sm:text-3xl text-ink mt-1">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="p-5 rounded-card bg-surface border border-border">
                  <h3 className="font-heading font-semibold text-base text-ink flex items-start gap-2.5">
                    <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-sm text-muted mt-2 pl-7 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>

            {/* Bottom CTA Card */}
            <div className="mt-16 p-8 sm:p-10 rounded-hero bg-surface border border-border text-center space-y-4 shadow-card relative overflow-hidden">
              <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
              <div className="relative z-10 space-y-3">
                <h2 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight text-ink">
                  Ready to study with less panic?
                </h2>
                <p className="text-sm sm:text-base text-muted max-w-lg mx-auto">
                  Set up your realistic revision plan in under 3 minutes.
                </p>
                <div className="pt-2">
                  <Link
                    to="/login?mode=signup"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-input bg-cta-gradient text-white font-semibold text-base shadow-cta hover:opacity-95 transition-all pressable"
                  >
                    <span>Start Free Setup</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface/60 border-t border-border py-8 text-center text-xs text-muted">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-xs">
              P
            </span>
            <span className="font-heading font-semibold text-sm text-ink">Planora</span>
            <span className="text-muted">— Less Panic, More Progress.</span>
          </div>
          <p>© {new Date().getFullYear()} Planora. Built for calm students.</p>
        </div>
      </footer>
    </div>
  );
};
