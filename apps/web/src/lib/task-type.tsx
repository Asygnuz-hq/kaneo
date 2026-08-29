import { Bookmark, Bug, SquareCheck, Zap } from "lucide-react";

// ASYGNUZ: Jira-style issue type icon, shown next to the task ID on cards
// and in the list view. "epic" is an explicit choice a person makes when
// creating/editing a task -- independent of whether it happens to have
// subtasks. Whether the list view draws a task as a parent (chevron,
// nesting) is a separate thing, driven by "subtask" task_relation rows;
// any type can have children.
export function getIssueTypeIcon(issueType: string | null | undefined) {
  switch (issueType) {
    case "epic":
      return (
        <Zap className="h-[12px] w-[12px] fill-violet-500/20 text-violet-500" />
      );
    case "story":
      return (
        <Bookmark className="h-[12px] w-[12px] fill-success-foreground/20 text-success-foreground" />
      );
    case "bug":
      return <Bug className="h-[12px] w-[12px] text-destructive-foreground" />;
    default:
      return (
        <SquareCheck className="h-[12px] w-[12px] fill-info-foreground/20 text-info-foreground" />
      );
  }
}
