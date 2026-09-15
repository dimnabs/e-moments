import { SharedRoomError } from "../domain/errors";

type RateLimit = { attempts: number; windowMilliseconds: number };
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const maximumBuckets = 1_000;

export function enforceRateLimit(key: string, limit: RateLimit, now = Date.now()) {
  for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  if (buckets.size >= maximumBuckets && !buckets.has(key)) {
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now) {
    if (bucket.count >= limit.attempts) throw new SharedRoomError("Please wait a moment before trying again.", "RATE_LIMITED", 429);
    bucket.count += 1;
    return;
  }
  buckets.set(key, { count: 1, resetAt: now + limit.windowMilliseconds });
}
