import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, MessageCircle, Wrench, Settings, LogOut, ChevronDown, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/app-store';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Garage', icon: Car, path: '/garage' },
  { label: 'AI Mechanic', icon: MessageCircle, path: '/chat', accent: true },
  { label: 'Maintenance', icon: Wrench, path: '/maintenance' },
  { label: 'Repairs', icon: Settings, path: '/repairs' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeVehicle, setActiveVehicle, setAddVehicleModalOpen } = useAppStore();

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, year, make, model, trim, nickname').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-select first vehicle if none active
  if (vehicles?.length && !activeVehicle) {
    const v = vehicles[0];
    setActiveVehicle({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, nickname: v.nickname });
  }

  const profileName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-30">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-primary">GarageOS</span>
          </div>

          {/* Vehicle Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between rounded-lg border border-border bg-popover px-3 py-2 text-sm hover:border-primary/50 transition-colors">
                <span className="truncate text-left">
                  {activeVehicle ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : 'Select vehicle'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {vehicles?.map((v) => (
                <DropdownMenuItem key={v.id} onClick={() => setActiveVehicle({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, nickname: v.nickname })}>
                  <span className="truncate">{v.nickname || `${v.year} ${v.make} ${v.model}`}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAddVehicleModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add vehicle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  item.accent && !active && 'text-primary'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {profileName[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium truncate flex-1">{profileName}</span>
            <button onClick={() => navigate('/settings')} className="text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={signOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-20">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <span className="font-bold text-primary">GarageOS</span>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {activeVehicle ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}` : ''}
          </span>
        </header>

        <div className="max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background z-30 safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-1 min-h-[44px] justify-center',
                  active ? 'text-primary' : 'text-muted-foreground',
                  item.accent && !active && 'text-primary'
                )}
              >
                <item.icon className={cn('h-5 w-5', item.accent && 'h-6 w-6')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
