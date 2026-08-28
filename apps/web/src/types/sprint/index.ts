type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  position: number;
  createdAt: string;
};

export default Sprint;
