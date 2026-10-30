import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AppLayout: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/app', label: 'Today', icon: CalendarCheck },
    { to: '/plan', label: 'My Plan', icon: CalendarDays },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row antialiased">
      {/* Desktop Sidebar (Fixed 240px) */}
      <aside
        aria-label="Sidebar Navigation"
        className="hidden md:flex md:w-[240px] md:flex-col md:fixed md:inset-y-0 bg-surface border-r border-border z-30 justify-between p-5"
      >
        <div className="space-y-6">
          <div className="pt-2">
            <NavLink to="/app" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-lg shadow-sm">
                P
              </span>
              <div>
                <span className="font-heading font-bold text-xl text-ink tracking-tight">Planora</span>
                <span className="block text-[11px] text-muted font-medium leading-none mt-0.5">The Study Buddy</span>
              </div>
            </NavLink>
          </div>

          <nav aria-label="Desktop Navigation" className="space-y-1.5 pt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-input text-sm font-medium transition-colors min-h-[44px] ${
                      isActive
                        ? 'bg-primary text-white font-semibold shadow-cta'
                        : 'text-muted hover:text-ink hover:bg-surface-2 active:bg-surface-2'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Footer in Sidebar */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center text-sm border border-primary/20">
              {(profile?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="truncate flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{profile?.name || 'Student'}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out of Planora"
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-muted hover:text-rose hover:bg-rose/10 rounded-input transition-colors min-h-[44px] pressable"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-[240px] flex flex-col min-h-screen pb-24 md:pb-8">
        <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur-md border-t border-border z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] py-1 text-xs font-semibold pressable transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="w-6 h-6 mb-1" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
