import { client } from "@kaneo/libs";

async function unsetTaskCustomFieldValue({
  taskId,
  customFieldId,
}: {
  taskId: string;
  customFieldId: string;
}) {
  const response = await client["custom-field"].task[":taskId"][
    ":customFieldId"
  ].$delete({
    param: { taskId, customFieldId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default unsetTaskCustomFieldValue;
