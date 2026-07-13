import cors from "@fastify/cors";
import Fastify from "fastify";
import { z } from "zod";
import { buildProductGuidance } from "./product-guidance.js";
import { buildUserProgress } from "./progress.js";
import { applyFaceoffVote, computeCompatibilityForUser } from "./scoring.js";
import { store } from "./store.js";
import type { Product, ProductCategory } from "./types.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const onboardingSchema = z.object({
  userId: z.string().min(1),
  concerns: z.array(z.string()).min(1),
  sensitivityLevel: z.enum(["low", "medium", "high"]),
  routineComplexity: z.enum(["none", "basic", "advanced"]),
  permissions: z.object({
    locationEnabled: z.boolean(),
    healthEnabled: z.boolean(),
    shoppingEnabled: z.boolean(),
    cycleTrackingEnabled: z.boolean(),
  }),
});

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().min(1),
  category: z.enum([
    "cleanser",
    "serum",
    "moisturizer",
    "sunscreen",
    "retinoid",
    "other",
  ] satisfies ProductCategory[]),
  ingredients: z.array(z.string()),
  usageInstructions: z.string().min(1).optional(),
  bestUseTime: z.enum(["am", "pm", "either"]).optional(),
  precautionCodes: z
    .array(
      z.enum([
        "night-only",
        "spf-required",
        "patch-test",
        "start-slow",
        "avoid-overlayering",
        "hydrate-after",
      ]),
    )
    .optional(),
  affiliateLinks: z
    .object({
      amazon: z.string().url().optional(),
      sephora: z.string().url().optional(),
      brand: z.string().url().optional(),
    })
    .optional(),
});

const ratingSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().min(1),
  efficacy: z.number().min(1).max(5),
  preference: z.number().min(1).max(5),
  irritation: z.number().min(1).max(5),
});

const faceoffVoteSchema = z
  .object({
    userId: z.string().min(1),
    productAId: z.string().min(1),
    productBId: z.string().min(1),
    winnerProductId: z.string().min(1),
    criterion: z.enum([
      "efficacy_acne",
      "efficacy_irritation",
      "preference_texture",
      "overall",
    ]),
    certainty: z.number().int().min(1).max(5),
  })
  .refine((value) => [value.productAId, value.productBId].includes(value.winnerProductId), {
    message: "winnerProductId must match one candidate",
    path: ["winnerProductId"],
  });

const checkinSchema = z.object({
  userId: z.string().min(1),
  acneScore: z.number().min(0).max(10),
  rednessScore: z.number().min(0).max(10),
  irritationScore: z.number().min(0).max(10),
  oilinessScore: z.number().min(0).max(10),
  drynessScore: z.number().min(0).max(10),
});

app.get("/health", async () => ({
  ok: true,
  users: store.users.size,
  products: store.products.size,
}));

app.post("/onboarding", async (request, reply) => {
  const payload = onboardingSchema.parse(request.body);
  store.users.set(payload.userId, {
    id: payload.userId,
    createdAt: new Date().toISOString(),
    concerns: payload.concerns,
    sensitivityLevel: payload.sensitivityLevel,
    routineComplexity: payload.routineComplexity,
    ...payload.permissions,
  });
  return reply.code(201).send({ saved: true, userId: payload.userId });
});

app.post("/products", async (request, reply) => {
  const payload = productSchema.parse(request.body);
  const normalized: Product = {
    ...payload,
    ingredients: payload.ingredients.map((item) => item.trim()),
    usageInstructions:
      payload.usageInstructions ?? "Use as directed by product label and monitor skin response.",
    bestUseTime: payload.bestUseTime ?? "either",
    precautionCodes: payload.precautionCodes ?? [],
    affiliateLinks: payload.affiliateLinks ?? {},
  };
  store.products.set(payload.id, normalized);
  return reply.code(201).send({ saved: true, productId: payload.id });
});

app.get("/products", async () => Array.from(store.products.values()));

app.get("/products/:productId", async (request, reply) => {
  const params = z.object({ productId: z.string() }).parse(request.params);
  const product = store.products.get(params.productId);
  if (!product) {
    return reply.code(404).send({ error: "Unknown productId" });
  }
  return product;
});

