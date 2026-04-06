import { Database, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
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
  "#2f80ed",
  "#27ae60",
  "#eb5757",
  "#f2994a",
  "#f2c94c",
  "#56ccf2",
  "#9b51e0",
  "#bb6bd9",
  "#00a896",
  "#ff6b6b",
];

const emptyForm: FormState = {
  name: "",
  kind: "postgresql",
  authMethod: "username_password",
  host: "localhost",
  port: "5432",
  username: "",
  password: "",
  database: "",
  readOnly: false,
  color: connectionColors[0],
};

function kindLabel(kind: Connection["kind"]) {
  return kind === "postgresql" ? "PostgreSQL" : "MySQL";
}

function authMethodLabel(method: Connection["authMethod"]) {
  return method === "username_password" ? "Username / Password" : method;
}

function defaultPort(kind: Connection["kind"]) {
  return kind === "postgresql" ? "5432" : "3306";
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

  const filteredConnections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return state.connections;
    }

    return state.connections.filter((connection) =>
      [connection.name, connection.host, connection.database, connection.username, kindLabel(connection.kind)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [search, state.connections]);

  const selectedConnection = state.connections.find((connection) => connection.id === selectedId) ?? null;
  const isEditing = mode === "edit";
  const showForm = mode === "create" || isEditing || !selectedConnection;

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
    setSelectedId("");
    setMode("create");
    setForm(emptyForm);
    setErrors({});
    setSubmitError("");
    setTestMessage(null);
  };

  const startEdit = (connection: Connection) => {
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

  return (
    <div className="min-h-screen bg-[var(--background)] pt-[var(--window-titlebar-height)] text-[var(--foreground)]">
      <div className="grid min-h-[calc(100vh-var(--window-titlebar-height))] grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[#111317]">
          <div className="border-b border-[var(--border)] p-4">
            <Button className="w-full justify-center" onClick={startCreate}>
              <Plus className="size-4" />
              New Connection
            </Button>
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
              <Card className="border-dashed px-4 py-5 text-sm text-muted-foreground">
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
                      <span className="block truncate text-sm font-medium">{connection.name}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--muted-foreground)]">
                        {connection.host}:{connection.port}
                      </span>
                    </span>
                    <span className="rounded-[6px] bg-[var(--panel-elevated)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                      {connection.kind}
                    </span>
                  </Button>
                ))}
              </div>
            )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex min-h-0 items-center justify-center bg-[#08090b] p-8">
          <Card className="w-full max-w-[560px] gap-0 rounded-lg p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            {showForm ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-semibold">{isEditing ? "Edit Connection" : "New Connection"}</h1>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      Save a PostgreSQL or MySQL database connection.
                    </p>
                  </div>
                  {selectedConnection ? (
                    <Button variant="ghost" size="sm" onClick={() => setMode(selectedConnection ? "view" : "create")}>
                      Cancel
                    </Button>
                  ) : null}
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
                          port: current.port === defaultPort(current.kind) || !current.port ? defaultPort(kind) : current.port,
                        }));
                        setSubmitError("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="postgresql">PostgreSQL</SelectItem>
                        <SelectItem value="mysql">MySQL</SelectItem>
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

                  <Label className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Checkbox checked={form.readOnly} onCheckedChange={(checked) => setField("readOnly", checked === true)} />
                    Read Only Mode
                  </Label>

                  <div>
                    <p className="mb-3 text-xs font-medium text-[var(--muted-foreground)]">Connection Color</p>
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
                    <p className={cn("text-sm", testMessage.kind === "success" ? "text-[#7acb8f]" : "text-[#d97b7b]")}>
                      {testMessage.text}
                    </p>
                  ) : null}

                  {submitError ? <p className="text-sm text-[#d97b7b]">{submitError}</p> : null}

                  <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
                    <Button variant="secondary" onClick={() => void testConnection()} disabled={isSubmitting || isTesting}>
                      {isTesting ? "Testing..." : "Test"}
                    </Button>
                    <Button onClick={() => void submit()} disabled={isSubmitting}>
                      {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Save"}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              selectedConnection && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center text-white"
                        style={{ backgroundColor: selectedConnection.color }}
                      >
                        <Database className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h1 className="truncate text-xl font-semibold">{selectedConnection.name}</h1>
                        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                          {selectedConnection.username}@{selectedConnection.host}:{selectedConnection.port}
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => void state.openWorkspace(selectedConnection.id)}>Connect</Button>
                  </div>

                  <div className="mt-6 grid gap-3 text-sm">
                    <div className="flex justify-between border-b border-[var(--border)] py-3">
                      <span className="text-[var(--muted-foreground)]">Type</span>
                      <span>{kindLabel(selectedConnection.kind)}</span>
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
                </>
              )
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
