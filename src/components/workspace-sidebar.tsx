import { ArrowLeft, ChevronDown, ChevronRight, Database, Eye, Sigma, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Connection, SchemaNode } from "@/shared/ipc";

type ExplorerItem = {
  id: string;
  kind: "table" | "view" | "function";
  name: string;
  subtitle: string;
  queryable: boolean;
};

type ObjectContextMenu = {
  x: number;
  y: number;
  schema: string;
  itemName: string;
};

type SchemaExplorerNode = SchemaNode & {
  items: ExplorerItem[];
};

interface WorkspaceSidebarProps {
  activeConnection: Connection;
  objectSearch: string;
  onObjectSearchChange: (value: string) => void;
  schemas: SchemaNode[];
  selectedSchema: string;
  setSelectedSchema: (schemaName: string) => void;
  ensureSchemaHydrated: (schemaName: string) => void;
  onOpenObject: (schemaName: string, objectName: string) => void;
  onBack: () => void;
}

function buildSchemaExplorerNodes(
  schemas: SchemaNode[],
  objectFilter: string,
  selectedSchema: string,
  expandedSchemas: Record<string, boolean>,
) {
  return schemas
    .map<SchemaExplorerNode>((schema) => {
      const items: ExplorerItem[] = [
        ...schema.tables.map((table) => ({
          id: `table:${schema.name}:${table.name}`,
          kind: "table" as const,
          name: table.name,
          subtitle: [table.rowCount, `${table.columns} columns`].filter(Boolean).join(" • "),
          queryable: true,
        })),
        ...schema.views.map((view) => ({
          id: `view:${schema.name}:${view.name}`,
          kind: "view" as const,
          name: view.name,
          subtitle: `${view.columns} columns`,
          queryable: true,
        })),
        ...schema.functions.map((fn) => ({
          id: `function:${schema.name}:${fn.name}`,
          kind: "function" as const,
          name: fn.name,
          subtitle: "Function",
          queryable: false,
        })),
      ];

      if (!objectFilter) {
        return { ...schema, items };
      }

      const matchesSchema = schema.name.toLowerCase().includes(objectFilter);
      const filteredItems = items.filter((item) => [item.name, item.subtitle, schema.name].join(" ").toLowerCase().includes(objectFilter));

      return {
        ...schema,
        items: matchesSchema ? items : filteredItems,
      };
    })
    .filter((schema) => !objectFilter || schema.name.toLowerCase().includes(objectFilter) || schema.items.length > 0)
    .sort((left, right) => {
      const leftPriority = left.name === selectedSchema || expandedSchemas[left.name] ? 0 : 1;
      const rightPriority = right.name === selectedSchema || expandedSchemas[right.name] ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (left.name === selectedSchema && right.name !== selectedSchema) {
        return -1;
      }

      if (right.name === selectedSchema && left.name !== selectedSchema) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function SchemaItemIcon({ kind }: Pick<ExplorerItem, "kind">) {
  if (kind === "table") {
    return <Table2 className="size-3.5 shrink-0 text-muted-foreground" />;
  }

  if (kind === "view") {
    return <Eye className="size-3.5 shrink-0 text-muted-foreground" />;
  }

  return <Sigma className="size-3.5 shrink-0 text-muted-foreground" />;
}

export function WorkspaceSidebar({
  activeConnection,
  objectSearch,
  onObjectSearchChange,
  schemas,
  selectedSchema,
  setSelectedSchema,
  ensureSchemaHydrated,
  onOpenObject,
  onBack,
}: WorkspaceSidebarProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({});
  const [objectContextMenu, setObjectContextMenu] = useState<ObjectContextMenu | null>(null);
  const objectFilter = objectSearch.trim().toLowerCase();
  const filteredSchemas = useMemo(
    () => buildSchemaExplorerNodes(schemas, objectFilter, selectedSchema, expandedSchemas),
    [expandedSchemas, objectFilter, schemas, selectedSchema],
  );

  useEffect(() => {
    if (!selectedSchema) {
      return;
    }

    setExpandedSchemas((current) => (current[selectedSchema] ? current : { ...current, [selectedSchema]: true }));
  }, [selectedSchema]);

  useEffect(() => {
    if (!objectContextMenu) {
      return undefined;
    }

    const closeMenu = () => setObjectContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [objectContextMenu]);

  const toggleSchema = (schemaName: string) => {
    const nextExpanded = !expandedSchemas[schemaName];
    setExpandedSchemas((current) => ({ ...current, [schemaName]: nextExpanded }));
    setSelectedSchema(schemaName);

    if (nextExpanded) {
      ensureSchemaHydrated(schemaName);
    }
  };

  const renderSchemaItems = (schemaName: string, items: ExplorerItem[]) => {
    if (items.length === 0) {
      return (
        <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
          {objectFilter ? "No matching objects." : "No objects loaded yet."}
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            onClick={() => setSelectedSchema(schemaName)}
            onContextMenu={
              item.queryable
                ? (event) => {
                    event.preventDefault();
                    setObjectContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      schema: schemaName,
                      itemName: item.name,
                    });
                  }
                : undefined
            }
            className="h-auto w-full justify-start rounded-md px-2.5 py-2 text-left"
          >
            <div className="flex min-w-0 items-center gap-2">
              <SchemaItemIcon kind={item.kind} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{item.name}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">{item.subtitle}</p>
              </div>
            </div>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <>
      <aside
        className="flex min-h-0 w-[280px] shrink-0 flex-col border-r border-[var(--border)] backdrop-blur-sm"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${activeConnection.color} 32%, rgba(17, 19, 23, 0.8)) 0%, color-mix(in srgb, ${activeConnection.color} 16%, rgba(17, 19, 23, 0.76)) 55%, rgba(17, 19, 23, 0.72) 100%)`,
        }}
      >
        <div className="border-b border-[var(--border)] px-4 pb-4 pt-[calc(var(--window-titlebar-height)+0.5rem)]">
          <div className="flex items-center gap-2">
            <div
              className="flex size-6 items-center justify-center border border-[var(--border)] text-white"
              style={{ backgroundColor: activeConnection.color }}
            >
              <Database className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-semibold">{activeConnection.name}</p>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeConnection.color }} />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                <span>{activeConnection.kind}</span>
                <span>•</span>
                <span>{activeConnection.database}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {activeConnection.username}@{activeConnection.host}:{activeConnection.port}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Database</p>
          </div>
          <Select value={activeConnection.database} disabled>
            <SelectTrigger disabled>
              <span className="truncate">{activeConnection.database}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={activeConnection.database}>{activeConnection.database}</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-2">
            <Input value={objectSearch} onChange={(event) => onObjectSearchChange(event.target.value)} placeholder="Filter" />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-2 py-3">
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Schemas</div>

            <div className="space-y-1">
              {filteredSchemas.length > 0 ? (
                filteredSchemas.map((schema) => {
                  const isExpanded = objectFilter ? true : Boolean(expandedSchemas[schema.name]);
                  const isSelected = schema.name === selectedSchema;

                  return (
                    <div key={schema.name} className="space-y-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleSchema(schema.name)}
                        className={cn(
                          "h-auto w-full justify-start rounded-md px-2 py-2 text-left",
                          isSelected && "bg-[var(--panel-muted)] text-foreground",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <Database className="size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{schema.name}</p>
                            <p className="text-[11px] text-[var(--muted-foreground)]">{schema.items.length} objects</p>
                          </div>
                        </div>
                      </Button>

                      {isExpanded ? <div className="ml-4">{renderSchemaItems(schema.name, schema.items)}</div> : null}
                    </div>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                  {objectFilter ? "No matching schemas or objects." : "No schemas loaded yet."}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-[var(--border)] p-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-full justify-start">
            <ArrowLeft className="size-4" />
            Back to Connections
          </Button>
        </div>
      </aside>

      {objectContextMenu ? (
        <Card
          className="fixed z-50 w-40 gap-0 rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 py-1 text-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          style={{ left: objectContextMenu.x, top: objectContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start rounded-[4px] px-2 text-[12px]"
            onClick={() => {
              setObjectContextMenu(null);
              onOpenObject(objectContextMenu.schema, objectContextMenu.itemName);
            }}
          >
            View
          </Button>
        </Card>
      ) : null}
    </>
  );
}
