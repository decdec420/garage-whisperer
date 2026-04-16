import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Bluetooth, BluetoothOff, RefreshCw, Trash2, Zap, Activity,
  Thermometer, Battery, Gauge, Fuel, Wind, AlertTriangle, Search, Clock, Wrench
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { BLEManager, type BLEConnectionState } from '@/lib/obd/ble-manager';
import { initializeELM327, queryPID, getSupportedPIDs } from '@/lib/obd/elm327';
import { decodePIDResponse, DASHBOARD_PIDS, getPIDGaugeRange, type PIDReading } from '@/lib/obd/pid-decoder';
import { readAllDTCs, clearDTCs, type DTCCode } from '@/lib/obd/dtc-reader';

const PID_ICONS: Record<string, typeof Activity> = {
  '0C': Gauge,
  '05': Thermometer,
  '42': Battery,
  '04': Activity,
  '0D': Zap,
  '11': Wind,
  '2F': Fuel,
  '5C': Thermometer,
};

interface ScannerTabProps {
  vehicleId: string;
  vehicle: any;
}

export default function ScannerTab({ vehicleId, vehicle }: ScannerTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bleRef = useRef<BLEManager | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connectionState, setConnectionState] = useState<BLEConnectionState>('disconnected');
  const [scannerName, setScannerName] = useState('');
  const [adapterInfo, setAdapterInfo] = useState('');
  const [liveReadings, setLiveReadings] = useState<Map<string, PIDReading>>(new Map());
  const [supportedPIDs, setSupportedPIDs] = useState<Set<string>>(new Set());
  const [dtcs, setDtcs] = useState<DTCCode[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isReadingCodes, setIsReadingCodes] = useState(false);
  const [isClearingCodes, setIsClearingCodes] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      bleRef.current?.disconnect();
    };
  }, []);

  const handleConnect = useCallback(async () => {
    const ble = new BLEManager({
      onStateChange: (state) => {
        setConnectionState(state);
        if (state === 'disconnected') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsScanning(false);
        }
      },
      onData: () => {},
      onError: (err) => {
        toast({ title: 'Scanner Error', description: err.message, variant: 'destructive' });
      },
    });

    bleRef.current = ble;

    try {
      await ble.connect();
      setScannerName(ble.deviceName);

      // Initialize ELM327
      const info = await initializeELM327(ble);
      setAdapterInfo(info);

      // Get supported PIDs
      const pids = await getSupportedPIDs(ble);
      setSupportedPIDs(pids);

      toast({ title: 'Scanner Connected', description: `${ble.deviceName} ready. ${pids.size} PIDs supported.` });
    } catch {
      // Error handled by onError callback
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    await bleRef.current?.disconnect();
    setLiveReadings(new Map());
    setSupportedPIDs(new Set());
    setDtcs([]);
    setIsScanning(false);
  }, []);

  const startLiveScanning = useCallback(async () => {
    if (!bleRef.current || connectionState !== 'connected') return;
    setIsScanning(true);

    const pidsToRead = DASHBOARD_PIDS.filter(p => supportedPIDs.has(p));
    if (pidsToRead.length === 0) {
      toast({ title: 'No PIDs', description: 'Scanner doesn\'t support any dashboard PIDs.', variant: 'destructive' });
      setIsScanning(false);
      return;
    }

    const pollOnce = async () => {
      if (!bleRef.current || bleRef.current.connectionState !== 'connected') return;
      for (const pid of pidsToRead) {
        try {
          const lines = await queryPID(bleRef.current, `01${pid}`);
          for (const line of lines) {
            const reading = decodePIDResponse(line);
            if (reading) {
              setLiveReadings(prev => new Map(prev).set(reading.pid, reading));
            }
          }
        } catch {
          // Skip failed PID reads
        }
      }
    };

    await pollOnce();
    pollingRef.current = setInterval(pollOnce, 2000);
  }, [connectionState, supportedPIDs]);

  const stopLiveScanning = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setIsScanning(false);
  }, []);

  const handleReadCodes = useCallback(async () => {
    if (!bleRef.current) return;
    setIsReadingCodes(true);
    try {
      const codes = await readAllDTCs(bleRef.current);
      setDtcs(codes);

      // Save to dtc_records table
      if (codes.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const dtc of codes) {
            await supabase.from('dtc_records').upsert({
              vehicle_id: vehicleId,
              code: dtc.code,
              status: 'active',
              severity: dtc.type === 'pending' ? 'low' : 'medium',
              description: `Scanned via OBD-II (${dtc.type})`,
              read_date: new Date().toISOString(),
            }, { onConflict: 'vehicle_id,code' }).select();
          }
          queryClient.invalidateQueries({ queryKey: ['active-dtcs', vehicleId] });
        }
      }

      // Log scan session
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('obd_scan_sessions').insert([{
          vehicle_id: vehicleId,
          user_id: user.id,
          scanner_name: scannerName,
          dtcs_found: codes as any,
          pids_captured: Array.from(liveReadings.values()) as any,
          status: 'completed',
        }]);
      }

      toast({
        title: codes.length > 0 ? `${codes.length} Code${codes.length > 1 ? 's' : ''} Found` : 'All Clear!',
        description: codes.length > 0
          ? codes.map(c => c.code).join(', ')
          : 'No diagnostic trouble codes detected.',
      });
    } catch (err: any) {
      toast({ title: 'Failed to read codes', description: err.message, variant: 'destructive' });
    } finally {
      setIsReadingCodes(false);
    }
  }, [vehicleId, scannerName, liveReadings, queryClient]);

  const handleClearCodes = useCallback(async () => {
    if (!bleRef.current) return;
    setIsClearingCodes(true);
    try {
      const success = await clearDTCs(bleRef.current);
      if (success) {
        setDtcs([]);
        // Update dtc_records
        await supabase.from('dtc_records')
          .update({ status: 'cleared', cleared_date: new Date().toISOString() })
          .eq('vehicle_id', vehicleId)
          .eq('status', 'active');
        queryClient.invalidateQueries({ queryKey: ['active-dtcs', vehicleId] });
        toast({ title: 'Codes Cleared', description: 'All DTCs and freeze frame data cleared.' });
      } else {
        toast({ title: 'Clear Failed', description: 'Could not clear codes. Try again.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Clear Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsClearingCodes(false);
    }
  }, [vehicleId, queryClient]);

  if (!BLEManager.isSupported()) {
    return (
      <div className="mt-4 space-y-4">
        <Card className="border-amber-500/30">
          <CardContent className="p-6 text-center space-y-3">
            <BluetoothOff className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold">Web Bluetooth Not Available</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your browser doesn't support Web Bluetooth. Use <strong>Chrome on Desktop or Android</strong> to connect your OBD-II scanner.
              iOS requires the native app (coming soon).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Connection Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                connectionState === 'connected' ? 'bg-green-500/20 text-green-500' :
                connectionState === 'connecting' ? 'bg-amber-500/20 text-amber-500' :
                'bg-muted text-muted-foreground'
              }`}>
                {connectionState === 'connected' ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {connectionState === 'connected' ? scannerName : connectionState === 'connecting' ? 'Connecting...' : 'No Scanner Connected'}
                </p>
                {adapterInfo && <p className="text-xs text-muted-foreground">{adapterInfo}</p>}
                {connectionState === 'connected' && (
                  <p className="text-xs text-muted-foreground">{supportedPIDs.size} PIDs supported</p>
                )}
              </div>
            </div>
            {connectionState === 'connected' ? (
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnect} disabled={connectionState === 'connecting'}>
                <Bluetooth className="h-4 w-4 mr-1" />
                {connectionState === 'connecting' ? 'Pairing...' : 'Connect Scanner'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {connectionState === 'connected' && (
        <>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {isScanning ? (
              <Button variant="outline" onClick={stopLiveScanning}>
                <Activity className="h-4 w-4 mr-1 animate-pulse" /> Stop Live Data
              </Button>
            ) : (
              <Button onClick={startLiveScanning}>
                <Activity className="h-4 w-4 mr-1" /> Start Live Data
              </Button>
            )}
            <Button variant="outline" onClick={handleReadCodes} disabled={isReadingCodes}>
              <Search className="h-4 w-4 mr-1" />
              {isReadingCodes ? 'Reading...' : 'Read Codes'}
            </Button>
            {dtcs.length > 0 && (
              <Button variant="destructive" onClick={handleClearCodes} disabled={isClearingCodes}>
                <Trash2 className="h-4 w-4 mr-1" />
                {isClearingCodes ? 'Clearing...' : 'Clear Codes'}
              </Button>
            )}
          </div>

          {/* Live Gauges */}
          {liveReadings.size > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Live Data
                {isScanning && <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from(liveReadings.values()).map(reading => {
                  const Icon = PID_ICONS[reading.pid] || Activity;
                  const range = getPIDGaugeRange(reading.pid);
                  const pct = Math.min(100, Math.max(0, ((reading.value - range.min) / (range.max - range.min)) * 100));
                  const isHigh = pct > 85;
                  const isLow = pct < 15 && reading.pid === '42'; // Low battery warning

                  return (
                    <Card key={reading.pid} className={`${isHigh || isLow ? 'border-amber-500/40' : ''}`}>
                      <CardContent className="p-3 text-center">
                        <Icon className={`h-4 w-4 mx-auto mb-1 ${isHigh || isLow ? 'text-amber-500' : 'text-primary'}`} />
                        <p className="text-xs text-muted-foreground">{reading.name}</p>
                        <p className="text-xl font-bold tabular-nums">
                          {reading.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </p>
                        <p className="text-xs text-muted-foreground">{reading.unit}</p>
                        {/* Mini progress bar */}
                        <div className="h-1 bg-secondary rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHigh ? 'bg-amber-500' : isLow ? 'bg-destructive' : 'bg-primary'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* DTC Results */}
          {dtcs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Trouble Codes ({dtcs.length})
              </h3>
              <div className="space-y-2">
                {dtcs.map(dtc => (
                  <Card key={dtc.code} className="border-amber-500/20">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={dtc.type === 'pending' ? 'secondary' : 'destructive'} className="font-mono">
                          {dtc.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{dtc.type}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => navigate(`/garage/${vehicleId}?tab=diagnose&dtc=${encodeURIComponent(dtc.code)}`)}
                      >
                        <Search className="h-3 w-3 mr-1" /> Diagnose
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when connected but no data yet */}
          {liveReadings.size === 0 && dtcs.length === 0 && !isScanning && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-2">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">Scanner Ready</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hit "Start Live Data" to see real-time engine stats, or "Read Codes" to check for trouble codes.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Disconnected hint */}
      {connectionState === 'disconnected' && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <Bluetooth className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">Connect Your OBD-II Scanner</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Plug your ELM327-compatible Bluetooth scanner into your vehicle's OBD-II port and tap "Connect Scanner."
              Works with GOOLOO DS200, Vgate iCar, and most BLE adapters.
            </p>
            <p className="text-xs text-muted-foreground">
              Make sure your engine is running or ignition is on.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scan History */}
      <ScanHistory vehicleId={vehicleId} />
    </div>
  );
}

// ─── Scan History sub-component ───
function ScanHistory({ vehicleId }: { vehicleId: string }) {
  const navigate = useNavigate();
  const { data: scanSessions, isLoading } = useQuery({
    queryKey: ['obd-scan-sessions', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obd_scan_sessions')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!vehicleId,
  });

  if (isLoading || !scanSessions?.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Scan History
      </h3>
      <div className="space-y-2">
        {scanSessions.map((session: any) => {
          const dtcsFound = (session.dtcs_found as any[]) || [];
          const pidsCount = ((session.pids_captured as any[]) || []).length;
          return (
            <Card key={session.id} className="border-border">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-lg ${dtcsFound.length > 0 ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                    {dtcsFound.length > 0
                      ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      : <Activity className="h-3.5 w-3.5 text-green-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {dtcsFound.length > 0
                        ? `${dtcsFound.length} code${dtcsFound.length > 1 ? 's' : ''}: ${dtcsFound.map((d: any) => d.code).join(', ')}`
                        : 'All clear — no codes'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString()} · {session.scanner_name || 'Unknown scanner'}
                      {pidsCount > 0 && ` · ${pidsCount} PID readings`}
                    </p>
                  </div>
                </div>
                {dtcsFound.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs shrink-0"
                    onClick={() => navigate(`/garage/${vehicleId}?tab=diagnose&dtc=${encodeURIComponent((dtcsFound[0] as any).code)}`)}>
                    <Search className="h-3 w-3 mr-1" /> Diagnose
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
