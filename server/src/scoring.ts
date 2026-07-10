import { pairKey, store } from "./store.js";
import type {
  CompatibilityOutput,
  FaceoffCriterion,
  Product,
  UserProductPairState,
} from "./types.js";

const DEFAULT_ELO = 1200;
const K_FACTOR = 24;

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value));

const toFivePointScale = (score: number): number => clamp((score / 5) * 100);

const ensurePairState = (
  userId: string,
  productId: string,
): UserProductPairState => {
  const key = pairKey(userId, productId);
  const existing = store.pairStates.get(key);

  if (existing) {
    return existing;
  }

  const created: UserProductPairState = {
    userId,
    productId,
    eloByCriterion: {
      efficacy_acne: DEFAULT_ELO,
      efficacy_irritation: DEFAULT_ELO,
      preference_texture: DEFAULT_ELO,
      overall: DEFAULT_ELO,
    },
  };
  store.pairStates.set(key, created);
  return created;
};

const expectedScore = (a: number, b: number): number =>
  1 / (1 + 10 ** ((b - a) / 400));

export const applyFaceoffVote = (
  userId: string,
  productAId: string,
  productBId: string,
  winnerProductId: string,
  criterion: FaceoffCriterion,
  certainty: number,
): void => {
  const aState = ensurePairState(userId, productAId);
  const bState = ensurePairState(userId, productBId);
  const certaintyWeight = 0.5 + certainty / 10;
  const effectiveK = K_FACTOR * certaintyWeight;

  const ra = aState.eloByCriterion[criterion];
  const rb = bState.eloByCriterion[criterion];
  const ea = expectedScore(ra, rb);
  const eb = expectedScore(rb, ra);

  const sa = winnerProductId === productAId ? 1 : 0;
  const sb = winnerProductId === productBId ? 1 : 0;

  aState.eloByCriterion[criterion] = ra + effectiveK * (sa - ea);
  bState.eloByCriterion[criterion] = rb + effectiveK * (sb - eb);
};

const normalizedElo = (elo: number): number => {
  // Maps approx [900, 1500] to [0,100]
  return clamp(((elo - 900) / 600) * 100);
};

const ingredientHeuristics = (product: Product, concerns: string[]): number => {
  const ingredients = product.ingredients.map((item) => item.toLowerCase());

  let score = 50;
  if (ingredients.some((item) => item.includes("niacinamide"))) score += 10;
  if (ingredients.some((item) => item.includes("ceramide"))) score += 10;
  if (ingredients.some((item) => item.includes("fragrance"))) score -= 15;
  if (
    concerns.includes("acne") &&
    ingredients.some((item) => item.includes("salicylic"))
  ) {
    score += 10;
  }

  return clamp(score);
};

const adherenceHeuristics = (category: Product["category"]): number => {
  switch (category) {
    case "cleanser":
    case "moisturizer":
      return 82;
    case "sunscreen":
      return 76;
    case "serum":
      return 70;
    case "retinoid":
      return 64;
    default:
      return 68;
  }
};

export const computeCompatibilityForUser = (
  userId: string,
): CompatibilityOutput[] => {
  const user = store.users.get(userId);
  if (!user) return [];

  const ratingsByProduct = new Map<string, typeof store.ratings>();
  for (const rating of store.ratings) {
    if (rating.userId !== userId) continue;
    const bucket = ratingsByProduct.get(rating.productId) ?? [];
    bucket.push(rating);
    ratingsByProduct.set(rating.productId, bucket);
  }

  const faceoffCountByProduct = new Map<string, number>();
  for (const vote of store.faceoffVotes) {
    if (vote.userId !== userId) continue;
    faceoffCountByProduct.set(
      vote.productAId,
      (faceoffCountByProduct.get(vote.productAId) ?? 0) + 1,
    );
    faceoffCountByProduct.set(
      vote.productBId,
      (faceoffCountByProduct.get(vote.productBId) ?? 0) + 1,
    );
  }

  const uniqueRatedProducts = new Set(
    store.ratings.filter((rating) => rating.userId === userId).map((r) => r.productId),
  ).size;
  const totalFaceoffs = store.faceoffVotes.filter(
    (vote) => vote.userId === userId,
  ).length;

  const earliestCheckinDate = store.checkins
    .filter((checkin) => checkin.userId === userId)
    .map((checkin) => new Date(checkin.createdAt).getTime())
    .sort((a, b) => a - b)[0];
  const has14DaysHistory =
    earliestCheckinDate !== undefined &&
    Date.now() - earliestCheckinDate >= 14 * 24 * 60 * 60 * 1000;
  const unlocked = uniqueRatedProducts >= 5 && totalFaceoffs >= 12 && has14DaysHistory;

  const results: CompatibilityOutput[] = [];

  for (const product of store.products.values()) {
    const productRatings = ratingsByProduct.get(product.id) ?? [];
    const pairState = ensurePairState(userId, product.id);
    const faceoffCount = faceoffCountByProduct.get(product.id) ?? 0;

    const avgEfficacy =
      productRatings.length > 0
        ? productRatings.reduce((sum, item) => sum + item.efficacy, 0) /
          productRatings.length
        : 3;
    const avgPreference =
      productRatings.length > 0
        ? productRatings.reduce((sum, item) => sum + item.preference, 0) /
          productRatings.length
        : 3;
    const avgIrritation =
      productRatings.length > 0
        ? productRatings.reduce((sum, item) => sum + item.irritation, 0) /
          productRatings.length
        : 2.5;

    const efficacyFromRating = toFivePointScale(avgEfficacy);
    const efficacyFromFaceoff = normalizedElo(pairState.eloByCriterion.efficacy_acne);
    const efficacyScore = clamp(0.7 * efficacyFromRating + 0.3 * efficacyFromFaceoff);

    const preferenceFromRating = toFivePointScale(avgPreference);
    const preferenceFromFaceoff = normalizedElo(
      pairState.eloByCriterion.preference_texture,
    );
    const preferenceScore = clamp(
      0.65 * preferenceFromRating + 0.35 * preferenceFromFaceoff,
    );

    const irritationRiskScore = toFivePointScale(avgIrritation);
    const ingredientFitScore = ingredientHeuristics(product, user.concerns);
    const adherenceFitScore = adherenceHeuristics(product.category);

    const compatibilityScore = clamp(
      0.45 * efficacyScore +
        0.2 * ingredientFitScore +
        0.15 * adherenceFitScore +
        0.1 * preferenceScore +
        0.1 * (100 - irritationRiskScore),
    );

    const faceoffReliability = 1 - Math.exp(-faceoffCount / 8);
    const ratingReliability = 1 - Math.exp(-productRatings.length / 4);
    const baseConfidence = 100 * faceoffReliability * ratingReliability;
    const confidenceScore = clamp(baseConfidence);

    results.push({
      productId: product.id,
      efficacyScore,
      preferenceScore,
      ingredientFitScore,
      adherenceFitScore,
      irritationRiskScore,
      compatibilityScore: unlocked
        ? compatibilityScore
        : compatibilityScore >= 66
          ? 80
          : compatibilityScore >= 40
            ? 55
            : 25,
      confidenceScore,
      unlocked,
    });
  }

  return results.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
};
