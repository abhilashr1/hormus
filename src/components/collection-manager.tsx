import { Database, GripVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getRandomAppBackground } from "@/assets/backgrounds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { getDatabaseDefaultPort, getDatabaseLabel } from "@/shared/database";
import type { Connection } from "@/shared/ipc";

type FormState = {
  id?: string;
  name: string;
  kind: Connection["kind"];
  authMethod: Connection["authMethod"];
  host: string;
  port: string;
  username: string;
  password?: string;
  database: string;
  readOnly: boolean;
  color: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const connectionColors = [
  "#2f80ed", // Blue
  "#27ae60", // Green
  "#eb5757", // Red
  "#f2994a", // Orange
  "#f2c94c", // Yellow
  "#56ccf2", // Light Blue
  "#9b51e0", // Purple
  "#bb6bd9", // Light Purple
  "#00a896", // Teal
  "#ff6b6b", // Light Red
];

const emptyForm: FormState = {
  name: "",
  kind: "postgresql",
  authMethod: "username_password",
  host: "localhost",
  port: String(getDatabaseDefaultPort("postgresql")),
  username: "",
  password: "",
  database: "",
  readOnly: false,
  color: connectionColors[0],
};

function authMethodLabel(method: Connection["authMethod"]) {
  return method === "username_password" ? "Username / Password" : method;
}

function fieldLabel(label: string, children: ReactNode, error?: string) {
  return (
    <div className="block">
      <Label className="mb-2 block text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <span className="mt-2 block text-xs text-[#d97b7b]">{error}</span> : null}
    </div>
  );
}

export function CollectionManager() {
  const state = useAppStore();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const activeBackground = useMemo(() => getRandomAppBackground(), []);

  const filteredConnections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return state.connections;
    }

    return state.connections.filter((connection) =>
      [connection.name, connection.host, connection.database, connection.username, getDatabaseLabel(connection.kind)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [search, state.connections]);

  const selectedConnection = state.connections.find((connection) => connection.id === selectedId) ?? null;
  const isCreating = mode === "create";
  const isEditing = mode === "edit";
  const showForm = isCreating || isEditing;

  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    const handlePointerMove = (event: MouseEvent) => {
      setSidebarWidth(Math.min(480, Math.max(280, event.clientX)));
    };

    const stopResizing = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSidebar]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
    setSubmitError("");
    setTestMessage(null);
  };

  const startCreate = () => {
    setIsSidebarVisible(true);
    setSelectedId("");
    setMode("create");
    setForm(emptyForm);
    setErrors({});
    setSubmitError("");
    setTestMessage(null);
  };

  const startEdit = (connection: Connection) => {
    setIsSidebarVisible(true);
    setSelectedId(connection.id);
    setMode("edit");
    setErrors({});
    setSubmitError("");
    setTestMessage(null);
    setForm({
      id: connection.id,
      name: connection.name,
      kind: connection.kind,
      authMethod: connection.authMethod,
      host: connection.host,
      port: String(connection.port),
      username: connection.username,
      password: "",
      database: connection.database,
      readOnly: connection.readOnly,
      color: connection.color,
    });
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Connection name is required.";
    }

    if (!form.host.trim()) {
      nextErrors.host = "Host is required.";
    }

    if (!form.port.trim()) {
      nextErrors.port = "Port is required.";
    } else {
      const port = Number(form.port);
      if (!Number.isInteger(port) || port <= 0) {
        nextErrors.port = "Port must be a positive integer.";
      }
    }

    if (!form.username.trim()) {
      nextErrors.username = "User is required.";
    }

    if (!form.database.trim()) {
      nextErrors.database = "Default database is required.";
    }

    return nextErrors;
  };

  const validateConnectionFields = () => {
    const nextErrors: FormErrors = {};

    if (!form.host.trim()) {
      nextErrors.host = "Host is required.";
    }

    if (!form.port.trim()) {
      nextErrors.port = "Port is required.";
    } else {
      const port = Number(form.port);
      if (!Number.isInteger(port) || port <= 0) {
        nextErrors.port = "Port must be a positive integer.";
      }
    }

    if (!form.username.trim()) {
      nextErrors.username = "User is required.";
    }

    if (!form.database.trim()) {
      nextErrors.database = "Default database is required.";
    }

    return nextErrors;
  };

  const testConnection = async () => {
    const nextErrors = validateConnectionFields();
    setErrors((current) => ({ ...current, ...nextErrors }));
    setSubmitError("");
    setTestMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsTesting(true);

    try {
      const result = await state.testConnection({
        id: form.id,
        kind: form.kind,
        authMethod: form.authMethod,
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        database: form.database.trim(),
        password: form.password || undefined,
      });
      setTestMessage({ kind: "success", text: `Connection succeeded in ${result.durationMs}ms.` });
    } catch (error) {
      setTestMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Connection test failed.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const submit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const input = {
      name: form.name.trim(),
      kind: form.kind,
      authMethod: form.authMethod,
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username.trim(),
      database: form.database.trim(),
      readOnly: form.readOnly,
      color: form.color,
      favorite: false,
      password: form.password || undefined,
    };

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await state.createConnection(input);
        await state.refreshConnections();
        const latest = useAppStore.getState().connections.at(-1);
        if (latest) {
          setSelectedId(latest.id);
          setMode("view");
        }
        setForm(emptyForm);
        return;
      }

      if (!form.id) {
        setSubmitError("Connection id is missing.");
        return;
      }

      await state.updateConnection({
        id: form.id,
        ...input,
      });
      await state.refreshConnections();
      setSelectedId(form.id);
      setMode("view");
      setForm(emptyForm);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeMainPanel = () => {
    setSelectedId("");
    setMode("view");
    setErrors({});
    setSubmitError("");
    setTestMessage(null);
  };

  return (
    <div
      className="min-h-screen bg-[var(--background)] pt-[var(--window-titlebar-height)] text-[13px] text-[var(--foreground)]"
      style={{
        backgroundImage: `linear-gradient(rgba(8, 9, 11, 0.72), rgba(8, 9, 11, 0.84)), url(${activeBackground.imageUrl})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="flex min-h-[calc(100vh-var(--window-titlebar-height))]">
        {isSidebarVisible ? (
          <>
            <aside
              className="flex min-h-0 shrink-0 overflow-hidden border-r border-[var(--border)] bg-[#111317]/80 backdrop-blur-sm"
              style={{ width: sidebarWidth }}
            >
              <div className="flex h-full min-h-0 w-full flex-col">
                <div className="border-b border-[var(--border)] p-4">
                  <div className="flex items-center">
                    <Button
                      className={cn(
                        "w-full justify-center",
                        isCreating ? "border border-white/12 bg-white text-black hover:bg-white/90" : undefined,
                      )}
                      onClick={startCreate}
                    >
                      <Plus className="size-4" />
                      New Connection
                    </Button>
                  </div>
                  <div className="relative mt-4">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Filter" />
                  </div>
                </div>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-4">
                    <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Saved {state.connections.length ? state.connections.length : ""}
                    </div>

                    {state.connections.length === 0 ? (
                      <Card className="border-dashed px-4 py-5 text-[13px] text-muted-foreground">
                        Add a new connection to begin
                      </Card>
                    ) : (
                      <div className="space-y-1">
                        {filteredConnections.map((connection) => (
                          <Button
                            key={connection.id}
                            type="button"
                            variant="ghost"
                            className={cn(
                              "h-auto w-full justify-start rounded-md px-3 py-3 text-left",
                              selectedId === connection.id && mode !== "create"
                                ? "bg-[var(--panel-elevated)]"
                                : undefined,
                            )}
                            onClick={() => {
                              setSelectedId(connection.id);
                              setMode("view");
                              setErrors({});
                              setSubmitError("");
                            }}
                            >
                              <span className="mt-0.5 h-8 w-1 shrink-0" style={{ backgroundColor: connection.color }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{connection.name}</span>
                              <span className="mt-1 block truncate text-[11px] text-[var(--muted-foreground)]">
                                {connection.host}:{connection.port}
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </aside>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              className="group relative w-0 shrink-0 cursor-col-resize"
              onMouseDown={() => setIsResizingSidebar(true)}
            >
              <div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-white/12 transition-colors group-hover:bg-white/20" />
              <div className="absolute left-0 top-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#111317]/95 text-[var(--muted-foreground)] shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <GripVertical className="size-3" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex w-14 shrink-0 items-start justify-center pt-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full border border-white/10 bg-[#111317]/80 backdrop-blur-sm"
              aria-label="Open sidebar"
              onClick={() => setIsSidebarVisible(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}

        <main className="flex min-h-0 flex-1 items-center justify-center bg-transparent p-8">
          {showForm ? (
            <Card className="w-full max-w-[560px] gap-0 rounded-lg border border-white/10 bg-[#0c0e11]/88 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-[18px] font-semibold">{isEditing ? "Edit Connection" : "New Connection"}</h1>
                    <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                      Save a PostgreSQL or MySQL database connection.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Close panel" onClick={closeMainPanel}>
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="mt-6 space-y-4">
                  {fieldLabel(
                    "Connection Type",
                    <Select
                      value={form.kind}
                      onValueChange={(value) => {
                        const kind = value as Connection["kind"];
                        setForm((current) => ({
                          ...current,
                          kind,
                          port:
                            current.port === String(getDatabaseDefaultPort(current.kind)) || !current.port
                              ? String(getDatabaseDefaultPort(kind))
                              : current.port,
                        }));
                        setSubmitError("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="postgresql">{getDatabaseLabel("postgresql")}</SelectItem>
                        <SelectItem value="mysql">{getDatabaseLabel("mysql")}</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}

                  {fieldLabel(
                    "Authentication Method",
                    <Select
                      value={form.authMethod}
                      onValueChange={(value) => setField("authMethod", value as Connection["authMethod"])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="username_password">Username / Password</SelectItem>
                      </SelectContent>
                    </Select>,
                  )}

                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                    {fieldLabel(
                      "Host",
                      <Input
                        value={form.host}
                        onChange={(event) => setField("host", event.target.value)}
                        className={errors.host ? "border-[#b65252]" : undefined}
                      />,
                      errors.host,
                    )}
                    {fieldLabel(
                      "Port",
                      <Input
                        value={form.port}
                        onChange={(event) => setField("port", event.target.value)}
                        className={errors.port ? "border-[#b65252]" : undefined}
                      />,
                      errors.port,
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {fieldLabel(
                      "User",
                      <Input
                        value={form.username}
                        onChange={(event) => setField("username", event.target.value)}
                        className={errors.username ? "border-[#b65252]" : undefined}
                      />,
                      errors.username,
                    )}
                    {fieldLabel(
                      "Password",
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(event) => setField("password", event.target.value)}
                      />,
                    )}
                  </div>

                  {fieldLabel(
                    "Default Database",
                    <Input
                      value={form.database}
                      onChange={(event) => setField("database", event.target.value)}
                      className={errors.database ? "border-[#b65252]" : undefined}
                    />,
                    errors.database,
                  )}

                  <Label className="flex items-center gap-3 text-[13px] text-muted-foreground">
                    <Checkbox checked={form.readOnly} onCheckedChange={(checked) => setField("readOnly", checked === true)} />
                    Read Only Mode
                  </Label>

                  <div>
                    <p className="mb-3 text-[11px] font-medium text-[var(--muted-foreground)]">Connection Color</p>
                    <div className="flex flex-wrap gap-2">
                      {connectionColors.map((color) => (
                        <Button
                          key={color}
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Use color ${color}`}
                          aria-pressed={form.color === color}
                          className={cn(
                            "size-7 rounded-md p-0 transition-transform",
                            form.color === color ? "scale-110 border-white" : "border-transparent hover:scale-105",
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setField("color", color)}
                        />
                      ))}
                    </div>
                  </div>

                  {fieldLabel(
                    "Connection Name",
                    <Input
                      value={form.name}
                      onChange={(event) => setField("name", event.target.value)}
                      className={errors.name ? "border-[#b65252]" : undefined}
                    />,
                    errors.name,
                  )}

                  {testMessage ? (
                    <p className={cn("text-[13px]", testMessage.kind === "success" ? "text-[#7acb8f]" : "text-[#d97b7b]")}>
                      {testMessage.text}
                    </p>
                  ) : null}

                  {submitError ? <p className="text-[13px] text-[#d97b7b]">{submitError}</p> : null}

                  <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
                    <Button variant="secondary" onClick={() => void testConnection()} disabled={isSubmitting || isTesting}>
                      {isTesting ? "Testing..." : "Test"}
                    </Button>
                    <Button onClick={() => void submit()} disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Save"}
                    </Button>
                  </div>
                </div>
            </Card>
          ) : (
            selectedConnection ? (
              <Card className="w-full max-w-[560px] gap-0 rounded-lg border border-white/10 bg-[#0c0e11]/88 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center text-white"
                        style={{ backgroundColor: selectedConnection.color }}
                      >
                        <Database className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h1 className="truncate text-[18px] font-semibold">{selectedConnection.name}</h1>
                        <p className="mt-2 text-[13px] text-[var(--muted-foreground)]">
                          {selectedConnection.username}@{selectedConnection.host}:{selectedConnection.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => void state.openWorkspace(selectedConnection.id)}>Connect</Button>
                      <Button type="button" variant="ghost" size="icon" aria-label="Close panel" onClick={closeMainPanel}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 text-[13px]">
                    <div className="flex justify-between border-b border-[var(--border)] py-3">
                      <span className="text-[var(--muted-foreground)]">Type</span>
                      <span>{getDatabaseLabel(selectedConnection.kind)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border)] py-3">
                      <span className="text-[var(--muted-foreground)]">Authentication</span>
                      <span>{authMethodLabel(selectedConnection.authMethod)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border)] py-3">
                      <span className="text-[var(--muted-foreground)]">Default Database</span>
                      <span>{selectedConnection.database}</span>
                    </div>
                    <div className="flex justify-between border-b border-[var(--border)] py-3">
                      <span className="text-[var(--muted-foreground)]">Mode</span>
                      <span>{selectedConnection.readOnly ? "Read only" : "Read / write"}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => startEdit(selectedConnection)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void state.deleteConnection(selectedConnection.id);
                        setSelectedId("");
                        startCreate();
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
              </Card>
            ) : null
            )}
        </main>
      </div>
    </div>
  );
}
