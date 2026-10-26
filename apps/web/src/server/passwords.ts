import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Fixed parameters prevent database values from choosing unbounded work or memory.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const parts = stored?.split('$');
  const valid = parts?.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]!) && /^[a-f0-9]{128}$/.test(parts[2]!);
  // Missing users still perform the same expensive derivation as existing accounts.
  const key = await derive(password, valid ? parts[1]! : '00000000000000000000000000000000');
  return Boolean(valid && timingSafeEqual(key, Buffer.from(parts![2]!, 'hex')));
}
