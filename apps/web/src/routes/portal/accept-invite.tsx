import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientPortalAuth } from "@/lib/client-portal-api";

const acceptInviteSearchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/portal/accept-invite")({
  component: AcceptClientInvite,
  validateSearch: acceptInviteSearchSchema,
});

function AcceptClientInvite() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  if (!token) {
    return (
      <>
        <PageTitle title="Invitación inválida" hideAppName />
        <AuthLayout title="Enlace inválido">
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Este enlace de invitación no es válido. Pide que te reenvíen la
              invitación.
            </p>
          </div>
        </AuthLayout>
      </>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsPending(true);
    try {
      await clientPortalAuth.acceptInvite(token, password, name || undefined);
      navigate({ to: "/portal" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo activar la cuenta.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <PageTitle title="Configura tu cuenta" hideAppName />
      <AuthLayout
        title="Configura tu cuenta"
        subtitle="Crea una contraseña para entrar al portal de clientes."
      >
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nombre (opcional)</Label>
            <Input
              id="invite-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-password">Contraseña</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-confirm-password">
              Confirmar contraseña
            </Label>
            <Input
              id="invite-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            size="sm"
            className="w-full mt-4"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Activando...
              </>
            ) : (
              "Activar cuenta"
            )}
          </Button>
        </form>
      </AuthLayout>
    </>
  );
}
