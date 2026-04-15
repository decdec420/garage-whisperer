import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Wrench, Settings, LogOut, Plus, Home, Grid3X3, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import RatchetFAB from '@/components/RatchetFAB';
import { toast } from 'sonner';
import RatchetPanel from '@/components/RatchetPanel';
import GlobalSearch from '@/components/GlobalSearch';
import NotificationCenter from '@/components/NotificationCenter';
import OnboardingFlow from '@/components/OnboardingFlow';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const sidebarNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Garage', icon: Car, path: '/garage' },
  { label: 'Active Work', icon: Wrench, path: '/active-work' },
];

const mobileNav = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Garage', icon: Car, path: '/garage' },
  { label: 'Active', icon: Wrench, path: '/active-work' },
  { label: 'Blueprint', icon: Grid3X3, path: '/blueprint' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeVehicle, setActiveVehicle, setAddVehicleModalOpen, isRatchetOpen } = useAppStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [logoSpinning, setLogoSpinning] = useState(false);
  const logoRef = useRef<HTMLButtonElement>(null);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    toast.error("You're offline — changes won't be saved until you reconnect", { id: 'offline', duration: Infinity });
  }, []);
  const handleOnline = useCallback(() => {
    setIsOffline(false);
    toast.dismiss('offline');
    toast.success('Back online');
  }, []);

  useEffect(() => {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [handleOffline, handleOnline]);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, trim, nickname, engine, mileage, drivetrain').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!vehicles) return;
    if (vehicles.length === 0) {
      setActiveVehicle(null);
      return;
    }
    const stillExists = vehicles.some(v => v.id === activeVehicle?.id);
    if (!activeVehicle || !stillExists) {
      const v = vehicles[0];
      setActiveVehicle({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, nickname: v.nickname, engine: v.engine, mileage: v.mileage });
    }
  }, [vehicles, activeVehicle, setActiveVehicle]);

  useEffect(() => {
    if (user && vehicles !== undefined && vehicles.length === 0) {
      const seen = localStorage.getItem(`ratchet-onboarded-${user.id}`);
      if (!seen) setShowOnboarding(true);
    }
  }, [user, vehicles]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    if (user) localStorage.setItem(`ratchet-onboarded-${user.id}`, 'true');
  };

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  const handleBlueprintMobile = () => {
    if (activeVehicle) navigate(`/garage/${activeVehicle.id}?tab=blueprint`);
    else navigate('/garage');
  };

  const handleLogoClick = () => {
    setLogoSpinning(true);
    setTimeout(() => setLogoSpinning(false), 600);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[9998] bg-destructive text-destructive-foreground text-center text-xs py-1.5 font-medium">
          You're offline — changes won't be saved until you reconnect
        </div>
      )}
      {showOnboarding && <OnboardingFlow name={profileName} onComplete={completeOnboarding} />}
      <GlobalSearch />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <div className="p-4 border-b border-sidebar-border">
          <button
            ref={logoRef}
            onClick={handleLogoClick}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <Wrench className={cn(
              "h-6 w-6 text-primary transition-transform duration-500",
              logoSpinning && "animate-[spin_0.5s_ease-in-out]"
            )} />
            <span className="text-xl font-bold text-primary group-hover:tracking-wide transition-all duration-300">
              Ratchet
            </span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarNav.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative group/nav',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground hover:bg-gradient-to-r hover:from-primary/[0.07] hover:to-transparent hover:text-sidebar-accent-foreground',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary animate-scale-pop" />
                )}
                <item.icon className="h-5 w-5 transition-transform duration-200 group-hover/nav:scale-110" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative group/nav',
              isActive('/settings')
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground hover:bg-gradient-to-r hover:from-primary/[0.07] hover:to-transparent hover:text-sidebar-accent-foreground',
            )}
          >
            {isActive('/settings') && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary animate-scale-pop" />
            )}
            <Settings className="h-5 w-5 transition-transform duration-200 group-hover/nav:scale-110" />
            Settings
          </button>
          <button
            onClick={() => navigate('/settings?tab=account')}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg bg-sidebar-accent/40 mt-2 hover:bg-sidebar-accent/60 transition-all cursor-pointer group/profile gradient-border"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary text-sm font-bold avatar-glow group-hover/profile:scale-105 transition-transform">
              {profileName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-sm font-medium truncate block group-hover/profile:text-primary transition-colors">{profileName}</span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover/profile:opacity-100 transition-opacity flex items-center gap-0.5">
                Your profile <ChevronRight className="h-2.5 w-2.5" />
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); signOut(); }}
              className="text-muted-foreground hover:text-destructive hover:rotate-[-12deg] transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 md:ml-60 pb-20 md:pb-0 transition-[margin] duration-300 overflow-x-hidden", isRatchetOpen && "md:mr-[420px]")}>
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-20">
          <button onClick={handleLogoClick} className="flex items-center gap-2 group">
            <Wrench className={cn(
              "h-5 w-5 text-primary transition-transform duration-500",
              logoSpinning && "animate-[spin_0.5s_ease-in-out]"
            )} />
            <span className="font-bold text-primary">Ratchet</span>
          </button>
          <NotificationCenter />
        </header>

        {/* Desktop top bar — notifications only */}
        <div className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b border-border">
          <NotificationCenter />
        </div>

        <div className="w-full mx-auto animate-page-enter max-w-[1100px]" key={location.pathname}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-xl z-30 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {mobileNav.map((item) => {
            const active = item.path === '/blueprint' ? false : isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => item.path === '/blueprint' ? handleBlueprintMobile() : navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1 min-h-[44px] justify-center relative',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <RatchetFAB />
      <RatchetPanel />
    </div>
  );
}
