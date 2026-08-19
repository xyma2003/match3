import { getStore, PreconditionFailedError } from "@edgeone/pages-blob";

const STORE_NAME = "nailong-match3";

export type UserRecord = {
  id: string;
  username: string;
  usernameNormalized: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  recoveryEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  username: string;
  recoveryEmail: string | null;
  expiresAt: number;
  createdAt: string;
};

export type GameRecord = {
  id: string;
  userId: string;
  name: string;
  currentLevel: number;
  highestLevel: number;
  highestScore: number;
  normalAssetKeys: string[];
  bossAssetKey: string | null;
  createdAt: string;
  updatedAt: string;
};

function store() {
  return getStore(STORE_NAME);
}

export async function readJSON<T>(key: string): Promise<T | null> {
  return store().get(key, { type: "json", consistency: "strong" }) as Promise<T | null>;
}

export async function writeJSON(key: string, value: unknown) {
  await store().setJSON(key, value, { cacheControl: "no-store" });
}

export async function createJSON(key: string, value: unknown) {
  try {
    await store().setJSON(key, value, { onlyIfNew: true, cacheControl: "no-store" });
    return true;
  } catch (error) {
    if (error instanceof PreconditionFailedError || (error instanceof Error && error.name === "PreconditionFailedError")) {
      return false;
    }
    throw error;
  }
}

export async function deleteKey(key: string) {
  await store().delete(key);
}

export async function listJSON<T>(prefix: string): Promise<T[]> {
  const result = await store().list({ prefix, consistency: "strong" });
  const values = await Promise.all(result.blobs.map((blob) => readJSON<T>(blob.key)));
  return values.filter((value) => value !== null) as T[];
}

export function usernameKey(usernameHash: string) {
  return `users/by-name/${usernameHash}.json`;
}

export function sessionKey(tokenHash: string) {
  return `sessions/${tokenHash}.json`;
}

export function gameKey(userId: string, gameId: string) {
  return `games/${userId}/${gameId}.json`;
}

export function gamePrefix(userId: string) {
  return `games/${userId}/`;
}

export function assetKey(userId: string, gameId: string, tier: "normal" | "boss", filename: string) {
  const safeName = filename.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-80) || "image";
  return `assets/${userId}/${gameId}/${tier}/${crypto.randomUUID()}-${safeName}`;
}

export function publicAssetUrl(key: string) {
  return `/api/assets?key=${encodeURIComponent(key)}`;
}

export async function writeAsset(key: string, file: File) {
  const bytes = await file.arrayBuffer();
  await store().set(key, new Blob([bytes], { type: file.type || "application/octet-stream" }), {
    cacheControl: "public, max-age=31536000, immutable",
  });
}

export async function readAsset(key: string) {
  return store().get(key, { type: "blob", consistency: "strong" });
}
