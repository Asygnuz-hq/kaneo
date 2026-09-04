import { useQuery } from "@tanstack/react-query";
import listTaskCustomFieldValues from "@/fetchers/custom-field/list-task-custom-field-values";

export function useGetTaskCustomFieldValues(taskId: string) {
  return useQuery({
    queryKey: ["task-custom-field-values", taskId],
    queryFn: () => listTaskCustomFieldValues(taskId),
    enabled: !!taskId,
  });
}
