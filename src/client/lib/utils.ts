import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPoints(value: number): string {
  return value.toLocaleString('vi-VN');
}

export function formatDelta(value: number): string {
  const abs = Math.abs(value).toLocaleString('vi-VN');
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return '0';
}
