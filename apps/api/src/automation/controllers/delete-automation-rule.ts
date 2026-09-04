import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { automationRuleTable } from "../../database/schema";

async function deleteAutomationRule(id: string) {
  const [deleted] = await db
    .delete(automationRuleTable)
    .where(eq(automationRuleTable.id, id))
    .returning({ id: automationRuleTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Automation rule not found" });
  }

  return deleted;
}

export default deleteAutomationRule;
