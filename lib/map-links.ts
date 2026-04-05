/** OpenStreetMap centered on a point (same pattern as mobility detail links). */
export function openStreetMapPinUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export function locationLineFromAddressOrCoords(
  address: string | null | undefined,
  lat: number,
  lng: number
): string {
  if (address?.trim()) return address.trim();
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
