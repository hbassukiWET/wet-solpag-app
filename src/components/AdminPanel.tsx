import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, FileText, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fetchRecords } from "@/lib/google-api";
import { Skeleton } from "@/components/ui/skeleton";

interface SheetRecord {
  num_sp: string;
  marca_temporal: string;
  empresa: string;
  concepto_pago: string;
  monto_total: number;
  moneda: string;
  url_drive: string;
  fecha_pago?: string;
  transferencia_nombre?: string;
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
  // Try DD/MM/YYYY already
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  // ISO or other parseable date
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const AdminPanel = () => {
  const [records, setRecords] = useState<SheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterNombre, setFilterNombre] = useState("");
  const [filterFecha, setFilterFecha] = useState<Date | undefined>(undefined);
  const [filterNumSP, setFilterNumSP] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecords();
      setRecords(Array.isArray(data) ? data : []);
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

  const formatCurrency = (amount: number, moneda: string) => {
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: moneda || "MXN",
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterEmpresa !== "all" && r.empresa !== filterEmpresa) return false;
      if (filterNombre && !(r.transferencia_nombre || "").toLowerCase().includes(filterNombre.toLowerCase())) return false;
      if (filterFecha) {
        const filterStr = format(filterFecha, "dd/MM/yyyy");
        if (formatDateOnly(r.fecha_pago || r.marca_temporal) !== filterStr) return false;
      }
      if (filterNumSP && !r.num_sp.toLowerCase().includes(filterNumSP.toLowerCase())) return false;
      return true;
    });
  }, [records, filterEmpresa, filterNombre, filterFecha, filterNumSP]);

  const hasActiveFilters = filterEmpresa !== "all" || filterNombre || !!filterFecha || filterNumSP;

  const clearFilters = () => {
    setFilterEmpresa("all");
    setFilterNombre("");
    setFilterFecha("");
    setFilterNumSP("");
  };

  const empresas = useMemo(() => {
    const set = new Set(records.map((r) => r.empresa));
    return Array.from(set).sort();
  }, [records]);

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
            <label className="text-xs font-medium text-muted-foreground">Fecha (DD/MM/YYYY)</label>
            <Input
              placeholder="ej. 15/03/2025"
              value={filterFecha}
              onChange={(e) => setFilterFecha(e.target.value)}
              className="h-9 w-40"
            />
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
                  <TableHead className="text-center bg-[#1B2A6B] text-white font-bold px-5 py-3.5 last:rounded-tr-none">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r, i) => (
                  <TableRow
                    key={i}
                    className={`border-b border-border/40 transition-colors ${
                      i % 2 === 1 ? "bg-[#F5F5F5] dark:bg-muted/30" : "bg-white dark:bg-background"
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
                    <TableCell className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">
                      {formatDateOnly(r.fecha_pago || r.marca_temporal)}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
