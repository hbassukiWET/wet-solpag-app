import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";

const LoginPage = () => {
  const { loginError, handleLoginSuccess } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-heading">Solicitud de Pago</CardTitle>
          <CardDescription className="text-base">
            Grupo Wilbur Eagle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              {loginError}
            </div>
          )}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => {}}
              theme="outline"
              size="large"
              text="signin_with"
              width="320"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Solo cuentas @wilbureagle.com
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
