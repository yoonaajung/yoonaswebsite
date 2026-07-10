import type {
  Checkin,
  FaceoffVote,
  Product,
  ProductRating,
  UserProductPairState,
  UserProfile,
} from "./types.js";

export interface Store {
  users: Map<string, UserProfile>;
  products: Map<string, Product>;
  ratings: ProductRating[];
  faceoffVotes: FaceoffVote[];
  checkins: Checkin[];
  pairStates: Map<string, UserProductPairState>;
}

export const store: Store = {
  users: new Map(),
  products: new Map(),
  ratings: [],
  faceoffVotes: [],
  checkins: [],
  pairStates: new Map(),
};

export const pairKey = (userId: string, productId: string): string =>
  `${userId}:${productId}`;
