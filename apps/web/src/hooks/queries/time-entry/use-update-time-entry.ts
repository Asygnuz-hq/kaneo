import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTimeEntry, {
  type UpdateTimeEntryRequest,
} from "@/fetchers/time-entry/update-time-entry";
import { toast } from "@/lib/toast";

// Assuming we want to pass taskId for invalidation, we can wrap the request
export type UseUpdateTimeEntryVariables = UpdateTimeEntryRequest & {
  taskId: string;
};

export default function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...data }: UseUpdateTimeEntryVariables) =>
      updateTimeEntry(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", variables.taskId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update time entry");
    },
  });
}
