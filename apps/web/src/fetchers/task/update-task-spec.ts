import { client } from "@kaneo/libs";
import type { RequirementSpec, StorySpec } from "@/types/task";

async function updateTaskSpec(
  taskId: string,
  spec: RequirementSpec | StorySpec,
) {
  const response = await client.task.spec[":id"].$put({
    param: { id: taskId },
    json: { spec: spec as Record<string, unknown> },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskSpec;
