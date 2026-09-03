import { FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import useCreateDocPage from "@/hooks/mutations/doc-page/use-create-doc-page";
import useDeleteDocPage from "@/hooks/mutations/doc-page/use-delete-doc-page";
import useUpdateDocPage from "@/hooks/mutations/doc-page/use-update-doc-page";
import { useGetDocPage } from "@/hooks/queries/doc-page/use-get-doc-page";
import { useGetDocPages } from "@/hooks/queries/doc-page/use-get-doc-pages";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type DocPageListItem = {
  id: string;
  parentId: string | null;
  title: string;
  position: number;
};

type TreeNode = DocPageListItem & { children: TreeNode[] };

function buildTree(pages: DocPageListItem[]): TreeNode[] {
  const byParent = new Map<string | null, DocPageListItem[]>();
  for (const page of pages) {
    const siblings = byParent.get(page.parentId) ?? [];
    siblings.push(page);
    byParent.set(page.parentId, siblings);
  }

  function attach(parentId: string | null): TreeNode[] {
    const siblings = byParent.get(parentId) ?? [];
    return siblings
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((page) => ({ ...page, children: attach(page.id) }));
  }

  return attach(null);
}

type DocPageEditorProps = {
  projectId: string;
};

export default function DocPageEditor({ projectId }: DocPageEditorProps) {
  const { t } = useTranslation();
  const { canUpdateProjects } = useWorkspacePermission();
  const canEdit = canUpdateProjects();

  const { data: pages, isLoading } = useGetDocPages(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selectedPage } = useGetDocPage(selectedId);

  const { mutateAsync: createPage } = useCreateDocPage();
  const { mutateAsync: updatePage } = useUpdateDocPage();
  const { mutateAsync: deletePage } = useDeleteDocPage();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (selectedPage) {
      setTitle(selectedPage.title);
      setContent(selectedPage.content);
      setIsDirty(false);
    }
  }, [selectedPage]);

  const tree = useMemo(() => buildTree(pages ?? []), [pages]);

  // Only picks an initial page when nothing is selected yet -- it must NOT
  // also correct a selection that's merely absent from a stale `pages`
  // list, since right after creating a page this effect would otherwise
  // run before the list has re-fetched to include it and bounce the brand
  // new selection back to the first page. Deletion already clears
  // `selectedId` itself (see handleDelete) when the deleted page was
  // selected, so no reconciliation is needed here for that case either.
  useEffect(() => {
    if (!selectedId && pages && pages.length > 0) {
      setSelectedId(pages[0].id);
    }
  }, [pages, selectedId]);

  const handleCreate = async (parentId: string | null) => {
    try {
      const created = await createPage({
        projectId,
        parentId,
        title: t("settings:docPageEditor.untitled"),
      });
      setSelectedId(created.id);
      toast.success(t("settings:docPageEditor.toastCreated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:docPageEditor.toastCreateError"),
      );
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      await updatePage({ id: selectedId, title, content });
      setIsDirty(false);
      toast.success(t("settings:docPageEditor.toastSaved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:docPageEditor.toastSaveError"),
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePage({ id });
      if (selectedId === id) {
        setSelectedId(null);
      }
      toast.success(t("settings:docPageEditor.toastDeleted"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:docPageEditor.toastDeleteError"),
      );
    }
  };

  function renderNode(node: TreeNode, depth: number) {
    return (
      <div key={node.id}>
        {/** biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick and onKeyDown, matches kanban-board/task-card.tsx */}
        <div
          className={cn(
            "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-sidebar-accent",
            selectedId === node.id &&
              "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedId(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSelectedId(node.id);
            }
          }}
        >
          <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">{node.title}</span>
          {canEdit && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCreate(node.id);
                }}
                title={t("settings:docPageEditor.addSubpage")}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(node.id);
                }}
                title={t("common:actions.delete")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("settings:docPageEditor.loading")}
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[600px] border border-border rounded-md overflow-hidden">
      <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-2 space-y-1">
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 mb-2"
            onClick={() => void handleCreate(null)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("settings:docPageEditor.newPage")}
          </Button>
        )}
        {tree.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-4">
            {t("settings:docPageEditor.empty")}
          </p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {!selectedId || !selectedPage ? (
          <p className="text-sm text-muted-foreground">
            {t("settings:docPageEditor.selectPrompt")}
          </p>
        ) : (
          <div className="space-y-4 max-w-3xl">
            <Input
              value={title}
              disabled={!canEdit}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              className="text-lg font-medium h-auto py-2"
              placeholder={t("settings:docPageEditor.titlePlaceholder")}
            />
            <Textarea
              value={content}
              disabled={!canEdit}
              onChange={(e) => {
                setContent(e.target.value);
                setIsDirty(true);
              }}
              className="min-h-[420px] font-mono text-sm"
              placeholder={t("settings:docPageEditor.contentPlaceholder")}
            />
            {canEdit && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!isDirty || !title.trim()}
                  onClick={() => void handleSave()}
                >
                  {t("settings:docPageEditor.save")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
