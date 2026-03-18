import { useState, useCallback, useEffect } from "react";
import LoginPage from "@/components/LoginPage";
import Header from "@/components/Header";
import PaymentRequestForm from "@/components/PaymentRequestForm";
import AdminPanel from "@/components/AdminPanel";
import ConfirmationScreen from "@/components/ConfirmationScreen";
import { generatePDF, mergePDFs, generateFileName } from "@/lib/pdf-generator";
import { fetchConsecutivo, uploadPDF, saveRecord } from "@/lib/google-api";
import type { UserProfile, PaymentRequest } from "@/types/payment";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Index = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');
  const [consecutivo, setConsecutivo] = useState(70);
  const [confirmation, setConfirmation] = useState<{ numSP: string; driveUrl?: string } | null>(null);

  // Load consecutivo from Google Sheets on mount
  useEffect(() => {
    fetchConsecutivo()
      .then(val => setConsecutivo(val))
      .catch(err => {
        console.warn('No se pudo leer consecutivo de Sheets, usando valor local:', err);
      });
  }, []);

  const handleLogin = useCallback(() => {
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
    // 1. Generate PDF
    let pdfBytes = await generatePDF(data);

    if (data.documentoAdjunto) {
      const attachmentBytes = new Uint8Array(await data.documentoAdjunto.arrayBuffer());
      pdfBytes = await mergePDFs(pdfBytes, attachmentBytes);
    }

    const fileName = generateFileName(data);
    let driveUrl: string | undefined;

    // 2. Upload PDF to Google Drive
    try {
      const driveResult = await uploadPDF(fileName, pdfBytes);
      driveUrl = driveResult.url;
    } catch (err) {
      console.warn('No se pudo subir a Drive, descargando localmente:', err);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }

    // 3. Write row to Google Sheets
    try {
      await saveRecord({
        num_sp: data.numSP,
        empresa: data.empresa,
        orden_compra: data.ordenCompra,
        fecha_solicitud: format(data.fechaSolicitud, "dd/MM/yyyy", { locale: es }),
        fecha_pago: format(data.fechaPagoTentativa, "dd/MM/yyyy", { locale: es }),
        transferencia_nombre: data.transferenciaNombre,
        moneda: data.moneda,
        cuenta_banco: data.cuentaBanco,
        concepto_pago: data.conceptoPago,
        subtotal: data.subtotal,
        impuestos: data.impuestos,
        monto_total: data.montoTotal,
        comentarios: data.comentarios || '',
        documento: data.documentoAdjunto?.name || '',
        solicitante: user?.email || '',
        url_drive: driveUrl || '',
        overwrite: data.overwrite ?? false,
      });
    } catch (err) {
      console.warn('No se pudo escribir en Sheets:', err);
    }

    // 4. Refresh consecutivo from Sheets
    try {
      const newConsecutivo = await fetchConsecutivo();
      setConsecutivo(newConsecutivo);
    } catch {
      // Fallback: increment locally
      const autoNum = String(consecutivo).padStart(3, '0');
      if (data.numSP === autoNum) {
        setConsecutivo(prev => prev + 1);
      }
    }

    toast.success(driveUrl ? "PDF guardado en Drive exitosamente" : "PDF generado exitosamente");
    setConfirmation({ numSP: data.numSP, driveUrl });
  }, [consecutivo, user]);

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
