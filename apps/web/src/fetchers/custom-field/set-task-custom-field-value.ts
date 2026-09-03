import { client } from "@kaneo/libs";

async function setTaskCustomFieldValue({
  taskId,
  customFieldId,
  value,
}: {
  taskId: string;
  customFieldId: string;
  value: string;
}) {
  const response = await client["custom-field"].task[":taskId"][
    ":customFieldId"
  ].$put({
    param: { taskId, customFieldId },
    json: { value },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default setTaskCustomFieldValue;
