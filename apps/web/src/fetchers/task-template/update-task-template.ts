import { client } from "@kaneo/libs";

export type UpdateTaskTemplateRequest = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
};

async function updateTaskTemplate({ id, ...body }: UpdateTaskTemplateRequest) {
  const response = await client["task-template"][":id"].$put({
    param: { id },
    json: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskTemplate;
