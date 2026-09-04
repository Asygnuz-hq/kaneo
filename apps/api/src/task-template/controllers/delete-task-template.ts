import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTemplateTable } from "../../database/schema";

async function deleteTaskTemplate(id: string) {
  const [deleted] = await db
    .delete(taskTemplateTable)
    .where(eq(taskTemplateTable.id, id))
    .returning({ id: taskTemplateTable.id });

  if (!deleted) {
    throw new HTTPException(404, { message: "Task template not found" });
  }

  return deleted;
}

export default deleteTaskTemplate;
