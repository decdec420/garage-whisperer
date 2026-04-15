/**
 * Web Bluetooth BLE Connection Manager for ELM327-compatible OBD-II adapters.
 *
 * Handles device discovery, GATT connection, and characteristic read/write
 * for standard ELM327 BLE dongles (including GOOLOO DS200).
 */

// Common ELM327 BLE service/characteristic UUIDs
// Most clones use the "FFE0" service with "FFE1" characteristic
const ELM327_SERVICE_UUIDS = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Most common
  '0000fff0-0000-1000-8000-00805f9b34fb', // Some clones
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Vgate / iCar
];

const ELM327_CHAR_UUIDS = [
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fff1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

export type BLEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BLEManagerEvents {
  onStateChange: (state: BLEConnectionState) => void;
  onData: (data: string) => void;
  onError: (error: Error) => void;
}

export class BLEManager {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private readChar: BluetoothRemoteGATTCharacteristic | null = null;
  private events: BLEManagerEvents;
  private state: BLEConnectionState = 'disconnected';
  private responseBuffer = '';

  constructor(events: BLEManagerEvents) {
    this.events = events;
  }

  get connectionState() {
    return this.state;
  }

  get deviceName() {
    return this.device?.name || 'Unknown Scanner';
  }

  /** Check if Web Bluetooth API is available in this browser */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /** Request and connect to an ELM327 BLE device */
  async connect(): Promise<void> {
    if (!BLEManager.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on Desktop or Android.');
    }

    this.setState('connecting');

    try {
      // Request device with known ELM327 service UUIDs
      this.device = await navigator.bluetooth.requestDevice({
        filters: ELM327_SERVICE_UUIDS.map(uuid => ({ services: [uuid] })),
        optionalServices: ELM327_SERVICE_UUIDS,
      }).catch(() => {
        // Fallback: accept any device (user picks manually)
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ELM327_SERVICE_UUIDS,
        });
      });

      if (!this.device) {
        this.setState('disconnected');
        return;
      }

      this.device.addEventListener('gattserverdisconnected', () => {
        this.setState('disconnected');
        this.cleanup();
      });

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();

      // Find the right service + characteristic
      let service: BluetoothRemoteGATTService | null = null;
      for (const uuid of ELM327_SERVICE_UUIDS) {
        try {
          service = await this.server.getPrimaryService(uuid);
          break;
        } catch {
          continue;
        }
      }

      if (!service) {
        throw new Error('No compatible OBD service found on this device.');
      }

      // Find read/write characteristics
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          this.writeChar = c;
        }
        if (c.properties.notify || c.properties.read) {
          this.readChar = c;
        }
      }

      if (!this.writeChar) {
        throw new Error('No writable characteristic found. Device may not be ELM327-compatible.');
      }

      // Subscribe to notifications for responses
      if (this.readChar && this.readChar.properties.notify) {
        await this.readChar.startNotifications();
        this.readChar.addEventListener('characteristicvaluechanged', this.handleNotification);
      }

      this.setState('connected');
    } catch (err: any) {
      this.setState('error');
      this.events.onError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /** Disconnect from the device */
  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.cleanup();
    this.setState('disconnected');
  }

  /** Send a raw AT/OBD command and wait for the response */
  async sendCommand(command: string, timeoutMs = 5000): Promise<string> {
    if (!this.writeChar) {
      throw new Error('Not connected to a scanner.');
    }

    this.responseBuffer = '';

    const encoder = new TextEncoder();
    const data = encoder.encode(command + '\r');

    if (this.writeChar.properties.writeWithoutResponse) {
      await this.writeChar.writeValueWithoutResponse(data);
    } else {
      await this.writeChar.writeValue(data);
    }

    // Wait for response terminated by '>' prompt
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(this.responseBuffer.trim());
      }, timeoutMs);

      const checkBuffer = setInterval(() => {
        if (this.responseBuffer.includes('>')) {
          clearTimeout(timeout);
          clearInterval(checkBuffer);
          const response = this.responseBuffer
            .replace(/>/g, '')
            .replace(/\r/g, '')
            .trim();
          resolve(response);
        }
      }, 50);
    });
  }

  private handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;

    const decoder = new TextDecoder();
    const chunk = decoder.decode(value);
    this.responseBuffer += chunk;
    this.events.onData(chunk);
  };

  private setState(state: BLEConnectionState) {
    this.state = state;
    this.events.onStateChange(state);
  }

  private cleanup() {
    if (this.readChar) {
      try {
        this.readChar.removeEventListener('characteristicvaluechanged', this.handleNotification);
      } catch {}
    }
    this.writeChar = null;
    this.readChar = null;
    this.server = null;
    this.responseBuffer = '';
  }
}
