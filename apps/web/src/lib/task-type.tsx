import { Bookmark, Bug, SquareCheck } from "lucide-react";

// ASYGNUZ: Jira-style issue type icon, shown next to the task ID on cards.
// "Épica" stays a derived, relation-based concept (list-view tree) rather
// than a stored value here -- these three are the ones a person picks.
export function getIssueTypeIcon(issueType: string | null | undefined) {
  switch (issueType) {
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
