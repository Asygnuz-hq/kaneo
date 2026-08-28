import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateSprint from "@/fetchers/sprint/update-sprint";

export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...fields
    }: {
      id: string;
      name?: string;
      goal?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    }) => updateSprint(id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
  });
}
