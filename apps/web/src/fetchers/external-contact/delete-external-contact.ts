import { client } from "@kaneo/libs";

async function deleteExternalContact({ id }: { id: string }) {
  const response = await client["external-contact"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteExternalContact;
