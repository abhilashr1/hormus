import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SqlParameterPlaceholder } from "@/shared/query";

interface QueryParameterDialogProps {
  open: boolean;
  parameters: SqlParameterPlaceholder[];
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}

function buildInitialValues(parameters: SqlParameterPlaceholder[]) {
  return Object.fromEntries(parameters.map((parameter) => [parameter.id, ""]));
}

function parameterLabel(parameter: SqlParameterPlaceholder) {
  if (parameter.kind === "anonymous") {
    return `? (${parameter.name})`;
  }

  return parameter.token;
}

export function QueryParameterDialog({
  open,
  parameters,
  onCancel,
  onSubmit,
}: QueryParameterDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(parameters));
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(buildInitialValues(parameters));
    setShowValidation(false);
  }, [open, parameters]);

  const missingParameterIds = useMemo(
    () => parameters.filter((parameter) => !values[parameter.id]?.trim()).map((parameter) => parameter.id),
    [parameters, values],
  );
  const canSubmit = missingParameterIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <DialogContent className="w-[min(92vw,420px)] gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Query Parameters</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-80 px-6 py-5">
          <div className="grid gap-4 pr-4">
            {parameters.map((parameter) => {
              const inputId = `query-parameter-${parameter.id.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
              const hasError = showValidation && missingParameterIds.includes(parameter.id);

              return (
                <div key={parameter.id} className="grid gap-2">
                  <Label htmlFor={inputId}>{parameterLabel(parameter)}</Label>
                  <Input
                    id={inputId}
                    value={values[parameter.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [parameter.id]: event.target.value,
                      }))
                    }
                    placeholder={parameter.kind === "anonymous" ? "Enter a SQL expression" : `Value for ${parameter.token}`}
                    aria-invalid={hasError || undefined}
                    autoFocus={parameter === parameters[0]}
                    className="selection:bg-white/16 selection:text-white focus-visible:border-white/18 focus-visible:ring-white/12 focus-visible:ring-[2px] focus-visible:shadow-none"
                  />
                  {hasError ? <div className="text-destructive text-xs">A value is required for this parameter.</div> : null}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!canSubmit) {
                setShowValidation(true);
                return;
              }

              onSubmit(values);
            }}
          >
            Execute Query
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
