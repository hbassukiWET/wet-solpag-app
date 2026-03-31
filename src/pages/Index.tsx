import { useState, useCallback, useEffect } from "react";
import LoginPage from "@/components/LoginPage";
import Header from "@/components/Header";
import PaymentRequestForm from "@/components/PaymentRequestForm";
import AdminPanel from "@/components/AdminPanel";
import type { SheetRecord } from "@/components/AdminPanel";
import ConfirmationScreen from "@/components/ConfirmationScreen";
import { generatePDF, mergePDFs, generateFileName } from "@/lib/pdf-generator";
import { fetchConsecutivo, uploadPDF, saveRecord } from "@/lib/google-api";
import type { PaymentRequest } from "@/types/payment";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Index = () => {
  const { user, handleLogout } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');
  const [consecutivo, setConsecutivo] = useState(70);
  const [confirmation, setConfirmation] = useState<{ numSP: string; driveUrl?: string } | null>(null);
  const [editingRecord, setEditingRecord] = useState<SheetRecord | null>(null);

  useEffect(() => {
    fetchConsecutivo()
      .then(val => setConsecutivo(val))
      .catch(err => {
        console.warn('No se pudo leer consecutivo de Sheets, usando valor local:', err);
      });
  }, []);

  const handleSubmit = useCallback(async (data: PaymentRequest) => {
    let pdfBytes = await generatePDF(data);

    if (data.documentoAdjunto) {
      const attachmentBytes = new Uint8Array(await data.documentoAdjunto.arrayBuffer());
      pdfBytes = await mergePDFs(pdfBytes, attachmentBytes);
    }

    const fileName = generateFileName(data);
    let driveUrl: string | undefined;
    let slackError: string | undefined;

    try {
      const driveResult = await uploadPDF(fileName, pdfBytes);
      driveUrl = driveResult.url;
      slackError = driveResult.slackError;
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

    try {
      const newConsecutivo = await fetchConsecutivo();
      setConsecutivo(newConsecutivo);
    } catch {
      const autoNum = String(consecutivo).padStart(3, '0');
      if (data.numSP === autoNum) {
        setConsecutivo(prev => prev + 1);
      }
    }

    toast.success(driveUrl ? "PDF guardado en Drive exitosamente" : "PDF generado exitosamente");
    if ((driveResult as any)?.slackError) {
      toast.warning("No se pudo enviar a Slack: " + (driveResult as any).slackError);
    }
    setEditingRecord(null);
    setConfirmation({ numSP: data.numSP, driveUrl });
  }, [consecutivo, user]);

  const handleNewRequest = useCallback(() => {
    setConfirmation(null);
    setEditingRecord(null);
  }, []);

  const handleEditRecord = useCallback((record: SheetRecord) => {
    setEditingRecord(record);
    setConfirmation(null);
    setActiveTab('form');
  }, []);

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className={`mx-auto px-4 sm:px-6 py-8 ${activeTab === 'admin' ? 'max-w-full' : 'max-w-3xl'}`}>
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
              editingRecord={editingRecord}
              onCancelEdit={() => setEditingRecord(null)}
            />
          )
        ) : (
          <AdminPanel onEditRecord={handleEditRecord} />
        )}
      </main>
    </div>
  );
};

export default Index;
