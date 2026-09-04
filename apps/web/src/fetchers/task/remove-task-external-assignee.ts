import { client } from "@kaneo/libs";

async function removeTaskExternalAssignee(
  taskId: string,
  externalContactId: string,
) {
  const response = await client.task["external-assignee"][":id"][
    ":externalContactId"
  ].$delete({
    param: { id: taskId, externalContactId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default removeTaskExternalAssignee;
