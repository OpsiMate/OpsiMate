import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Remove duplicate objects from an array based on a key
 */
export function removeDuplicates<T>(array: T[], key: keyof T): T[] {
  return Array.from(new Map(array.map((item) => [item[key], item])).values());
}
