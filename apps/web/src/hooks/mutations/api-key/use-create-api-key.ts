import { useMutation, useQueryClient } from "@tanstack/react-query";
import createScopedApiKey from "@/fetchers/user/create-scoped-api-key";
import type { CreateApiKeyClientRequest } from "@/types/api-key";

function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApiKeyClientRequest) =>
      createScopedApiKey({
        name: data.name,
        expiresIn: data.expiresIn ?? null,
        permissions: data.permissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export default useCreateApiKey;
