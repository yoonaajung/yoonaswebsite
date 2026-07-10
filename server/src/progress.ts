import { store } from "./store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDateKey = (isoTimestamp: string): string =>
  new Date(isoTimestamp).toISOString().slice(0, 10);

const utcDayDiff = (leftDateKey: string, rightDateKey: string): number => {
  const left = new Date(`${leftDateKey}T00:00:00.000Z`).getTime();
  const right = new Date(`${rightDateKey}T00:00:00.000Z`).getTime();
  return Math.round((left - right) / DAY_MS);
};

const computeActiveStreak = (dateKeys: string[]): number => {
  if (dateKeys.length === 0) return 0;
  const sorted = [...new Set(dateKeys)].sort((a, b) => (a < b ? 1 : -1));
  const todayKey = new Date().toISOString().slice(0, 10);
  const daysSinceLatest = utcDayDiff(todayKey, sorted[0]);

  // If the last check-in is older than yesterday, streak is considered inactive.
  if (daysSinceLatest > 1) return 0;

  let streak = 1;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const curr = sorted[index];
    const next = sorted[index + 1];
    if (utcDayDiff(curr, next) === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
};

export interface UserProgress {
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

export const buildUserProgress = (userId: string): UserProgress => {
  const ratings = store.ratings.filter((entry) => entry.userId === userId);
  const faceoffs = store.faceoffVotes.filter((entry) => entry.userId === userId);
  const checkins = store.checkins.filter((entry) => entry.userId === userId);

  const ratedProducts = new Set(ratings.map((entry) => entry.productId)).size;
  const dateKeys = checkins.map((entry) => toUtcDateKey(entry.createdAt));
  const uniqueDateKeys = [...new Set(dateKeys)].sort();
  const trackedDays = uniqueDateKeys.length;
  const activeStreakDays = computeActiveStreak(uniqueDateKeys);

  const unlockRequirements = {
    ratingsRequired: 5,
    faceoffsRequired: 12,
    trackingDaysRequired: 14,
  };

  const unlockProgress = {
    ratings: Math.min(ratedProducts, unlockRequirements.ratingsRequired),
    faceoffs: Math.min(faceoffs.length, unlockRequirements.faceoffsRequired),
    trackingDays: Math.min(trackedDays, unlockRequirements.trackingDaysRequired),
  };

  const canUnlockCompatibility =
    ratedProducts >= unlockRequirements.ratingsRequired &&
    faceoffs.length >= unlockRequirements.faceoffsRequired &&
    trackedDays >= unlockRequirements.trackingDaysRequired;

  return {
    ratedProducts,
    totalFaceoffs: faceoffs.length,
    checkinCount: checkins.length,
    trackedDays,
    activeStreakDays,
    unlockRequirements,
    unlockProgress,
    canUnlockCompatibility,
  };
};
