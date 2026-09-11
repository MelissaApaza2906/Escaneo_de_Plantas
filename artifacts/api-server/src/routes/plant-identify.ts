import { Router, type IRouter, raw } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ORGANS = new Set(["leaf", "flower", "fruit", "bark", "habit", "other", "auto"]);
const PLANTNET_PROJECT = process.env["PLANTNET_PROJECT"] || "all";

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

export interface PlantIdentifyResponseBody {
  bestMatch: string | null;
  remainingRequests: number | null;
  matches: PlantIdentifyMatch[];
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
    form.append("images", new Blob([imageBuffer], { type: contentType }), `capture.${extension}`);
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
        const empty: PlantIdentifyResponseBody = { bestMatch: null, remainingRequests: null, matches: [] };
        res.json(empty);
        return;
      }

      res.status(plantNetResponse.status === 429 ? 429 : 502).json({
        error: errorBody?.message || "El servicio de identificación de plantas devolvió un error.",
      });
      return;
    }

    const data = (await plantNetResponse.json()) as PlantNetResponse;

    const body: PlantIdentifyResponseBody = {
      bestMatch: data.bestMatch ?? null,
      remainingRequests: data.remainingIdentificationRequests ?? null,
      matches: (data.results ?? []).slice(0, 5).map((result) => ({
        scientificName: result.species.scientificNameWithoutAuthor,
        family: result.species.family?.scientificNameWithoutAuthor ?? null,
        genus: result.species.genus?.scientificNameWithoutAuthor ?? null,
        commonNames: result.species.commonNames ?? [],
        score: result.score,
      })),
    };

    res.json(body);
  },
);

export default router;
