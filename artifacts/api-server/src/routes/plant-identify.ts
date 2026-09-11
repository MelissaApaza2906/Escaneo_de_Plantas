import { Router, type IRouter, raw } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ORGANS = new Set(["leaf", "flower", "fruit", "bark", "habit", "other", "auto"]);
const PLANTNET_PROJECT = process.env["PLANTNET_PROJECT"] || "all";
const PERENUAL_SPECIES_LIST_URL = "https://perenual.com/api/species-list";
const PERENUAL_SPECIES_DETAILS_URL = "https://perenual.com/api/species/details";
const PERENUAL_TIMEOUT_MS = 5000;

interface PlantNetSpecies {
  scientificNameWithoutAuthor: string;
  family?: { scientificNameWithoutAuthor?: string };
  genus?: { scientificNameWithoutAuthor?: string };
  commonNames?: string[];
}

interface PlantNetResult {
  score: number;
  species: PlantNetSpecies;
}

interface PlantNetResponse {
  bestMatch?: string;
  results?: PlantNetResult[];
  remainingIdentificationRequests?: number;
}

export interface PlantIdentifyMatch {
  scientificName: string;
  family: string | null;
  genus: string | null;
  commonNames: string[];
  score: number;
}

export interface PlantEnrichment {
  commonName: string | null;
  scientificName: string;
  description: string | null;
  watering: string | null;
  sunlight: string | null;
  growth: string | null;
  utility: string | null;
  source: "perenual" | "none";
}

export interface PlantIdentifyResponseBody {
  bestMatch: string | null;
  remainingRequests: number | null;
  matches: PlantIdentifyMatch[];
  enrichment: PlantEnrichment | null;
}

interface PerenualSpeciesListItem {
  id: number;
  common_name?: string | null;
  scientific_name?: string[];
}

interface PerenualSpeciesListResponse {
  data?: PerenualSpeciesListItem[];
}

interface PerenualDetails {
  common_name?: unknown;
  description?: unknown;
  watering?: unknown;
  sunlight?: unknown;
  growth_rate?: unknown;
  edible_fruit?: unknown;
  edible_leaf?: unknown;
  cuisine?: unknown;
  medicinal?: unknown;
}

// Perenual's free tier returns this literal string instead of real data (or
// omitting subscription-only fields) for most characteristic fields.
function isPerenualUpsellPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("upgrade plan") || lower.includes("subscription-api-pricing");
}

function normalizePerenualField(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const parts = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && !isPerenualUpsellPlaceholder(item));
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && !isPerenualUpsellPlaceholder(trimmed) ? trimmed : null;
  }
  return null;
}

async function fetchPerenualJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PERENUAL_TIMEOUT_MS) });
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch (err) {
    logger.warn({ err, url: url.toString().replace(/key=[^&]+/, "key=***") }, "Perenual request failed");
    return null;
  }
}

async function findPerenualSpecies(
  apiKey: string,
  scientificName: string,
): Promise<PerenualSpeciesListItem | null> {
  const genus = scientificName.split(" ")[0] ?? scientificName;
  const target = scientificName.trim().toLowerCase();
  const queries = Array.from(new Set([scientificName, genus].filter(Boolean)));

  for (const query of queries) {
    const url = new URL(PERENUAL_SPECIES_LIST_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);

    const body = await fetchPerenualJson<PerenualSpeciesListResponse>(url);
    const match = body?.data?.find((item) =>
      (item.scientific_name ?? []).some((name) => name.trim().toLowerCase() === target),
    );
    if (match) return match;
  }

  return null;
}

async function enrichWithPerenual(apiKey: string, scientificName: string): Promise<PlantEnrichment> {
  const empty: PlantEnrichment = {
    commonName: null,
    scientificName,
    description: null,
    watering: null,
    sunlight: null,
    growth: null,
    utility: null,
    source: "none",
  };

  const species = await findPerenualSpecies(apiKey, scientificName);
  if (!species) return empty;

  const detailsUrl = new URL(`${PERENUAL_SPECIES_DETAILS_URL}/${species.id}`);
  detailsUrl.searchParams.set("key", apiKey);
  const details = await fetchPerenualJson<PerenualDetails>(detailsUrl);

  const utilityParts: string[] = [];
  if (details?.edible_fruit) utilityParts.push("fruto comestible");
  if (details?.edible_leaf) utilityParts.push("hoja comestible");
  if (details?.cuisine) utilityParts.push("uso culinario");
  if (details?.medicinal) utilityParts.push("uso medicinal");

  const result: PlantEnrichment = {
    commonName: normalizePerenualField(details?.common_name) ?? normalizePerenualField(species.common_name),
    scientificName,
    description: normalizePerenualField(details?.description),
    watering: normalizePerenualField(details?.watering),
    sunlight: normalizePerenualField(details?.sunlight),
    growth: normalizePerenualField(details?.growth_rate),
    utility: utilityParts.length > 0 ? utilityParts.join(", ") : null,
    source: "none",
  };

  const hasUsableData =
    result.commonName || result.description || result.watering || result.sunlight || result.growth || result.utility;
  result.source = hasUsableData ? "perenual" : "none";

  return result;
}

