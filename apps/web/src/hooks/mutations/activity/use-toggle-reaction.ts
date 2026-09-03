import { useMutation, useQueryClient } from "@tanstack/react-query";
import toggleReaction from "@/fetchers/activity/toggle-reaction";

type ActivityWithReactions = {
  id: string;
  reactions: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
};

function useToggleReaction(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleReaction,
    // Patch the one changed comment's reactions in place instead of
    // invalidating the whole feed -- avoids a refetch flicker on every click
    // of what's meant to be a snappy, low-stakes interaction.
    onSuccess: (reactions, { activityId }) => {
      queryClient.setQueryData<ActivityWithReactions[]>(
        ["activities", taskId],
        (activities) =>
          activities?.map((activity) =>
            activity.id === activityId ? { ...activity, reactions } : activity,
          ),
      );
    },
  });
}

export default useToggleReaction;
