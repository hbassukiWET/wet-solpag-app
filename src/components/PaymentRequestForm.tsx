import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Empresa, Moneda, PaymentRequest } from "@/types/payment";

interface PaymentRequestFormProps {
  currentConsecutivo: number;
  onSubmit: (data: PaymentRequest) => Promise<void>;
}

const EMPRESAS_INFO: { code: Empresa; name: string; color: string }[] = [
  { code: 'WET', name: 'Wilbur Eagle Technology', color: 'bg-red-500' },
  { code: 'WEST', name: 'West Energy', color: 'bg-blue-900' },
  { code: 'VCC', name: 'Victoria Connysys', color: 'bg-blue-500' },
  { code: 'ALDM', name: 'Aldim Energy', color: 'bg-yellow-500' },
  { code: 'ITR', name: 'Inmobiliaria Trebol', color: 'bg-green-500' },
];
const MONEDAS: Moneda[] = ['MXN', 'USD', 'EUR'];

type FieldKey = 'empresa' | 'ordenCompra' | 'fechaPago' | 'transferenciaNombre' | 'moneda' | 'cuentaBanco' | 'conceptoPago' | 'subtotal' | 'impuestos' | 'montoTotal';

const FIELD_LABELS: Record<FieldKey, string> = {
  empresa: 'Empresa',
  ordenCompra: 'Orden de Compra',
  fechaPago: 'Fecha de Pago Tentativa',
  transferenciaNombre: 'Transferencia a Nombre de',
  moneda: 'Moneda',
  cuentaBanco: 'Cuenta de Banco',
  conceptoPago: 'Concepto de Pago',
  subtotal: 'Subtotal',
  impuestos: 'Impuestos',
  montoTotal: 'Monto Total Solicitado',
};

const RequiredLabel = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
  <Label htmlFor={htmlFor}>
    {children} <span className="text-destructive">*</span>
  </Label>
);

const FieldError = ({ show }: { show: boolean }) =>
  show ? <p className="text-xs text-destructive">Este campo es obligatorio</p> : null;

