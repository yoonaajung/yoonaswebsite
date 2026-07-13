# Skin Twin App Starter

Starter codebase for a skincare progress app focused on:

- camera-first onboarding baseline
- product compatibility scoring
- pairwise "Face-Off" product comparisons
- habit + biological + environmental context

## Project structure

- `mobile/` - Expo React Native app (setup flow + camera/location permissions)
- `server/` - Fastify TypeScript API (onboarding, ratings, face-offs, compatibility scoring)

## Mobile app setup

```bash
cd mobile
npm install
npm start
```

Current `App.tsx` includes setup stages:

1. profile questions
2. permissions (camera, location, health/shop toggles)
3. baseline camera scan
4. product source connect
5. API-connected launch into:
   - Dashboard (unlock progress + product ratings + score cards)
   - Face-Off (A/B vote capture)
   - Check-in (daily streak input)

## API setup

```bash
cd server
npm install
npm run dev
```

Server default URL: `http://localhost:3001`

### Endpoints

- `GET /health`
- `POST /onboarding`
- `GET /products`
- `POST /products`
- `GET /products/:productId`
- `GET /products/:productId/guidance/:userId`
- `POST /ratings`
- `POST /faceoffs/vote`
- `POST /checkins`
- `GET /checkins/:userId`
- `GET /scores/:userId`
- `GET /progress/:userId`

## Compatibility scoring

The scaffold computes per-user/per-product outputs:

- efficacy score
- preference score
- ingredient fit score
- adherence fit score
- irritation risk score
- compatibility score (weighted blend)
- confidence score
- lock state (`unlocked` requires enough ratings + face-offs + history)

## Notes

- Current storage is in-memory for speed of iteration.
- Next production steps: persistent database (Postgres), auth, background jobs, and on-device image model pipeline.
