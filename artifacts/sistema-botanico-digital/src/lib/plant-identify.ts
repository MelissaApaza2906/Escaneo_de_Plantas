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

export type WikipediaDetails = {
  description: string | null;
  habitat: string | null;
  uses: string | null;
};

const WIKI_HABITAT_HEADING = /h[aá]bitat|distribuci[oó]n|morfolog[ií]a/i;
// "medicina" (not just "medicinal") also matches "Medicina tradicional" /
// "Medicina popular", both very common section titles in plant articles.
const WIKI_USES_HEADING = /\buso|utiliza|aplicaci[oó]n|importancia econ[oó]mica|medicina|etnobot[aá]nic/i;

function truncateWikiText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastPeriod = cut.lastIndexOf('. ');
  const base = lastPeriod > maxLength * 0.5 ? cut.slice(0, lastPeriod + 1) : cut;
  return `${base.trim()}…`;
}

function splitWikiSections(fullText: string): { intro: string; sections: { title: string; body: string }[] } {
  const headingPattern = /\n={2,}\s*(.+?)\s*={2,}\n/g;
  const matches = [...fullText.matchAll(headingPattern)];
  if (matches.length === 0) return { intro: fullText.trim(), sections: [] };

  const intro = fullText.slice(0, matches[0].index).trim();
  const sections = matches.map((match, i) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? fullText.length) : fullText.length;
    return { title: match[1], body: fullText.slice(start, end).trim() };
  });
  return { intro, sections };
}

/**
 * Fallback plant info from the Spanish Wikipedia article, used when neither
 * Perenual nor the local catalog have a field: the intro paragraph as a
 * general description, plus (when present) the habitat/distribution section
 * and a "uses"-like section (many plant articles have one, under varying
 * headings — "Usos", "Uso en la medicina tradicional", "Importancia
 * económica y cultural", etc., so this matches by keyword, not exact title).
 */
export async function getWikipediaDetails(scientificName: string): Promise<WikipediaDetails> {
  const empty: WikipediaDetails = { description: null, habitat: null, uses: null };
  const title = scientificName.trim().replace(/\s+/g, '_');
  const url = `https://es.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = (await response.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
    const pages = data.query?.pages ?? {};

    for (const pageId of Object.keys(pages)) {
      const extract = pages[pageId]?.extract?.trim();
      if (!extract) continue;

      const { intro, sections } = splitWikiSections(extract);
      // Some headings (e.g. "Importancia económica y cultural") are empty
      // containers whose real content lives in level-3 subsections that
      // follow ("Medicina popular", "Usos culinarios", ...) — both are just
      // "sections" once flattened, so skip empty ones rather than stopping
      // at a matching title with nothing under it.
      const hasBody = (section: { body: string }) => section.body.length > 0;
      const habitatSection = sections.find((section) => WIKI_HABITAT_HEADING.test(section.title) && hasBody(section));
      const usesSection = sections.find((section) => WIKI_USES_HEADING.test(section.title) && hasBody(section));

      return {
        description: intro ? truncateWikiText(intro, 500) : null,
        habitat: habitatSection ? truncateWikiText(habitatSection.body, 400) : null,
        uses: usesSection ? truncateWikiText(usesSection.body, 400) : null,
      };
    }
  } catch {
    // No Wikipedia data available; caller shows "No disponible".
  }

  return empty;
}

/**
 * Last-resort habitat/distribution note from GBIF (no API key required) when
 * neither Perenual, the local catalog, nor Wikipedia's habitat section have
 * anything. GBIF has no care or "uses" data at all — it's occurrence and
 * taxonomy only — so this only ever contributes to "características", never
 * to "utilidad".
 */
export async function getGbifHabitat(scientificName: string): Promise<string | null> {
  try {
    const matchUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`;
    const matchResponse = await fetch(matchUrl, { signal: AbortSignal.timeout(5000) });
    const match = (await matchResponse.json()) as {
      usageKey?: number;
      matchType?: string;
      confidence?: number;
    };
    if (!match.usageKey || match.matchType === 'NONE' || (match.confidence ?? 0) < 80) return null;

    const occurrenceUrl = `https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&limit=0&facet=country&facetLimit=5`;
    const occurrenceResponse = await fetch(occurrenceUrl, { signal: AbortSignal.timeout(5000) });
    const occurrence = (await occurrenceResponse.json()) as {
      facets?: { field: string; counts: { name: string; count: number }[] }[];
    };
    const codes = occurrence.facets?.find((facet) => facet.field === 'COUNTRY')?.counts.map((c) => c.name) ?? [];
    if (codes.length === 0) return null;

    const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
    const names = codes.map((code) => regionNames.of(code) ?? code);

    return `Registrada en ${names.join(', ')} (datos de GBIF).`;
  } catch {
    return null;
  }
}
