import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Target, FolderOpen, MessageSquare, ScrollText, Rocket, Settings as SettingsIcon, Menu, X, Sun, Moon, LucideIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/missions', label: 'Missions', icon: Target },
  { path: '/files', label: 'Files', icon: FolderOpen },
  { path: '/sessions', label: 'Sessions', icon: ScrollText },
  { path: '/events', label: 'Events', icon: BarChart3 },
  { path: '/deploys', label: 'Deploys', icon: Rocket },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

function resolvePageTitle(pathname: string): string {
  const match = navItems.find(
    (item) => pathname === item.path || pathname.startsWith(item.path + '/'),
  );
  return match?.label ?? '';
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const pageTitle = resolvePageTitle(location.pathname);
  const isChatPage = location.pathname === '/chat' || location.pathname.startsWith('/chat/');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  return (
    <div className="h-[100dvh] bg-surface text-primary flex font-sans overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border flex-shrink-0">
        <div className="p-8 border-b border-border">
          <h1 className="text-2xl font-serif font-bold text-primary tracking-tight">Pincher</h1>
          <p className="text-xs font-medium text-secondary mt-2 tracking-wide uppercase">Control Plane v3.0</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-subtle text-primary shadow-sm ring-1 ring-border'
                    : 'text-secondary hover:text-primary hover:bg-subtle/50'
                }`}
              >
                <Icon 
                  size={18} 
                  className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'opacity-100' : 'opacity-70'}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-border flex items-center justify-between">
          <p className="text-xs text-tertiary font-medium">© 2026 Friend Labs</p>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-tertiary hover:text-primary hover:bg-subtle transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content — fills remaining height, flex column for header + content + bottom nav space */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex-shrink-0 bg-card/90 backdrop-blur-lg border-b border-border z-40">
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-tertiary hover:text-primary hover:bg-subtle transition-colors flex-shrink-0"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {isChatPage ? (
              <div id="mobile-chat-slot" className="flex-1 flex items-center gap-2 min-w-0" />
            ) : (
              pageTitle && <h2 className="flex-1 text-sm font-semibold text-primary text-center">{pageTitle}</h2>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-subtle transition-colors flex-shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Page content — chat gets the full flex area, other pages get padded scroll */}
        {isChatPage ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pb-[72px] md:pb-0">
            <div className="w-full px-6 py-8 md:px-12 md:py-12">
              {children}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="absolute top-0 right-0 h-full w-64 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif font-bold text-primary">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-subtle transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-subtle text-primary'
                        : 'text-secondary hover:text-primary hover:bg-subtle/50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
              <p className="text-xs text-tertiary">Pincher</p>
              <p className="text-xs text-tertiary mt-1">© 2026 Friend Labs</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation - Quick Access */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border z-40 pb-safe">
        <div className="flex justify-around items-center p-2">
          {[navItems[0], navItems[1], navItems[2], navItems[3]].map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors ${
                  isActive ? 'text-primary' : 'text-tertiary hover:text-secondary'
                }`}
              >
                <Icon 
                  size={20} 
                  className={`transition-transform ${isActive ? '-translate-y-0.5' : ''}`}
                />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-colors text-tertiary hover:text-secondary"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium tracking-wide">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
