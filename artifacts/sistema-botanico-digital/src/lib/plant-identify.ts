export type PlantIdentifyMatch = {
  scientificName: string;
  family: string | null;
  genus: string | null;
  commonNames: string[];
  score: number;
};

export type PlantEnrichment = {
  commonName: string | null;
  scientificName: string;
  description: string | null;
  watering: string | null;
  sunlight: string | null;
  growth: string | null;
  utility: string | null;
  source: 'perenual' | 'none';
};

export type PlantIdentifyResult = {
  bestMatch: string | null;
  remainingRequests: number | null;
  matches: PlantIdentifyMatch[];
  enrichment: PlantEnrichment | null;
};

export type PlantOrgan = 'leaf' | 'flower' | 'fruit' | 'bark' | 'habit' | 'other' | 'auto';

export async function identifyPlant(image: Blob, organ: PlantOrgan = 'auto'): Promise<PlantIdentifyResult> {
  const response = await fetch(`/api/plant-identify?organ=${encodeURIComponent(organ)}`, {
    method: 'POST',
    headers: { 'Content-Type': image.type || 'image/jpeg' },
    body: image,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error || `No se pudo identificar la planta (HTTP ${response.status}).`);
  }

  return response.json() as Promise<PlantIdentifyResult>;
}

/**
 * Last-resort fallback for a plant description when neither Perenual nor the
 * local catalog have data for a species: the intro paragraph of the Spanish
 * Wikipedia article, if one exists.
 */
export async function getWikipediaSummary(scientificName: string): Promise<string | null> {
  const title = scientificName.trim().replace(/\s+/g, '_');
  const url = `https://es.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await response.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = data.query?.pages ?? {};
    for (const pageId of Object.keys(pages)) {
      const extract = pages[pageId]?.extract?.trim();
      if (extract) return extract;
    }
  } catch {
    // No Wikipedia summary available; caller shows "No disponible".
  }
  return null;
}
