import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useToggleReaction from "@/hooks/mutations/activity/use-toggle-reaction";
import { cn } from "@/lib/cn";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reaction-emojis";

type Reaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type CommentReactionsProps = {
  activityId: string;
  taskId: string;
  reactions: Reaction[];
};

export function CommentReactions({
  activityId,
  taskId,
  reactions,
}: CommentReactionsProps) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { mutate: toggleReaction } = useToggleReaction(taskId);

  const react = (emoji: ReactionEmoji) => {
    toggleReaction({ activityId, emoji });
    setIsPickerOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => react(reaction.emoji as ReactionEmoji)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
            reaction.reactedByMe
              ? "border-primary/40 bg-primary/10 text-primary-foreground"
              : "border-border/70 bg-muted/55 text-muted-foreground hover:bg-muted",
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium tabular-nums">{reaction.count}</span>
        </button>
      ))}

      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-5.5 w-5.5 items-center justify-center rounded-full text-muted-foreground/70 transition-opacity hover:text-foreground",
            reactions.length === 0 &&
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          aria-label={t("activity:comment.reactions.addReaction")}
          title={t("activity:comment.reactions.addReaction")}
        >
          <SmilePlus className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <div className="flex items-center gap-0.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
