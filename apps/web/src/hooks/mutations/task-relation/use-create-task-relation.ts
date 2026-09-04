import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTaskRelation from "@/fetchers/task-relation/create-task-relation";

function useCreateTaskRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskRelation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.sourceTaskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-relations", variables.targetTaskId],
      });
      // ASYGNUZ: sin esto, crear una relación desde el panel de la tarea no
      // se reflejaba en el Gantt (flechas de dependencia, ruta crítica) ni
      // en la vista de Lista (árbol de subtareas) hasta recargar la página
      // -- esas vistas leen las relaciones del proyecto completo en bloque,
      // una query aparte que esta mutación nunca invalidaba.
      if (variables.relationType === "blocks") {
        queryClient.invalidateQueries({
          queryKey: ["project-blocking-relations"],
        });
      }
      if (variables.relationType === "subtask") {
        queryClient.invalidateQueries({
          queryKey: ["project-subtask-relations"],
        });
      }
    },
  });
}

export default useCreateTaskRelation;
