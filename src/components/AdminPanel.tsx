import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, FileText, X, CalendarIcon, Pencil } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fetchRecords } from "@/lib/google-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { updatePagado as apiUpdatePagado } from "@/lib/google-api";
import { toast } from "sonner";

export interface SheetRecord {
  num_sp: string;
  marca_temporal: string;
  empresa: string;
  concepto_pago: string;
  monto_total: number;
  moneda: string;
  url_drive: string;
  fecha_pago?: string;
  transferencia_nombre?: string;
  orden_compra?: string;
  cuenta_banco?: string;
  subtotal?: number;
  impuestos?: number;
  comentarios?: string;
  solicitante?: string;
  pagado?: boolean;
  fecha_pago_real?: string;
}

interface AdminPanelProps {
  onEditRecord?: (record: SheetRecord) => void;
}

const empresaBadgeStyles: Record<string, string> = {
  WET: "bg-[#CC0000] text-white",
  WEST: "bg-[#1B2A6B] text-white",
  VCC: "bg-[#2E75B6] text-white",
  ALDM: "bg-[#F5C400] text-black",
  ITR: "bg-[#2E7D32] text-white",
};

const currencyBadgeStyles: Record<string, string> = {
  MXN: "bg-emerald-800 text-emerald-100",
  USD: "bg-emerald-500 text-white",
  EUR: "bg-blue-600 text-white",
};

