export type FaceoffCriterion =
  | "efficacy_acne"
  | "efficacy_irritation"
  | "preference_texture"
  | "overall";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  usageInstructions: string;
  bestUseTime: "am" | "pm" | "either";
  precautionCodes: string[];
  affiliateLinks: {
    amazon?: string;
    sephora?: string;
    brand?: string;
  };
}

export interface Score {
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

export interface ProgressPayload {
  ratedProducts: number;
  totalFaceoffs: number;
  checkinCount: number;
  trackedDays: number;
  activeStreakDays: number;
  unlockRequirements: {
    ratingsRequired: number;
    faceoffsRequired: number;
    trackingDaysRequired: number;
  };
  unlockProgress: {
    ratings: number;
    faceoffs: number;
    trackingDays: number;
  };
  canUnlockCompatibility: boolean;
}

export interface OnboardingPayload {
  userId: string;
  concerns: string[];
  sensitivityLevel: "low" | "medium" | "high";
  routineComplexity: "none" | "basic" | "advanced";
  permissions: {
    locationEnabled: boolean;
    healthEnabled: boolean;
    shoppingEnabled: boolean;
    cycleTrackingEnabled: boolean;
  };
}

export interface ProductGuidance {
  product: Product;
  compatibility: Score | null;
  usage: {
    bestUseTime: "am" | "pm" | "either";
    instructions: string;
    precautions: Array<{
      code: string;
      icon: string;
      label: string;
      detail: string;
    }>;
  };
  ingredients: {
    bestForYou: Array<{
      ingredient: string;
      reason: string;
    }>;
    cautionForYou: Array<{
      ingredient: string;
      reason: string;
    }>;
  };
}