router.post(
  "/plant-identify",
  raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const apiKey = process.env["PLANTNET_API_KEY"];
    if (!apiKey) {
      logger.error("PLANTNET_API_KEY is not configured");
      res.status(500).json({ error: "El servicio de identificación de plantas no está configurado." });
      return;
    }

    const imageBuffer = req.body as unknown;
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      res.status(400).json({
        error: "Debes enviar una imagen válida (image/jpeg, image/png o image/webp).",
      });
      return;
    }

    const organParam = typeof req.query["organ"] === "string" ? req.query["organ"] : "auto";
    const organ = ALLOWED_ORGANS.has(organParam) ? organParam : "auto";

    const contentTypeHeader = req.headers["content-type"];
    const contentType = typeof contentTypeHeader === "string"
      ? contentTypeHeader.split(";")[0].trim()
      : "image/jpeg";
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";

    const form = new FormData();
    form.append("images", new Blob([Uint8Array.from(imageBuffer)], { type: contentType }), `capture.${extension}`);
    form.append("organs", organ);

    const url = new URL(`https://my-api.plantnet.org/v2/identify/${PLANTNET_PROJECT}`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("lang", "es");
    url.searchParams.set("no-reject", "false");

    let plantNetResponse: Response;
    try {
      plantNetResponse = await fetch(url, { method: "POST", body: form });
    } catch (err) {
      logger.error({ err }, "Failed to reach PlantNet API");
      res.status(502).json({ error: "No se pudo contactar al servicio de identificación de plantas." });
      return;
    }

    if (!plantNetResponse.ok) {
      const errorBody = (await plantNetResponse.json().catch(() => null)) as { message?: string } | null;
      logger.warn({ status: plantNetResponse.status, errorBody }, "PlantNet identification failed");

      if (plantNetResponse.status === 404) {
        const empty: PlantIdentifyResponseBody = {
          bestMatch: null,
          remainingRequests: null,
          matches: [],
          enrichment: null,
        };
        res.json(empty);
        return;
      }

      res.status(plantNetResponse.status === 429 ? 429 : 502).json({
        error: errorBody?.message || "El servicio de identificación de plantas devolvió un error.",
      });
      return;
    }

    const data = (await plantNetResponse.json()) as PlantNetResponse;

    const matches: PlantIdentifyMatch[] = (data.results ?? []).slice(0, 5).map((result) => ({
      scientificName: result.species.scientificNameWithoutAuthor,
      family: result.species.family?.scientificNameWithoutAuthor ?? null,
      genus: result.species.genus?.scientificNameWithoutAuthor ?? null,
      commonNames: result.species.commonNames ?? [],
      score: result.score,
    }));

    let enrichment: PlantEnrichment | null = null;
    const perenualApiKey = process.env["PERENUAL_API_KEY"];
    if (matches.length > 0 && perenualApiKey) {
      try {
        enrichment = await enrichWithPerenual(perenualApiKey, matches[0].scientificName);
      } catch (err) {
        logger.warn({ err }, "Perenual enrichment failed; continuing without it");
        enrichment = null;
      }
    } else if (matches.length > 0) {
      enrichment = {
        commonName: null,
        scientificName: matches[0].scientificName,
        description: null,
        watering: null,
        sunlight: null,
        growth: null,
        utility: null,
        source: "none",
      };
    }

    const body: PlantIdentifyResponseBody = {
      bestMatch: data.bestMatch ?? null,
      remainingRequests: data.remainingIdentificationRequests ?? null,
      matches,
      enrichment,
    };

    res.json(body);
  },
);

export default router;
