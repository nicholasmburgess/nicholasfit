import { BleManager, type Device } from "react-native-ble-plx";

/**
 * One Bluetooth manager and one scan shared by every sensor (heart rate strap, Concept2 PM5).
 * iOS runs a single scan per manager, so each sensor registers what it's looking for and the
 * scan covers all of them, stopping once nobody is looking.
 */
let manager: BleManager | null = null;
export const ble = () => (manager ??= new BleManager());

type Want = { service: string; onFound: (d: Device) => void };
const wants = new Map<number, Want>();
let nextId = 1;
let scanningFor = "";

function restart() {
  const services = [...new Set([...wants.values()].map((w) => w.service))].sort();
  const key = services.join(",");
  if (key === scanningFor) return;
  ble().stopDeviceScan();
  scanningFor = key;
  if (!services.length) return;
  ble().startDeviceScan(services, null, (error, found) => {
    if (error) {
      // e.g. Bluetooth switched off: let the next request start a fresh scan.
      scanningFor = "";
      return;
    }
    if (!found) return;
    const ads = (found.serviceUUIDs ?? []).map((u) => u.toLowerCase());
    // iOS only reports devices advertising one of our services; if it's only one, there's no doubt which.
    const match = [...wants].find(([, w]) => ads.includes(w.service)) ?? (services.length === 1 ? [...wants][0] : undefined);
    if (!match) return;
    wants.delete(match[0]);
    match[1].onFound(found);
    restart();
  });
}

/** Look for the first device advertising `service`. Returns a cancel function. */
export function findDevice(service: string, onFound: (d: Device) => void): () => void {
  const id = nextId++;
  wants.set(id, { service: service.toLowerCase(), onFound });
  restart();
  return () => {
    if (wants.delete(id)) restart();
  };
}

/** base64 characteristic value -> bytes. */
export const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
