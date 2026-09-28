import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import db from "../database";

const INSTANCE_ID = randomUUID();

export const SEAT_RECONCILIATION_LEASE = "seat-reconciliation";

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export async function withJobLease<T>(
  name: string,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<T> {
  // expires_at is a plain "timestamp" column (no time zone), and job_lease.sql
  // wants that stored value to mean UTC. A JS Date bound as a parameter is
  // serialized using the pg driver's LOCAL wall-clock, so on a machine whose
  // timezone isn't UTC (this fork develops from Colombia, UTC-5) the row ends
  // up several hours off from the real instant -- on a negative offset, early
  // enough to already look expired to `now()`, letting a second caller steal
  // a lease the first one still legitimately holds. Computing the expiry with
  // Postgres's own `now()` sidesteps any client-side timezone entirely.
  const leaseSeconds = leaseMs / 1000;

  const claimed = await db.execute(sql`
    INSERT INTO job_lease ("name", "owner", "expires_at")
    VALUES (${name}, ${INSTANCE_ID}, now() + make_interval(secs => ${leaseSeconds}))
    ON CONFLICT ("name") DO UPDATE
      SET "owner" = EXCLUDED."owner", "expires_at" = EXCLUDED."expires_at"
      WHERE job_lease."expires_at" < now()
    RETURNING "name";
  `);

  if ((claimed.rowCount ?? 0) === 0) {
    return whenHeldElsewhere();
  }

  try {
    return await run();
  } finally {
    await db
      .execute(
        sql`DELETE FROM job_lease WHERE "name" = ${name} AND "owner" = ${INSTANCE_ID};`,
      )
      .catch((error) => {
        console.error(`Failed to release the ${name} lease`, error);
      });
  }
}
