import { toByteArray } from 'react-native-quick-base64';
import type { ParsedBPMeasurement } from '../types/bloodpressure.types';
import { writeBloodPressureHC } from './healthConnect.service';

/**
 * Parse a BLE Blood Pressure Measurement characteristic value.
 * Spec: Bluetooth SIG Assigned Numbers – Blood Pressure Profile (BLP)
 * Encoding: IEEE 11073-20601 SFLOAT with a leading flags byte.
 */
export function parseBPMeasurement(base64: string): ParsedBPMeasurement | null {
  try {
    const bytes = toByteArray(base64);
    if (bytes.length < 7) return null;

    const flags = bytes[0];
    const kPa = (flags & 0x01) !== 0; // 0 = mmHg, 1 = kPa

    const toSFloat = (lo: number, hi: number): number => {
      const raw = (hi << 8) | lo;
      let mantissa = raw & 0x0fff;
      if (mantissa >= 0x0800) mantissa -= 0x1000;
      const exp = (raw >> 12) & 0x0f;
      const eAdjusted = exp >= 8 ? exp - 16 : exp;
      return mantissa * Math.pow(10, eAdjusted);
    };

    let sys = toSFloat(bytes[1], bytes[2]);
    let dia = toSFloat(bytes[3], bytes[4]);

    if (kPa) {
      sys = Math.round(sys * 7.50062);
      dia = Math.round(dia * 7.50062);
    }

    const hasPulse = (flags & 0x04) !== 0;
    const pulse = hasPulse ? toSFloat(bytes[14], bytes[15]) : undefined;

    return {
      systolic: Math.round(sys),
      diastolic: Math.round(dia),
      pulse: pulse ? Math.round(pulse) : undefined,
    };
  } catch {
    return null;
  }
}

export const saveBloodPressureToHealthConnect = async (
  systolic: number,
  diastolic: number,
) => writeBloodPressureHC(systolic, diastolic);
