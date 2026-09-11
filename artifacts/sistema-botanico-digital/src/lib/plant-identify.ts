export type PlantIdentifyMatch = {
  scientificName: string;
  family: string | null;
  genus: string | null;
  commonNames: string[];
  score: number;
};

export type PlantIdentifyResult = {
  bestMatch: string | null;
  remainingRequests: number | null;
  matches: PlantIdentifyMatch[];
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
