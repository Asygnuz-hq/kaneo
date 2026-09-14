import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
    error: search.error as string | undefined,
  }),
});

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "auth:resetPassword.passwordsDontMatch",
    path: ["confirmPassword"],
  });
type ResetPasswordValues = { newPassword: string; confirmPassword: string };

function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token, error: linkError } = useSearch({
    from: "/auth/reset-password",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordValues) => {
    if (!token) return;
    setIsPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: data.newPassword,
        token,
      });

      if (result.error) {
        toast.error(result.error.message || t("auth:resetPassword.failed"));
        return;
      }

      toast.success(t("auth:resetPassword.success"));
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:resetPassword.failed"),
      );
    } finally {
      setIsPending(false);
    }
  };

  if (linkError || !token) {
    return (
      <>
        <PageTitle title={t("auth:resetPassword.pageTitle")} />
        <AuthLayout title={t("auth:resetPassword.invalidLinkTitle")}>
          <p className="text-sm text-muted-foreground">
            {t("auth:resetPassword.invalidLinkMessage")}
          </p>
          <Button
            render={<a href="/auth/forgot-password" />}
            className="w-full mt-4"
            size="sm"
          >
            {t("auth:forgotPassword.sendLink")}
          </Button>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:resetPassword.pageTitle")} />
      <AuthLayout
        title={t("auth:resetPassword.title")}
        subtitle={t("auth:resetPassword.subtitle")}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("auth:resetPassword.newPassword")}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder={t("auth:forms.passwordPlaceholder")}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        autoFocus
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPassword
                            ? t("auth:forms.hidePassword")
                            : t("auth:forms.showPassword")
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("auth:resetPassword.confirmPassword")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("auth:forms.passwordPlaceholder")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={isPending}
              size="sm"
              className="w-full mt-2"
            >
              {isPending
                ? t("auth:resetPassword.saving")
                : t("auth:resetPassword.save")}
            </Button>
          </form>
        </Form>
      </AuthLayout>
    </>
  );
}
