import { Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { QueryTab } from "@/shared/ipc";

interface WorkspaceTabBarProps {
  activeTabId: string;
  canRunQuery: boolean;
  isRunningQuery: boolean;
  queryTabs: QueryTab[];
  renamingTabId: string | null;
  renameDraft: string;
  setRenameDraft: (value: string) => void;
  onStartRenamingTab: (tab: QueryTab) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab: () => void;
  onRunActiveTab: () => void;
}

export function WorkspaceTabBar({
  activeTabId,
  canRunQuery,
  isRunningQuery,
  queryTabs,
  renamingTabId,
  renameDraft,
  setRenameDraft,
  onStartRenamingTab,
  onCommitRename,
  onCancelRename,
  onSetActiveTab,
  onCloseTab,
  onCreateTab,
  onRunActiveTab,
}: WorkspaceTabBarProps) {
  return (
    <div
      className="flex h-[calc(2.75rem+var(--window-titlebar-height))] items-end border-b border-[var(--border)] px-3 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(16, 18, 22, 0.78)" }}
    >
      <Tabs value={activeTabId} onValueChange={onSetActiveTab} className="min-w-0 flex-1">
        <TabsList className="h-auto max-w-full justify-start gap-0 overflow-visible rounded-none bg-transparent p-0">
          {queryTabs.map((tab) => (
            <div
              key={tab.id}
              onContextMenu={(event) => {
                event.preventDefault();
                onStartRenamingTab(tab);
              }}
              className={cn(
                "group relative -mb-px inline-flex h-10 min-w-0 items-center border-r border-[var(--border)] text-[13px] transition-colors",
                tab.id === activeTabId
                  ? "z-10 border-x border-t border-b border-t-[var(--border)] border-b-white bg-[#0f1114] text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white after:content-['']"
                  : "border-b border-b-[var(--border)] text-muted-foreground hover:bg-[var(--panel-muted)] hover:text-foreground",
              )}
            >
              {renamingTabId === tab.id ? (
                <Input
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onCommitRename();
                    }
                    if (event.key === "Escape") {
                      onCancelRename();
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="h-7 w-[160px] rounded-none border-0 bg-transparent text-[13px] focus-visible:ring-0"
                />
              ) : (
                <TabsTrigger
                  value={tab.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onStartRenamingTab(tab);
                  }}
                  className="h-full max-w-[180px] justify-start truncate rounded-none border-0 bg-transparent px-4 text-[13px] hover:bg-transparent focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                >
                  <span className="truncate">{tab.title}</span>
                </TabsTrigger>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Close ${tab.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="mr-2 size-6 rounded-none bg-transparent text-inherit hover:bg-[var(--panel-elevated)] hover:text-foreground focus-visible:ring-0"
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </TabsList>
      </Tabs>
      <Button size="icon" variant="ghost" onClick={onCreateTab} className="mb-1 size-8 rounded-none">
        <Plus className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onRunActiveTab}
        disabled={!canRunQuery}
        aria-label={isRunningQuery ? "Running query" : "Run query"}
        className="mb-1 size-8 rounded-none text-[#55c27a] hover:text-[#6fd68f] disabled:text-[#3d6b4b]"
      >
        <Play className="size-4 fill-current" />
      </Button>
    </div>
  );
}
