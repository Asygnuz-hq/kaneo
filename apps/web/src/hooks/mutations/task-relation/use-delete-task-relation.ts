import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTaskRelation from "@/fetchers/task-relation/delete-task-relation";

function useDeleteTaskRelation(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTaskRelation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", taskId],
      });
      // ASYGNUZ: mismo motivo que en use-create-task-relation -- el Gantt y
      // la vista de Lista leen las relaciones del proyecto en bloque, no por
      // tarea. El tipo de la relación borrada no se conoce aquí (la mutación
      // solo recibe el id), así que se invalidan ambas cachés de proyecto;
      // el costo de un refetch de más es insignificante.
      queryClient.invalidateQueries({
        queryKey: ["project-blocking-relations"],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-subtask-relations"],
      });
    },
  });
}

export default useDeleteTaskRelation;
