// General utilities — port of v2 www/js/general.js. Pure, framework-free.

export function exists<T>(array: T[], element: T): boolean {
  return array.some((l) => l == element)
}

export function getUniqueValues<T>(array: T[]): T[] {
  return [...new Set(array)]
}

export function getCaseInsensitiveIndices(
  array: string[],
  element: string
): number[] {
  const target = element.toLowerCase()
  const indexes: number[] = []
  for (let i = 0; i < array.length; i++)
    if (array[i].toLowerCase() === target) indexes.push(i)
  return indexes
}

// Position of a Three.js object's uuid in an array (-1 if absent).
export function findIndexByUuid(
  array: { uuid: string }[],
  uuid: string
): number {
  return array.findIndex((object) => object.uuid === uuid)
}

// Random float in [min, max).
export function getRandomArbitrary(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function toRadians(angle: number): number {
  return angle * (Math.PI / 180)
}

export const delay_ms = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms))
