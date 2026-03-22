import { useAppStore } from '@/stores/app-store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wrench, ArrowRight } from 'lucide-react';

export default function Maintenance() {
  const { activeVehicle } = useAppStore();
  const navigate = useNavigate();

  if (!activeVehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
        <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium">Select a vehicle first</p>
        <p className="text-sm text-muted-foreground mb-4">Go to your garage and select a vehicle to view maintenance.</p>
        <Button onClick={() => navigate('/garage')}>Go to Garage <ArrowRight className="h-4 w-4 ml-1" /></Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4">Maintenance — {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}</h1>
      <p className="text-muted-foreground mb-6">View and manage maintenance for this vehicle on the vehicle detail page.</p>
      <Button onClick={() => navigate(`/garage/${activeVehicle.id}`)}>
        View Vehicle Details <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
