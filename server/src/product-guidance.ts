import { computeCompatibilityForUser } from "./scoring.js";
import { store } from "./store.js";
import type {
  IngredientInsight,
  PrecautionInstruction,
  Product,
  ProductGuidance,
  ProductPrecautionCode,
  UserProfile,
} from "./types.js";

const precautionMap: Record<ProductPrecautionCode, PrecautionInstruction> = {
  "night-only": {
    code: "night-only",
    icon: "🌙",
    label: "Night use recommended",
    detail: "Best used in the evening routine to reduce daytime sensitivity.",
  },
  "spf-required": {
    code: "spf-required",
    icon: "🧴",
    label: "Wear SPF daily",
    detail: "Use broad-spectrum SPF 30+ every morning while using this product.",
  },
  "patch-test": {
    code: "patch-test",
    icon: "🩹",
    label: "Patch test first",
    detail: "Apply to a small area for 2-3 nights before full-face use.",
  },
  "start-slow": {
    code: "start-slow",
    icon: "🐢",
    label: "Start slowly",
    detail: "Begin 2-3 nights per week and increase as tolerated.",
  },
  "avoid-overlayering": {
    code: "avoid-overlayering",
    icon: "⚠️",
    label: "Avoid harsh stacking",
    detail: "Do not stack with multiple strong actives in one routine initially.",
  },
  "hydrate-after": {
    code: "hydrate-after",
    icon: "💧",
    label: "Follow with moisturizer",
    detail: "Apply a barrier-supporting moisturizer after use to minimize dryness.",
  },
};

const ingredientInsightRules: Array<{
  pattern: RegExp;
  positiveReasons: Partial<Record<string, string>>;
  genericPositive?: string;
  cautionReason?: string;
}> = [
  {
    pattern: /niacinamide/i,
    positiveReasons: {
      acne: "Can help oil balance and post-acne marks.",
      redness: "Supports barrier function and can calm visible redness.",
      pigmentation: "Often useful for tone and dark-spot support.",
    },
    genericPositive: "Barrier-supporting ingredient for many skin profiles.",
  },
  {
    pattern: /salicylic/i,
    positiveReasons: {
      acne: "Targets congested pores and blackheads.",
      oiliness: "Useful for oil control in acne-prone routines.",
    },
    cautionReason: "Can be drying if paired with multiple exfoliants.",
  },
  {
    pattern: /ceramide/i,
    positiveReasons: {
      dryness: "Supports skin barrier recovery and hydration retention.",
      redness: "Can reduce barrier-related irritation over time.",
    },
    genericPositive: "Barrier-repair ingredient that pairs well with actives.",
  },
  {
    pattern: /adapalene|retinol|retinal/i,
    positiveReasons: {
      acne: "Supports acne control and comedone prevention.",
      aging: "May improve texture and signs of photoaging with consistent use.",
    },
    cautionReason: "Can cause temporary dryness or irritation during ramp-up.",
  },
  {
    pattern: /fragrance|parfum/i,
    positiveReasons: {},
    cautionReason: "Fragrance can increase irritation risk for sensitive profiles.",
  },
  {
    pattern: /alcohol denat|denatured alcohol/i,
    positiveReasons: {},
    cautionReason: "May increase dryness or stinging for sensitive or dry skin.",
  },
];

const pushUniqueInsight = (
  list: IngredientInsight[],
  candidate: IngredientInsight,
): void => {
  if (list.some((entry) => entry.ingredient === candidate.ingredient)) return;
  list.push(candidate);
};

const evaluateIngredients = (
  product: Product,
  user: UserProfile,
): ProductGuidance["ingredients"] => {
  const bestForYou: IngredientInsight[] = [];
  const cautionForYou: IngredientInsight[] = [];

  for (const ingredient of product.ingredients) {
    for (const rule of ingredientInsightRules) {
      if (!rule.pattern.test(ingredient)) continue;

      const concernReason = user.concerns
        .map((concern) => rule.positiveReasons[concern])
        .find(Boolean);
      if (concernReason) {
        pushUniqueInsight(bestForYou, { ingredient, reason: concernReason });
      } else if (rule.genericPositive) {
        pushUniqueInsight(bestForYou, { ingredient, reason: rule.genericPositive });
      }

      const needsSensitivityCaution =
        user.sensitivityLevel === "high" ||
        (user.sensitivityLevel === "medium" && /fragrance|alcohol denat/i.test(ingredient));
      if (rule.cautionReason && needsSensitivityCaution) {
        pushUniqueInsight(cautionForYou, { ingredient, reason: rule.cautionReason });
      }
    }
  }

  return {
    bestForYou: bestForYou.slice(0, 4),
    cautionForYou: cautionForYou.slice(0, 4),
  };
};

export const buildProductGuidance = (
  userId: string,
  productId: string,
): ProductGuidance | null => {
  const user = store.users.get(userId);
  const product = store.products.get(productId);
  if (!user || !product) return null;

  const compatibility =
    computeCompatibilityForUser(userId).find((item) => item.productId === productId) ?? null;
  const ingredients = evaluateIngredients(product, user);
  const precautions = product.precautionCodes.map((code) => precautionMap[code]);

  return {
    product,
    compatibility,
    usage: {
      bestUseTime: product.bestUseTime,
      instructions: product.usageInstructions,
      precautions,
    },
    ingredients,
  };
};
