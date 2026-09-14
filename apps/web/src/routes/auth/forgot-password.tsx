import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPassword,
});

const forgotPasswordSchema = z.object({ email: z.email() });
type ForgotPasswordValues = { email: string };

function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  const form = useForm<ForgotPasswordValues>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsPending(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (result.error) {
        toast.error(result.error.message || t("auth:forgotPassword.failed"));
        return;
      }

      navigate({
        to: "/auth/check-email",
        search: { email: data.email },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth:forgotPassword.failed"),
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title={t("auth:forgotPassword.pageTitle")} />
      <AuthLayout
        title={t("auth:forgotPassword.title")}
        subtitle={t("auth:forgotPassword.subtitle")}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {t("auth:forms.email")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("auth:forms.emailPlaceholder")}
                      type="email"
                      autoComplete="email"
                      autoFocus
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
                ? t("auth:forgotPassword.sending")
                : t("auth:forgotPassword.sendLink")}
            </Button>
          </form>
        </Form>

        <div className="mt-4 text-center">
          <Link
            to="/auth/sign-in"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("auth:checkEmail.backToLogin")}
          </Link>
        </div>
      </AuthLayout>
    </>
  );
}
