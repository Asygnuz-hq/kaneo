import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateMemberRate from "@/fetchers/workspace/update-member-rate";

function useUpdateMemberRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMemberRate,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-member-rates", variables.workspaceId],
      });
    },
  });
}

export default useUpdateMemberRate;
