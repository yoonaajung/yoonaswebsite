export type ProductCategory =
  | "cleanser"
  | "serum"
  | "moisturizer"
  | "sunscreen"
  | "retinoid"
  | "other";

export interface UserProfile {
  id: string;
  createdAt: string;
  concerns: string[];
  sensitivityLevel: "low" | "medium" | "high";
  routineComplexity: "none" | "basic" | "advanced";
  locationEnabled: boolean;
  healthEnabled: boolean;
  shoppingEnabled: boolean;
  cycleTrackingEnabled: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  ingredients: string[];
}

export interface ProductRating {
  userId: string;
  productId: string;
  efficacy: number; // 1-5
  preference: number; // 1-5
  irritation: number; // 1-5 (higher = more irritation)
  createdAt: string;
}

export type FaceoffCriterion =
  | "efficacy_acne"
  | "efficacy_irritation"
  | "preference_texture"
  | "overall";

export interface FaceoffVote {
  userId: string;
  productAId: string;
  productBId: string;
  winnerProductId: string;
  criterion: FaceoffCriterion;
  certainty: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
}

export interface Checkin {
  userId: string;
  acneScore: number; // 0-10
  rednessScore: number; // 0-10
  irritationScore: number; // 0-10
  oilinessScore: number; // 0-10
  drynessScore: number; // 0-10
  createdAt: string;
}

export interface CompatibilityOutput {
  productId: string;
  efficacyScore: number;
  preferenceScore: number;
  ingredientFitScore: number;
  adherenceFitScore: number;
  irritationRiskScore: number;
  compatibilityScore: number;
  confidenceScore: number;
  unlocked: boolean;
}

export interface UserProductPairState {
  userId: string;
  productId: string;
  eloByCriterion: Record<FaceoffCriterion, number>;
}
