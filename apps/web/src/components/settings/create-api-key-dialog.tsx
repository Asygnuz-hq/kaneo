import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { statement } from "@kaneo/permissions";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import useCreateApiKey from "@/hooks/mutations/api-key/use-create-api-key";
import { toast } from "@/lib/toast";
import type { CreateApiKeyResponse } from "@/types/api-key";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

// Resources an API key's scope can be narrowed to. Only the ones a caller
// could plausibly hand to an external integration (task/project/label) --
// `workspace` management and org-level statements stay out of this picker,
// since scoping a key to those isn't a case this dialog needs to serve.
const SCOPABLE_RESOURCES = [
  "project",
  "task",
  "label",
] as const satisfies ReadonlyArray<keyof typeof statement>;

const EXPIRATION_SECONDS = {
  "1d": 86400,
  "7d": 604800,
  "30d": 2592000,
  "90d": 7776000,
} as const;

type FormValues = {
  name: string;
  expiresIn: string;
};

type CreateApiKeyDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: CreateApiKeyResponse) => void;
};

export function CreateApiKeyDialog({
  open,
  onClose,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: createApiKey } = useCreateApiKey();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoped, setScoped] = useState(false);
  const [selectedActions, setSelectedActions] = useState<
    Record<string, Set<string>>
  >({});

  const toggleAction = (resource: string, action: string) => {
    setSelectedActions((current) => {
      const next = { ...current };
      const forResource = new Set(next[resource] ?? []);
      if (forResource.has(action)) {
        forResource.delete(action);
      } else {
        forResource.add(action);
      }
      next[resource] = forResource;
      return next;
    });
  };

  const scopedPermissions = useMemo(() => {
    if (!scoped) return undefined;
    const result: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(selectedActions)) {
      if (actions.size > 0) result[resource] = Array.from(actions);
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [scoped, selectedActions]);

  const createApiKeySchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:apiKey.createDialog.validation.nameRequired"))
          .min(3, t("settings:apiKey.createDialog.validation.nameShort")),
        expiresIn: z
          .string()
          .min(
            1,
            t("settings:apiKey.createDialog.validation.expirationRequired"),
          ),
      }),
    [t],
  );

  const expirationOptions = useMemo(
    () =>
      [
        {
          label: t("settings:apiKey.createDialog.expiration1d"),
          value: "1d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration7d"),
          value: "7d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration30d"),
          value: "30d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration90d"),
          value: "90d",
        },
        {
          label: t("settings:apiKey.createDialog.expirationNever"),
          value: "never",
        },
      ] as const,
    [t],
  );

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      expiresIn: "30d",
    },
  });

  const onSubmit = async (data: FormValues) => {
    const expiresInValue =
      data.expiresIn === "never"
        ? null
        : EXPIRATION_SECONDS[data.expiresIn as keyof typeof EXPIRATION_SECONDS];

    setIsSubmitting(true);
    try {
      const result = await createApiKey({
        name: data.name,
        expiresIn: expiresInValue ?? null,
        permissions: scopedPermissions,
      });

      form.reset();
      setScoped(false);
      setSelectedActions({});
      onSuccess(result);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:apiKey.createDialog.failedCreate"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      setScoped(false);
      setSelectedActions({});
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle>{t("settings:apiKey.createDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:apiKey.createDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <div className="space-y-5 px-6 py-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings:apiKey.createDialog.nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          "settings:apiKey.createDialog.namePlaceholder",
                        )}
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("settings:apiKey.createDialog.nameDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings:apiKey.createDialog.expirationLabel")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "settings:apiKey.createDialog.expirationPlaceholder",
                            )}
                          >
                            {expirationOptions.find(
                              (o) => o.value === field.value,
                            )?.label ?? field.value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {expirationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {t("settings:apiKey.createDialog.expirationDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {t("settings:apiKey.createDialog.scopedLabel")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings:apiKey.createDialog.scopedDescription")}
                  </p>
                </div>
                <Switch
                  checked={scoped}
                  onCheckedChange={setScoped}
                  disabled={isSubmitting}
                />
              </div>

              {scoped && (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  {SCOPABLE_RESOURCES.map((resource) => (
                    <div key={resource} className="flex flex-col gap-1.5">
                      <p className="text-sm font-medium capitalize">
                        {resource}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {statement[resource].map((action) => {
                          const inputId = `api-key-scope-${resource}-${action}`;
                          return (
                            <label
                              key={action}
                              htmlFor={inputId}
                              className="flex items-center gap-1.5 text-sm text-muted-foreground"
                            >
                              <Checkbox
                                id={inputId}
                                checked={
                                  selectedActions[resource]?.has(action) ??
                                  false
                                }
                                onCheckedChange={() =>
                                  toggleAction(resource, action)
                                }
                                disabled={isSubmitting}
                              />
                              {action}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t("settings:apiKey.createDialog.creating")
                  : t("settings:apiKey.createDialog.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
