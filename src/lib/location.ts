export function formatLocationLabel({
  spaceName,
  floorName,
  fallback = "Property",
}: {
  spaceName?: string | null;
  floorName?: string | null;
  fallback?: string;
}) {
  if (spaceName) return floorName ? `${spaceName} · ${floorName}` : spaceName;
  return floorName || fallback;
}
