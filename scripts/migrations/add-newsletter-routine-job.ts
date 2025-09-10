import { OneTimeMigrationRunner } from "../utils";
import { getDb } from "../../db/connection";
import { RoutineJobsTable } from "../../db/schema";

export class AddNewsletterRoutineJobMigration extends OneTimeMigrationRunner {
  migrationName = "add-newsletter-routine-job";
  userAgent = "vargasjr-dev-newsletter-migration";

  async runMigration(): Promise<void> {
    const db = getDb();

    await db
      .insert(RoutineJobsTable)
      .values({
        name: "newsletter-digest",
        cronExpression: "0 8 * * *", // Daily at 8 AM
        enabled: true,
      })
      .onConflictDoNothing()
      .execute();

    console.log("Added newsletter-digest routine job");
  }
}
