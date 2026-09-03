import { useQuery } from "@tanstack/react-query";
import listGoalTasks from "@/fetchers/goal/list-goal-tasks";

export function useGetGoalTasks(goalId: string) {
  return useQuery({
    queryKey: ["goal-tasks", goalId],
    queryFn: () => listGoalTasks(goalId),
    enabled: !!goalId,
  });
}
