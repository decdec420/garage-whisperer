import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, Wrench, Settings, LogOut, ChevronDown, Plus, Home, Grid3X3, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    // If no active vehicle, or the active vehicle was deleted, switch to the first available
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
          <div className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">Ratchet</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarNav.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive('/settings') ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Settings className="h-5 w-5" />
            Settings
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {profileName[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate flex-1">{profileName}</span>
            <button onClick={signOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 md:ml-60 pb-20 md:pb-0 transition-[margin] duration-300 overflow-x-hidden", isRatchetOpen && "md:mr-[420px]")}>
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-20">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">Ratchet</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Desktop top bar with notifications */}
        <div className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b border-border">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
            <kbd className="text-[10px] bg-secondary px-1.5 py-0.5 rounded ml-2">⌘K</kbd>
          </button>
          <NotificationCenter />
        </div>

        <div className="w-full mx-auto animate-page-enter max-w-[1100px]" key={location.pathname}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-30 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {mobileNav.map((item) => {
            const active = item.path === '/blueprint' ? false : isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => item.path === '/blueprint' ? handleBlueprintMobile() : navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1 min-h-[44px] justify-center',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
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
