type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  status: string;
  priority: string | null;
  issueType?: string | null;
  sprintId?: string | null;
  startDate: string | null;
  dueDate: string | null;
  isMilestone?: boolean;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  columnId?: string | null;
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
  // ASYGNUZ: solo no nulo si la tarea nació como ticket del portal de
  // cliente (Service Desk fase 2).
  requestedByClientId?: string | null;
  requestedByClientName?: string | null;
  requestedByClientEmail?: string | null;
};

export default Task;