const PaymentRequestForm = ({ currentConsecutivo, onSubmit }: PaymentRequestFormProps) => {
  const autoNumSP = String(currentConsecutivo).padStart(3, '0');
  const [numSP, setNumSP] = useState(autoNumSP);

  // Sync numSP when consecutivo loads from server (only if user hasn't edited it)
  useEffect(() => {
    if (!userEditedSP) {
      setNumSP(autoNumSP);
    }
  }, [autoNumSP, userEditedSP]);
  const [empresa, setEmpresa] = useState<Empresa | ''>('');
  const [ordenCompra, setOrdenCompra] = useState('');
  const [fechaSolicitud, setFechaSolicitud] = useState<Date>(new Date());
  const [fechaSolicitudOpen, setFechaSolicitudOpen] = useState(false);
  const [fechaPago, setFechaPago] = useState<Date | undefined>();
  const [fechaPagoOpen, setFechaPagoOpen] = useState(false);
  const [transferenciaNombre, setTransferenciaNombre] = useState('');
  const [moneda, setMoneda] = useState<Moneda | ''>('');
  const [cuentaBanco, setCuentaBanco] = useState('');
  const [conceptoPago, setConceptoPago] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [impuestos, setImpuestos] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNumSP, setPendingNumSP] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [touched, setTouched] = useState<Set<FieldKey>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEditedSP, setUserEditedSP] = useState(false);

  // Refs for scroll-to-first-error
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLDivElement | null>>>({});

  const getFieldValues = useCallback((): Record<FieldKey, string> => ({
    empresa,
    ordenCompra,
    fechaPago: fechaPago ? 'set' : '',
    transferenciaNombre,
    moneda,
    cuentaBanco,
    conceptoPago,
    subtotal,
    impuestos,
    montoTotal,
  }), [empresa, ordenCompra, fechaPago, transferenciaNombre, moneda, cuentaBanco, conceptoPago, subtotal, impuestos, montoTotal]);

  const isFieldInvalid = (key: FieldKey): boolean => {
    if (!touched.has(key)) return false;
    const vals = getFieldValues();
    return !vals[key];
  };

  const validateAndSetFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      alert('El archivo no puede exceder 100MB');
      return;
    }
    setAdjunto(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handlePreSubmit = () => {
    const vals = getFieldValues();
    const missing: FieldKey[] = (Object.keys(vals) as FieldKey[]).filter(k => !vals[k]);

    // Mark all as touched
    setTouched(new Set(Object.keys(vals) as FieldKey[]));

    if (missing.length > 0) {
      setMissingFields(missing.map(k => FIELD_LABELS[k]));
      setShowErrorModal(true);
      // Scroll to first missing field
      const firstRef = fieldRefs.current[missing[0]];
      if (firstRef) {
        firstRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        numSP,
        empresa: empresa as Empresa,
        ordenCompra,
        fechaSolicitud,
        fechaPagoTentativa: fechaPago!,
        transferenciaNombre,
        moneda: moneda as Moneda,
        cuentaBanco,
        conceptoPago,
        subtotal: parseFloat(subtotal),
        impuestos: parseFloat(impuestos),
        montoTotal: parseFloat(montoTotal),
        comentarios: comentarios || undefined,
        documentoAdjunto: adjunto || undefined,
        overwrite: userEditedSP,
      });
    } catch (err) {
      console.error(err);
      alert('Error al generar la solicitud');
    } finally {
      setIsSubmitting(false);
      setShowSubmitConfirm(false);
      setShowConfirmModal(false);
    }
  };

  const errorBorder = "border-destructive focus-visible:ring-destructive";

  return (
    <>
      <div className="space-y-6">
        {/* Identificación */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="form-section-title">Identificación</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numSP">Número de Solicitud (SP)</Label>
                <Input
                  id="numSP"
                  value={numSP}
                  onChange={(e) => setNumSP(e.target.value)}
                  onBlur={() => {
                    if (numSP !== autoNumSP && numSP.trim() !== '') {
                      setPendingNumSP(numSP);
                      setShowConfirmModal(true);
                    }
                  }}
                  placeholder="070"
                  className="font-mono text-lg"
                />
                {numSP !== autoNumSP && (
                  <p className="text-xs text-accent">
                    Consecutivo automático: {autoNumSP}
                  </p>
                )}
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.empresa = el; }}>
                <RequiredLabel>Empresa</RequiredLabel>
                <Select value={empresa} onValueChange={(v) => setEmpresa(v as Empresa)}>
                  <SelectTrigger className={cn(isFieldInvalid('empresa') && errorBorder)}>
                    <SelectValue placeholder="Seleccionar empresa">
                      {empresa && (() => {
                        const info = EMPRESAS_INFO.find(e => e.code === empresa);
                        return info ? (
                          <span className="flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${info.color}`} />
                            <span className="font-medium">{info.code}</span>
                            <span className="text-muted-foreground">— {info.name}</span>
                          </span>
                        ) : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESAS_INFO.map(e => (
                      <SelectItem key={e.code} value={e.code}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${e.color}`} />
                          <span className="font-medium">{e.code}</span>
                          <span className="text-muted-foreground">— {e.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError show={isFieldInvalid('empresa')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datos del Pago */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="form-section-title">Datos del Pago</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2" ref={el => { fieldRefs.current.ordenCompra = el; }}>
                <RequiredLabel>Orden de Compra</RequiredLabel>
                <Input value={ordenCompra} onChange={e => setOrdenCompra(e.target.value)} placeholder="SO-15-26" className={cn(isFieldInvalid('ordenCompra') && errorBorder)} />
                <FieldError show={isFieldInvalid('ordenCompra')} />
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.transferenciaNombre = el; }}>
                <RequiredLabel>Transferencia a Nombre de</RequiredLabel>
                <Input value={transferenciaNombre} onChange={e => setTransferenciaNombre(e.target.value)} className={cn(isFieldInvalid('transferenciaNombre') && errorBorder)} />
                <FieldError show={isFieldInvalid('transferenciaNombre')} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Solicitud</Label>
                <Popover open={fechaSolicitudOpen} onOpenChange={setFechaSolicitudOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fechaSolicitud && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaSolicitud ? format(fechaSolicitud, "PPP", { locale: es }) : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaSolicitud} onSelect={(d) => { if (d) { setFechaSolicitud(d); setFechaSolicitudOpen(false); } }} locale={es} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.fechaPago = el; }}>
                <RequiredLabel>Fecha de Pago Tentativa</RequiredLabel>
                <Popover open={fechaPagoOpen} onOpenChange={setFechaPagoOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fechaPago && "text-muted-foreground", isFieldInvalid('fechaPago') && errorBorder)}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaPago ? format(fechaPago, "PPP", { locale: es }) : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fechaPago} onSelect={(d) => { setFechaPago(d); setFechaPagoOpen(false); }} locale={es} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <FieldError show={isFieldInvalid('fechaPago')} />
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.moneda = el; }}>
                <RequiredLabel>Moneda</RequiredLabel>
                <Select value={moneda} onValueChange={(v) => {
                  const m = v as Moneda;
                  setMoneda(m);
                  const sub = parseFloat(subtotal);
                  if (!isNaN(sub)) {
                    const taxRate = m === 'USD' || m === 'EUR' ? 0 : 0.16;
                    const tax = (sub * taxRate).toFixed(2);
                    setImpuestos(tax);
                    setMontoTotal((sub + parseFloat(tax)).toFixed(2));
                  }
                }}>
                  <SelectTrigger className={cn(isFieldInvalid('moneda') && errorBorder)}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDAS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError show={isFieldInvalid('moneda')} />
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.cuentaBanco = el; }}>
                <RequiredLabel>Cuenta de Banco</RequiredLabel>
                <Input value={cuentaBanco} onChange={e => setCuentaBanco(e.target.value)} className={cn(isFieldInvalid('cuentaBanco') && errorBorder)} />
                <FieldError show={isFieldInvalid('cuentaBanco')} />
              </div>
              <div className="space-y-2 sm:col-span-2" ref={el => { fieldRefs.current.conceptoPago = el; }}>
                <RequiredLabel>Concepto de Pago</RequiredLabel>
                <Input value={conceptoPago} onChange={e => setConceptoPago(e.target.value)} placeholder="FLETE TERR" className={cn(isFieldInvalid('conceptoPago') && errorBorder)} />
                <FieldError show={isFieldInvalid('conceptoPago')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Montos */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="form-section-title">Montos</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2" ref={el => { fieldRefs.current.subtotal = el; }}>
                <RequiredLabel>Subtotal</RequiredLabel>
                <Input type="number" step="0.01" value={subtotal} onChange={e => {
                  const val = e.target.value;
                  setSubtotal(val);
                  const sub = parseFloat(val);
                  if (!isNaN(sub)) {
                    const taxRate = moneda === 'USD' || moneda === 'EUR' ? 0 : 0.16;
                    const tax = (sub * taxRate).toFixed(2);
                    setImpuestos(tax);
                    setMontoTotal((sub + parseFloat(tax)).toFixed(2));
                  }
                }} placeholder="0.00" className={cn(isFieldInvalid('subtotal') && errorBorder)} />
                <FieldError show={isFieldInvalid('subtotal')} />
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.impuestos = el; }}>
                <RequiredLabel>Impuestos (16%)</RequiredLabel>
                <Input type="number" step="0.01" value={impuestos} onChange={e => {
                  setImpuestos(e.target.value);
                  const sub = parseFloat(subtotal);
                  const tax = parseFloat(e.target.value);
                  if (!isNaN(sub) && !isNaN(tax)) {
                    setMontoTotal((sub + tax).toFixed(2));
                  }
                }} placeholder="0.00" className={cn(isFieldInvalid('impuestos') && errorBorder)} />
                <FieldError show={isFieldInvalid('impuestos')} />
              </div>
              <div className="space-y-2" ref={el => { fieldRefs.current.montoTotal = el; }}>
                <RequiredLabel>Monto Total Solicitado</RequiredLabel>
                <Input type="number" step="0.01" value={montoTotal} onChange={e => setMontoTotal(e.target.value)} placeholder="0.00" className={cn("font-semibold", isFieldInvalid('montoTotal') && errorBorder)} />
                <FieldError show={isFieldInvalid('montoTotal')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extras */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <p className="form-section-title">Información Adicional</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Comentarios adicionales <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Textarea value={comentarios} onChange={e => setComentarios(e.target.value)} rows={3} placeholder="Observaciones o notas adicionales..." />
              </div>
              <div className="space-y-2">
                <Label>Documento adjunto <span className="text-muted-foreground font-normal">(opcional, PDF, máx 100MB)</span></Label>
                {adjunto ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm flex-1 truncate">{adjunto.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => setAdjunto(null)} className="h-8 w-8">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Upload className={cn("w-6 h-6", isDragging ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-sm", isDragging ? "text-primary font-medium" : "text-muted-foreground")}>
                      {isDragging ? "Suelta el archivo aquí" : "Arrastra un PDF aquí o haz clic para seleccionar"}
                    </span>
                    <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handlePreSubmit}
          disabled={isSubmitting}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generando solicitud...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              Generar Solicitud de Pago
            </>
          )}
        </Button>
      </div>

      {/* Modal de confirmación de consecutivo */}
      <Dialog open={showConfirmModal} onOpenChange={(open) => {
        if (!open) {
          setNumSP(autoNumSP);
          setPendingNumSP(null);
          setUserEditedSP(false);
        }
        setShowConfirmModal(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar número de solicitud</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas usar el número <strong className="text-foreground">{pendingNumSP}</strong> en lugar del consecutivo automático <strong className="text-foreground">{autoNumSP}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setNumSP(autoNumSP);
              setPendingNumSP(null);
              setShowConfirmModal(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={() => {
              setUserEditedSP(true);
              setPendingNumSP(null);
              setShowConfirmModal(false);
            }}>
              Sí, usar {pendingNumSP}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de envío */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar solicitud</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas generar esta solicitud de pago?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                'Sí, generar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de campos faltantes */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Campos obligatorios faltantes
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>Faltan los siguientes campos obligatorios:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {missingFields.map(f => (
                    <li key={f} className="text-destructive font-medium">{f}</li>
                  ))}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowErrorModal(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentRequestForm;
