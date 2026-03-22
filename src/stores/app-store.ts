import { create } from 'zustand';

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  nickname?: string | null;
}

interface AppState {
  activeVehicleId: string | null;
  activeVehicle: Vehicle | null;
  setActiveVehicle: (vehicle: Vehicle | null) => void;
  setActiveVehicleId: (id: string | null) => void;
  addVehicleModalOpen: boolean;
  setAddVehicleModalOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeVehicleId: null,
  activeVehicle: null,
  setActiveVehicle: (vehicle) => set({ activeVehicle: vehicle, activeVehicleId: vehicle?.id ?? null }),
  setActiveVehicleId: (id) => set({ activeVehicleId: id }),
  addVehicleModalOpen: false,
  setAddVehicleModalOpen: (open) => set({ addVehicleModalOpen: open }),
}));
