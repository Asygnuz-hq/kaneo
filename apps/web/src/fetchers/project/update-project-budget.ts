import { client } from "@kaneo/libs";

async function updateProjectBudget({
  id,
  budgetCents,
  currency,
}: {
  id: string;
  budgetCents: number | null;
  currency: string;
}) {
  const response = await client.project[":id"].budget.$put({
    param: { id },
    json: { budgetCents, currency },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateProjectBudget;