app.get("/products/:productId/guidance/:userId", async (request, reply) => {
  const params = z
    .object({
      productId: z.string().min(1),
      userId: z.string().min(1),
    })
    .parse(request.params);
  const guidance = buildProductGuidance(params.userId, params.productId);
  if (!guidance) {
    return reply.code(404).send({ error: "Unknown userId or productId" });
  }
  return guidance;
});

app.post("/ratings", async (request, reply) => {
  const payload = ratingSchema.parse(request.body);
  if (!store.products.has(payload.productId)) {
    return reply.code(404).send({ error: "Unknown productId" });
  }
  if (!store.users.has(payload.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }
  store.ratings.push({
    ...payload,
    createdAt: new Date().toISOString(),
  });
  return reply.code(201).send({ saved: true });
});

app.post("/faceoffs/vote", async (request, reply) => {
  const payload = faceoffVoteSchema.parse(request.body);
  if (!store.products.has(payload.productAId) || !store.products.has(payload.productBId)) {
    return reply.code(404).send({ error: "Unknown product IDs" });
  }
  if (!store.users.has(payload.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }

  store.faceoffVotes.push({
    ...payload,
    certainty: payload.certainty as 1 | 2 | 3 | 4 | 5,
    createdAt: new Date().toISOString(),
  });
  applyFaceoffVote(
    payload.userId,
    payload.productAId,
    payload.productBId,
    payload.winnerProductId,
    payload.criterion,
    payload.certainty,
  );
  return reply.code(201).send({ saved: true });
});

app.post("/checkins", async (request, reply) => {
  const payload = checkinSchema.parse(request.body);
  if (!store.users.has(payload.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }
  store.checkins.push({
    ...payload,
    createdAt: new Date().toISOString(),
  });
  return reply.code(201).send({ saved: true });
});

app.get("/checkins/:userId", async (request, reply) => {
  const params = z.object({ userId: z.string() }).parse(request.params);
  if (!store.users.has(params.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }
  const checkins = store.checkins
    .filter((entry) => entry.userId === params.userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { checkins };
});

app.get("/scores/:userId", async (request, reply) => {
  const params = z.object({ userId: z.string() }).parse(request.params);
  if (!store.users.has(params.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }
  const scores = computeCompatibilityForUser(params.userId);
  return { scores };
});

app.get("/progress/:userId", async (request, reply) => {
  const params = z.object({ userId: z.string() }).parse(request.params);
  if (!store.users.has(params.userId)) {
    return reply.code(404).send({ error: "Unknown userId" });
  }
  return buildUserProgress(params.userId);
});

const seedProducts: Product[] = [
  {
    id: "differin-gel",
    name: "Differin Gel",
    brand: "Differin",
    category: "retinoid",
    ingredients: ["Adapalene", "Carbomer", "Poloxamer"],
    usageInstructions:
      "Apply a pea-sized amount to dry skin at night after cleansing. Follow with moisturizer.",
    bestUseTime: "pm",
    precautionCodes: [
      "night-only",
      "spf-required",
      "patch-test",
      "start-slow",
      "avoid-overlayering",
      "hydrate-after",
    ],
    affiliateLinks: {
      amazon: "https://www.amazon.com/",
      brand: "https://differin.com/",
    },
  },
  {
    id: "cera-moisturizer",
    name: "Daily Moisturizing Lotion",
    brand: "CeraVe",
    category: "moisturizer",
    ingredients: ["Ceramide NP", "Hyaluronic Acid", "Glycerin"],
    usageInstructions: "Apply after cleansing in AM and PM. Reapply whenever skin feels dry.",
    bestUseTime: "either",
    precautionCodes: ["patch-test", "hydrate-after"],
    affiliateLinks: {
      amazon: "https://www.amazon.com/",
      brand: "https://www.cerave.com/",
    },
  },
  {
    id: "salicylic-cleanser",
    name: "BHA Cleanser",
    brand: "SkinLab",
    category: "cleanser",
    ingredients: ["Salicylic Acid", "Niacinamide", "Glycerin"],
    usageInstructions:
      "Use once daily initially, massage for 20-30 seconds, then rinse and moisturize.",
    bestUseTime: "either",
    precautionCodes: ["patch-test", "start-slow", "hydrate-after"],
    affiliateLinks: {
      sephora: "https://www.sephora.com/",
    },
  },
];

for (const product of seedProducts) {
  store.products.set(product.id, product);
}

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
