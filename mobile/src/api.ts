import type {
  FaceoffCriterion,
  OnboardingPayload,
  Product,
  ProgressPayload,
  Score,
} from "./types";

const buildUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/$/, "")}${path}`;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function submitOnboarding(
  baseUrl: string,
  payload: OnboardingPayload,
): Promise<void> {
  const response = await fetch(buildUrl(baseUrl, "/onboarding"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseResponse(response);
}

export async function fetchProducts(baseUrl: string): Promise<Product[]> {
  const response = await fetch(buildUrl(baseUrl, "/products"));
  return parseResponse<Product[]>(response);
}

export async function submitRating(
  baseUrl: string,
  payload: {
    userId: string;
    productId: string;
    efficacy: number;
    preference: number;
    irritation: number;
  },
): Promise<void> {
  const response = await fetch(buildUrl(baseUrl, "/ratings"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseResponse(response);
}

export async function submitFaceoffVote(
  baseUrl: string,
  payload: {
    userId: string;
    productAId: string;
    productBId: string;
    winnerProductId: string;
    criterion: FaceoffCriterion;
    certainty: number;
  },
): Promise<void> {
  const response = await fetch(buildUrl(baseUrl, "/faceoffs/vote"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseResponse(response);
}

export async function submitCheckin(
  baseUrl: string,
  payload: {
    userId: string;
    acneScore: number;
    rednessScore: number;
    irritationScore: number;
    oilinessScore: number;
    drynessScore: number;
  },
): Promise<void> {
  const response = await fetch(buildUrl(baseUrl, "/checkins"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseResponse(response);
}

export async function fetchScores(baseUrl: string, userId: string): Promise<Score[]> {
  const response = await fetch(buildUrl(baseUrl, `/scores/${encodeURIComponent(userId)}`));
  const payload = await parseResponse<{ scores: Score[] }>(response);
  return payload.scores;
}

export async function fetchProgress(
  baseUrl: string,
  userId: string,
): Promise<ProgressPayload> {
  const response = await fetch(buildUrl(baseUrl, `/progress/${encodeURIComponent(userId)}`));
  return parseResponse<ProgressPayload>(response);
}
