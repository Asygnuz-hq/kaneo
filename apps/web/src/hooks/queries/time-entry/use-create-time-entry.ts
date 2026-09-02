import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTimeEntry, { type CreateTimeEntryRequest } from "@/fetchers/time-entry/create-time-entry";
import { toast } from "@/lib/toast";

export default function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTimeEntryRequest) => createTimeEntry(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["time-entries", variables.taskId],
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create time entry");
    },
  });
}
