import type { StopInput } from "../types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    "accept-language": "en",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (results.length === 0) {
    return null;
  }

  const [first] = results;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    displayName: first.display_name,
  };
}

export async function resolveStops(
  inputs: StopInput[],
  onProgress?: (current: number, total: number) => void,
): Promise<
  Array<
    | { ok: true; stop: StopInput & { lat: number; lng: number; resolvedAddress?: string } }
    | { ok: false; input: StopInput; error: string }
  >
> {
  const results: Array<
    | { ok: true; stop: StopInput & { lat: number; lng: number; resolvedAddress?: string } }
    | { ok: false; input: StopInput; error: string }
  > = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    onProgress?.(i + 1, inputs.length);

    if (input.lat != null && input.lng != null) {
      results.push({
        ok: true,
        stop: {
          ...input,
          lat: input.lat,
          lng: input.lng,
        },
      });
      continue;
    }

    if (input.address?.trim()) {
      await sleep(1100);
      try {
        const geocoded = await geocodeAddress(input.address.trim());
        if (!geocoded) {
          results.push({
            ok: false,
            input,
            error: `Address not found: ${input.address}`,
          });
          continue;
        }
        results.push({
          ok: true,
          stop: {
            ...input,
            lat: geocoded.lat,
            lng: geocoded.lng,
            resolvedAddress: geocoded.displayName,
          },
        });
      } catch (error) {
        results.push({
          ok: false,
          input,
          error: error instanceof Error ? error.message : "Geocoding failed",
        });
      }
      continue;
    }

    results.push({
      ok: false,
      input,
      error: "Coordinates (lat/lng) or address required",
    });
  }

  return results;
}
