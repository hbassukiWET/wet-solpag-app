import { useState, useCallback } from "react";
import LoginPage from "@/components/LoginPage";
import Header from "@/components/Header";
import PaymentRequestForm from "@/components/PaymentRequestForm";
import AdminPanel from "@/components/AdminPanel";
import ConfirmationScreen from "@/components/ConfirmationScreen";
import { generatePDF, mergePDFs, generateFileName } from "@/lib/pdf-generator";
import type { UserProfile, PaymentRequest } from "@/types/payment";
import { toast } from "sonner";

const Index = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');
  const [consecutivo, setConsecutivo] = useState(70); // Mock — will come from Sheets
  const [confirmation, setConfirmation] = useState<{ numSP: string; driveUrl?: string } | null>(null);

  const handleLogin = useCallback(() => {
    // Mock login — will be replaced with real Google OAuth
    const mockEmail = "usuario@wilbureagle.com";
    if (!mockEmail.endsWith("@wilbureagle.com")) {
      setLoginError("Acceso denegado. Solo cuentas @wilbureagle.com pueden acceder.");
      return;
    }
    setUser({ email: mockEmail, name: "Usuario Demo", picture: undefined });
    setLoginError(null);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setConfirmation(null);
  }, []);

  const handleSubmit = useCallback(async (data: PaymentRequest) => {
    // Generate PDF
    let pdfBytes = await generatePDF(data);

    // Merge with attachment if present
    if (data.documentoAdjunto) {
      const attachmentBytes = new Uint8Array(await data.documentoAdjunto.arrayBuffer());
      pdfBytes = await mergePDFs(pdfBytes, attachmentBytes);
    }

    const fileName = generateFileName(data);

    // Download PDF locally for now (Drive integration later)
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // Update consecutivo if using auto
    const autoNum = String(consecutivo).padStart(3, '0');
    if (data.numSP === autoNum) {
      setConsecutivo(prev => prev + 1);
    }

    toast.success("PDF generado exitosamente");
    setConfirmation({ numSP: data.numSP, driveUrl: undefined });
  }, [consecutivo]);

  const handleNewRequest = useCallback(() => {
    setConfirmation(null);
  }, []);

  const handleUpdateConsecutivo = useCallback((newValue: number) => {
    setConsecutivo(newValue);
    toast.success(`Consecutivo actualizado a ${String(newValue).padStart(3, '0')}`);
  }, []);

  if (!user) {
    return <LoginPage onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'form' ? (
          confirmation ? (
            <ConfirmationScreen
              numSP={confirmation.numSP}
              driveUrl={confirmation.driveUrl}
              onNewRequest={handleNewRequest}
            />
          ) : (
            <PaymentRequestForm
              currentConsecutivo={consecutivo}
              onSubmit={handleSubmit}
            />
          )
        ) : (
          <AdminPanel
            currentConsecutivo={consecutivo}
            onUpdateConsecutivo={handleUpdateConsecutivo}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
