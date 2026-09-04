import { client } from "@kaneo/libs";

export type CreateTaskTemplateRequest = {
  projectId: string;
  name: string;
  title?: string;
  description?: string;
  priority?: string;
  issueType?: string;
  labelIds?: string[];
};

async function createTaskTemplate(data: CreateTaskTemplateRequest) {
  const response = await client["task-template"].$post({ json: data });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createTaskTemplate;
