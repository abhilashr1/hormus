import { Database, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import type { Connection } from "@/shared/ipc";

type FormState = {
  id?: string;
  name: string;
  kind: Connection["kind"];
  host: string;
  port: string;
  username: string;
  database: string;
  environment: Connection["environment"];
  readOnly: boolean;
  favorite: boolean;
  password?: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  kind: "postgresql",
  host: "",
  port: "5432",
  username: "",
  database: "",
  environment: "development",
  readOnly: false,
  favorite: false,
  password: "",
};

function kindLabel(kind: Connection["kind"]) {
  return kind === "postgresql" ? "PostgreSQL" : "MySQL";
}

function defaultPort(kind: Connection["kind"]) {
  return kind === "postgresql" ? "5432" : "3306";
}

export function CollectionManager() {
  const state = useAppStore();
  const [selectedId, setSelectedId] = useState<string>(state.connections[0]?.id ?? "");
  const selectedConnection = useMemo(
    () => state.connections.find((connection) => connection.id === selectedId) ?? null,
    [selectedId, state.connections],
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  };

  useEffect(() => {
    if (!selectedId && state.connections[0]) {
      setSelectedId(state.connections[0].id);
    }
  }, [selectedId, state.connections]);

  const resetCreate = () => {
    setMode("create");
    setForm(emptyForm);
    setErrors({});
    setSubmitError("");
  };

  const startEdit = (connection: Connection) => {
    setMode("edit");
    setErrors({});
    setSubmitError("");
    setForm({
      id: connection.id,
      name: connection.name,
      kind: connection.kind,
      host: connection.host,
      port: String(connection.port),
      username: connection.username,
      database: connection.database,
      environment: connection.environment,
      readOnly: connection.readOnly,
      favorite: connection.favorite ?? false,
      password: "",
    });
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Name is required.";
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
      nextErrors.database = "Database is required.";
    }

    return nextErrors;
  };

  const submit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const port = Number(form.port);
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await state.createConnection({
          name: form.name,
          kind: form.kind,
          host: form.host,
          port,
          username: form.username,
          database: form.database,
          environment: form.environment,
          readOnly: form.readOnly,
          favorite: form.favorite,
          password: form.password || undefined,
        });
        await state.refreshConnections();
        const latest = useAppStore.getState().connections.at(-1);
        if (latest) {
          setSelectedId(latest.id);
        }
        resetCreate();
        return;
      }

      if (!form.id) {
        setSubmitError("Connection id is missing.");
        return;
      }

      await state.updateConnection({
        id: form.id,
        name: form.name,
        kind: form.kind,
        host: form.host,
        port,
        username: form.username,
        database: form.database,
        environment: form.environment,
        readOnly: form.readOnly,
        favorite: form.favorite,
        password: form.password || undefined,
      });
      await state.refreshConnections();
      setSelectedId(form.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-3 text-[var(--foreground)]">
      <div className="mx-auto grid min-h-[calc(100vh-0.75rem)] max-w-[1600px] overflow-hidden border border-[var(--border)] bg-[#0f1114] xl:grid-cols-[minmax(0,1.4fr)_420px]">
        <div className="border-r border-[var(--border)]">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Collection Manager</p>
              <h1 className="mt-2 text-3xl font-semibold">Choose a database to work on</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
                Create, edit, and organize saved connections before opening the per-connection query workspace.
              </p>
            </div>
            <Button onClick={resetCreate}>
              <Plus className="size-4" />
              New Connection
            </Button>
          </div>

          <div className="border-b border-[var(--border)] px-5 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input className="pl-9" placeholder="Search connections" />
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-2 2xl:grid-cols-3">
            {state.connections.map((connection) => (
              <button
                key={connection.id}
                className={cn(
                  "cursor-pointer border-b border-r border-[var(--border)] px-4 py-4 text-left transition-colors",
                  selectedId === connection.id ? "bg-[rgba(94,106,210,0.08)]" : "bg-transparent hover:bg-[var(--panel-muted)]",
                )}
                onClick={() => setSelectedId(connection.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center border border-[var(--border)] bg-[var(--panel-muted)] text-[var(--accent)]">
                        <Database className="size-3.5" />
                      </div>
                      <p className="truncate text-[14px] font-medium">{connection.name}</p>
                    </div>
                  </div>
                  <Badge>{connection.environment}</Badge>
                </div>

                <div className="mt-4 space-y-1 text-[12px] text-[var(--muted-foreground)]">
                  <p>{kindLabel(connection.kind)}</p>
                  <p>
                    {connection.host}:{connection.port}
                  </p>
                  <p>{connection.username}</p>
                  <p>{connection.database}</p>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    {connection.readOnly ? "read-only" : "read / write"} · {connection.latencyMs}ms
                  </div>
                  <Button
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void state.openWorkspace(connection.id);
                    }}
                  >
                    Open
                  </Button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[var(--panel)] p-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                {mode === "create" ? "New Connection" : "Edit Connection"}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                {mode === "create" ? "Create connection" : form.name || "Update connection"}
              </h2>
            </div>
            {selectedConnection ? (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" onClick={() => startEdit(selectedConnection)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (selectedConnection) {
                      void state.deleteConnection(selectedConnection.id);
                      setSelectedId(state.connections.find((item) => item.id !== selectedConnection.id)?.id ?? "");
                      resetCreate();
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Name</p>
              <Input
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                className={errors.name ? "border-[#b65252]" : undefined}
              />
              {errors.name ? <p className="mt-2 text-xs text-[#d97b7b]">{errors.name}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Type</p>
                <Select
                  value={form.kind}
                  onChange={(event) => {
                    const kind = event.target.value as Connection["kind"];
                    setForm((current) => ({
                      ...current,
                      kind,
                      port: current.port === defaultPort(current.kind) || !current.port ? defaultPort(kind) : current.port,
                    }));
                    setSubmitError("");
                  }}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </Select>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Environment</p>
                <Select
                  value={form.environment}
                  onChange={(event) => setField("environment", event.target.value as Connection["environment"])}
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </Select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Host</p>
              <Input
                value={form.host}
                onChange={(event) => setField("host", event.target.value)}
                className={errors.host ? "border-[#b65252]" : undefined}
              />
              {errors.host ? <p className="mt-2 text-xs text-[#d97b7b]">{errors.host}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Port</p>
                <Input
                  value={form.port}
                  onChange={(event) => setField("port", event.target.value)}
                  className={errors.port ? "border-[#b65252]" : undefined}
                />
                {errors.port ? <p className="mt-2 text-xs text-[#d97b7b]">{errors.port}</p> : null}
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">User</p>
                <Input
                  value={form.username}
                  onChange={(event) => setField("username", event.target.value)}
                  className={errors.username ? "border-[#b65252]" : undefined}
                />
                {errors.username ? <p className="mt-2 text-xs text-[#d97b7b]">{errors.username}</p> : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Database</p>
              <Input
                value={form.database}
                onChange={(event) => setField("database", event.target.value)}
                className={errors.database ? "border-[#b65252]" : undefined}
              />
              {errors.database ? <p className="mt-2 text-xs text-[#d97b7b]">{errors.database}</p> : null}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Password</p>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
              />
            </div>

            <label className="flex items-center gap-3 border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.readOnly}
                onChange={(event) => setField("readOnly", event.target.checked)}
              />
              Mark as read-only
            </label>

            {submitError ? <p className="text-sm text-[#d97b7b]">{submitError}</p> : null}

            <div className="flex gap-2 pt-2">
              <Button onClick={() => void submit()} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : mode === "create" ? "Create Connection" : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={resetCreate} disabled={isSubmitting}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
