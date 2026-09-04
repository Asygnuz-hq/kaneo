import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { automationRuleTable } from "../../database/schema";
import { serializeAutomationRule } from "../serialize";

async function listAutomationRules(projectId: string) {
  const rows = await db
    .select()
    .from(automationRuleTable)
    .where(eq(automationRuleTable.projectId, projectId))
    .orderBy(asc(automationRuleTable.createdAt));

  return rows.map(serializeAutomationRule);
}

export default listAutomationRules;
