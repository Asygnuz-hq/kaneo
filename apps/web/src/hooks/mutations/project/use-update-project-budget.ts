import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateProjectBudget from "@/fetchers/project/update-project-budget";

function useUpdateProjectBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectBudget,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-budget", variables.id],
      });
    },
  });
}

export default useUpdateProjectBudget;
