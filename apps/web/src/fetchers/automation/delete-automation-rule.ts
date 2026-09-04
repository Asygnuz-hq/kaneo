import { client } from "@kaneo/libs";

async function deleteAutomationRule(id: string) {
  const response = await client.automation[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteAutomationRule;
