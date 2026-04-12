import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/lib/utils";

type ResizablePanelGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  direction?: "horizontal" | "vertical";
  orientation?: "horizontal" | "vertical";
  autoSaveId?: string;
  id?: string;
  keyboardResizeBy?: number | null;
  onLayout?: (sizes: number[]) => void;
  storage?: {
    getItem: (name: string) => string | null;
    setItem: (name: string, value: string) => void;
  };
  tagName?: keyof React.JSX.IntrinsicElements;
};

function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: ResizablePanelGroupProps) {
  const PanelGroup = ResizablePrimitive.Group as React.ComponentType<any>;
  const panelOrientation = orientation ?? direction ?? "horizontal";

  return (
    <PanelGroup
      orientation={panelOrientation}
      className={cn("flex h-full w-full", panelOrientation === "vertical" ? "flex-col" : "flex-row", className)}
      {...props}
    />
  );
}

const ResizablePanel = ResizablePrimitive.Panel;

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        "bg-border/70 focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-[var(--panel-elevated)] z-10 flex h-3 w-7 items-center justify-center rounded-sm border border-[var(--border)] text-muted-foreground">
          <GripVertical className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
