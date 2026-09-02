import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { AuthLayout } from "@/components/auth/layout";
import { Turnstile } from "@/components/auth/turnstile";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clientPortalAuth } from "@/lib/client-portal-api";

// ASYGNUZ: Service Desk client portal login. Separate identity from the
// internal app's /auth/sign-in -- see client-auth/middleware.ts. Same
// Turnstile widget/pattern as /auth/sign-in -- see the KANEO_TURNSTILE_SITE_KEY
// placeholder in apps/web/.env.production for how the site key reaches the
// built bundle at container startup.

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

export const Route = createFileRoute("/portal/login")({
  component: ClientPortalLogin,
});

function ClientPortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // ASYGNUZ: bumping this remounts <Turnstile> (via key), which forces a
  // fresh challenge/token. Needed because a Turnstile token is single-use --
  // once it's sent in a login attempt (success OR failure; the backend calls
  // Cloudflare's siteverify either way, which burns it), reusing it on a
  // retry always fails with "timeout-or-duplicate". Without this, a wrong
  // password (or logging out and back in) left the stale, already-consumed
  // token in state, the submit button looked usable (a token was still
  // present), and every retry failed the same way until the user noticed
  // the widget's own "Actualizar" link.
  const [turnstileKey, setTurnstileKey] = useState(0);

  const captchaConfigured = Boolean(TURNSTILE_SITE_KEY);
  const captchaPending = captchaConfigured && !turnstileToken;

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);
  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await clientPortalAuth.login(
        email,
        password,
        captchaConfigured ? (turnstileToken ?? undefined) : undefined,
      );
      navigate({ to: "/portal" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setIsPending(false);
      // The token this attempt used (if any) is burned either way -- clear
      // it and remount the widget so the next attempt gets a fresh one.
      if (captchaConfigured) {
        setTurnstileToken(null);
        setTurnstileKey((k) => k + 1);
      }
    }
  };

  return (
    <>
      <PageTitle title="Portal de clientes" hideAppName />
      <AuthLayout
        title="Portal de clientes"
        subtitle="Ingresa para ver y hacer seguimiento a tus solicitudes."
      >
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="portal-email">Correo</Label>
            <Input
              id="portal-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-password">Contraseña</Label>
            <Input
              id="portal-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {captchaConfigured && TURNSTILE_SITE_KEY && (
            <Turnstile
              key={turnstileKey}
              siteKey={TURNSTILE_SITE_KEY}
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
            />
          )}

          <Button
            type="submit"
            disabled={isPending || captchaPending}
            size="sm"
            className="w-full mt-4"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ingresando...
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>
      </AuthLayout>
    </>
  );
}
