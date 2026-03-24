import { create } from 'zustand';

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  nickname?: string | null;
  engine?: string | null;
  mileage?: number | null;
}

interface ProjectContext {
  id: string;
  title: string;
  vehicleId: string;
}

interface AppState {
  activeVehicleId: string | null;
  activeVehicle: Vehicle | null;
  setActiveVehicle: (vehicle: Vehicle | null) => void;
  setActiveVehicleId: (id: string | null) => void;
  addVehicleModalOpen: boolean;
  setAddVehicleModalOpen: (open: boolean) => void;
  // Ratchet panel state
  isRatchetOpen: boolean;
  ratchetPanelMode: 'default' | 'fullscreen';
  ratchetPrefilledMessage: string | null;
  ratchetProjectContext: ProjectContext | null;
  openRatchetPanel: (prefilledMessage?: string) => void;
  closeRatchetPanel: () => void;
  setRatchetPanelMode: (mode: 'default' | 'fullscreen') => void;
  setRatchetProjectContext: (ctx: ProjectContext | null) => void;
  // Open Ratchet with a specific session pre-loaded
  ratchetActiveSessionId: string | null;
  openRatchetWithSession: (sessionId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeVehicleId: null,
  activeVehicle: null,
  setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle, activeVehicleId: vehicle?.id ?? null }),
  setActiveVehicleId: (id) => set({ activeVehicleId: id }),
  addVehicleModalOpen: false,
  setAddVehicleModalOpen: (open) => set({ addVehicleModalOpen: open }),
  // Ratchet panel
  isRatchetOpen: false,
  ratchetPanelMode: 'default',
  ratchetPrefilledMessage: null,
  ratchetProjectContext: null,
  openRatchetPanel: (prefilledMessage?: string) => set({ isRatchetOpen: true, ratchetPrefilledMessage: prefilledMessage ?? null }),
  closeRatchetPanel: () => set({ isRatchetOpen: false, ratchetPrefilledMessage: null, ratchetActiveSessionId: null }),
  setRatchetPanelMode: (mode) => set({ ratchetPanelMode: mode }),
  setRatchetProjectContext: (ctx) => set({ ratchetProjectContext: ctx }),
  ratchetActiveSessionId: null,
  openRatchetWithSession: (sessionId) => set({ isRatchetOpen: true, ratchetActiveSessionId: sessionId, ratchetPrefilledMessage: null }),
}));
