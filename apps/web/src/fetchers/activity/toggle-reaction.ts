import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type ToggleReactionRequest = InferRequestType<
  (typeof client)["activity"]["reaction"]["$post"]
>["json"];

async function toggleReaction({ activityId, emoji }: ToggleReactionRequest) {
  const response = await client.activity.reaction.$post({
    json: { activityId, emoji },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default toggleReaction;