function formatDateOnly(raw: string): string {
  if (!raw) return "—";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const AdminPanel = ({ onEditRecord }: AdminPanelProps) => {
  const [records, setRecords] = useState<SheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterNombre, setFilterNombre] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState<Date | undefined>(undefined);
  const [filterFechaHasta, setFilterFechaHasta] = useState<Date | undefined>(undefined);
  const [filterNumSP, setFilterNumSP] = useState("");
  const [filterPagado, setFilterPagado] = useState<string>("all");
  const [openCalRow, setOpenCalRow] = useState<string | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecords();
      console.log('fetchRecords raw response:', JSON.stringify(data).slice(0, 500));
      const normalized = (Array.isArray(data) ? data : []).map((r: any) => ({
        ...r,
        num_sp: String(r.num_sp ?? ''),
        empresa: String(r.empresa ?? ''),
        concepto_pago: String(r.concepto_pago ?? ''),
        monto_total: Number(r.monto_total) || 0,
        moneda: String(r.moneda ?? 'MXN'),
        url_drive: String(r.url_drive ?? ''),
        marca_temporal: String(r.marca_temporal ?? ''),
        transferencia_nombre: r.transferencia_nombre ? String(r.transferencia_nombre) : undefined,
        fecha_pago: r.fecha_pago ? String(r.fecha_pago) : undefined,
        pagado: r.pagado === true || String(r.pagado).toLowerCase() === 'true',
        fecha_pago_real: r.fecha_pago_real ? String(r.fecha_pago_real) : '',
      }));
      setRecords(normalized);
    } catch (err) {
      console.error("Error loading records:", err);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los registros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const formatCurrency = (amount: number | string | undefined, moneda: string) => {
    const num = Number(amount) || 0;
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: moneda || "MXN",
        minimumFractionDigits: 2,
      }).format(num);
    } catch {
      return `$${num.toFixed(2)}`;
    }
  };

  const parseRecordDate = (raw: string): Date | null => {
    if (!raw) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split("/");
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterEmpresa !== "all" && r.empresa !== filterEmpresa) return false;
      if (filterNombre && !(r.transferencia_nombre || "").toLowerCase().includes(filterNombre.toLowerCase())) return false;
      if (filterFechaDesde || filterFechaHasta) {
        const recDate = parseRecordDate(r.fecha_pago || r.marca_temporal);
        if (!recDate) return false;
        const recDay = new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate());
        if (filterFechaDesde && recDay < filterFechaDesde) return false;
        if (filterFechaHasta && recDay > filterFechaHasta) return false;
      }
      if (filterNumSP && !r.num_sp.toLowerCase().includes(filterNumSP.toLowerCase())) return false;
      if (filterPagado === "pagado" && !r.pagado) return false;
      if (filterPagado === "pendiente" && r.pagado) return false;
      if (filterPagado === "vencido") {
        const fp = parseRecordDate(r.fecha_pago || "");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (r.pagado || !fp || fp >= today) return false;
      }
      return true;
    });
  }, [records, filterEmpresa, filterNombre, filterFechaDesde, filterFechaHasta, filterNumSP, filterPagado]);

  const hasActiveFilters = filterEmpresa !== "all" || filterNombre || !!filterFechaDesde || !!filterFechaHasta || filterNumSP || filterPagado !== "all";

  const clearFilters = () => {
    setFilterEmpresa("all");
    setFilterNombre("");
    setFilterFechaDesde(undefined);
    setFilterFechaHasta(undefined);
    setFilterNumSP("");
    setFilterPagado("all");
  };

  const empresas = useMemo(() => {
    const set = new Set(records.map((r) => r.empresa));
    return Array.from(set).sort();
  }, [records]);

  const togglePagado = async (record: SheetRecord, nextPagado: boolean) => {
    if (nextPagado) {
      // Force user to pick a date via the calendar popover
      toast.info("Selecciona la fecha de pago real");
      setOpenCalRow(record.num_sp);
      return;
    }
    // Unchecking: clear date
    const previo = { pagado: record.pagado, fecha_pago_real: record.fecha_pago_real };
    setRecords((prev) =>
      prev.map((r) =>
        r.num_sp === record.num_sp ? { ...r, pagado: false, fecha_pago_real: "" } : r,
      ),
    );
    try {
      await apiUpdatePagado(record.num_sp, false, "");
      toast.success("Marcado como pendiente");
    } catch (err) {
      console.error("updatePagado error", err);
      toast.error("No se pudo actualizar el estado de pago");
      setRecords((prev) =>
        prev.map((r) =>
          r.num_sp === record.num_sp ? { ...r, ...previo } : r,
        ),
      );
    }
  };

  const updateFechaPagoReal = async (record: SheetRecord, date: Date | undefined) => {
    if (!date) return;
    const fecha = format(date, "dd/MM/yyyy");
    const previo = record.fecha_pago_real;
    setOpenCalRow(null);
    setRecords((prev) =>
      prev.map((r) =>
        r.num_sp === record.num_sp ? { ...r, pagado: true, fecha_pago_real: fecha } : r,
      ),
    );
    try {
      await apiUpdatePagado(record.num_sp, true, fecha);
      toast.success("Fecha de pago actualizada");
    } catch (err) {
      console.error("updateFechaPago error", err);
      toast.error("No se pudo actualizar la fecha de pago");
      setRecords((prev) =>
        prev.map((r) =>
          r.num_sp === record.num_sp ? { ...r, fecha_pago_real: previo } : r,
        ),
      );
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Historial de Solicitudes</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={loadRecords} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {/* Filters */}
        <div className="px-5 pb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Num SP</label>
            <Input
              placeholder="Buscar..."
              value={filterNumSP}
              onChange={(e) => setFilterNumSP(e.target.value)}
              className="h-9 w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Empresa</label>
            <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e} value={e}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${empresaBadgeStyles[e] || ""}`}>
                      {e}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Transferencia a Nombre de</label>
            <Input
              placeholder="Buscar..."
              value={filterNombre}
              onChange={(e) => setFilterNombre(e.target.value)}
              className="h-9 w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Fecha Desde</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-40 justify-start text-left font-normal",
                    !filterFechaDesde && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterFechaDesde ? format(filterFechaDesde, "dd/MM/yyyy") : "Desde..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterFechaDesde}
                  onSelect={(date) => setFilterFechaDesde(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Fecha Hasta</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 w-40 justify-start text-left font-normal",
                    !filterFechaHasta && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterFechaHasta ? format(filterFechaHasta, "dd/MM/yyyy") : "Hasta..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterFechaHasta}
                  onSelect={(date) => setFilterFechaHasta(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <Select value={filterPagado} onValueChange={setFilterPagado}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
              Limpiar
            </Button>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive text-center py-8 px-6">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredRecords.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {hasActiveFilters ? "No se encontraron registros con los filtros aplicados." : "No hay registros."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0">
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5 first:rounded-tl-none">Num SP</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Empresa</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Concepto de Pago</TableHead>
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Transferencia a Nombre de</TableHead>
                  <TableHead className="text-right whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Monto Total</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Moneda</TableHead>
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Fecha Pago Tentativa</TableHead>
                  <TableHead className="text-center bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Pagado</TableHead>
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Fecha Pago Real</TableHead>
                  <TableHead className="text-center bg-[#1B2A6B] text-white font-bold px-5 py-3.5">PDF</TableHead>
                  <TableHead className="text-center bg-[#1B2A6B] text-white font-bold px-5 py-3.5 last:rounded-tr-none">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r, i) => {
                  const fp = parseRecordDate(r.fecha_pago || "");
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const vencido = !r.pagado && fp && fp < today;
                  return (
                  <TableRow
                    key={i}
                    className={`border-b border-border/40 transition-colors ${
                      r.pagado
                        ? "bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200/70 dark:hover:bg-emerald-900/50"
                        : vencido
                        ? "bg-red-100 dark:bg-red-950/40 hover:bg-red-200/70 dark:hover:bg-red-900/50"
                        : i % 2 === 1
                        ? "bg-[#F5F5F5] dark:bg-muted/30"
                        : "bg-white dark:bg-background"
                    }`}
                  >
                    <TableCell className="font-mono font-bold px-5 py-3.5 whitespace-nowrap">{r.num_sp}</TableCell>
                    <TableCell className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          empresaBadgeStyles[r.empresa] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.empresa}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3.5 max-w-[250px] truncate">{r.concepto_pago}</TableCell>
                    <TableCell className="px-5 py-3.5 whitespace-nowrap">{r.transferencia_nombre || "—"}</TableCell>
                    <TableCell className="text-right font-mono px-5 py-3.5 whitespace-nowrap">
                      {formatCurrency(r.monto_total, r.moneda)}
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          currencyBadgeStyles[r.moneda] || "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.moneda}
                      </span>
                    </TableCell>
                    <TableCell className={cn("px-5 py-3.5 whitespace-nowrap", vencido ? "text-red-700 dark:text-red-300 font-semibold" : "text-muted-foreground")}>
                      {formatDateOnly(r.fecha_pago || r.marca_temporal)}
                      {vencido && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">VENCIDO</span>}
                    </TableCell>
                    <TableCell className="text-center px-5 py-3.5">
                      <Checkbox
                        checked={!!r.pagado}
                        onCheckedChange={(v) => togglePagado(r, v === true)}
                        aria-label="Marcar como pagado"
                      />
                    </TableCell>
                    <TableCell className="px-5 py-3.5 whitespace-nowrap">
                      <Popover open={openCalRow === r.num_sp} onOpenChange={(o) => setOpenCalRow(o ? r.num_sp : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 px-2 font-normal gap-1.5",
                              !r.fecha_pago_real && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {r.fecha_pago_real ? formatDateOnly(r.fecha_pago_real) : "Elegir..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseRecordDate(r.fecha_pago_real || "") || undefined}
                            onSelect={(date) => updateFechaPagoReal(r, date)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-center px-5 py-3.5">
                      {r.url_drive ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={r.url_drive} target="_blank" rel="noopener noreferrer" title="Ver PDF">
                            <FileText className="w-4 h-4 text-primary" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center px-5 py-3.5">
                      {onEditRecord && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEditRecord(r)}
                          title="Editar / Sobreescribir"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
