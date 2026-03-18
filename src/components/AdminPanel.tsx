import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, ExternalLink } from "lucide-react";
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
}

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
        {error && (
          <div className="text-sm text-destructive text-center py-8 px-6">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : records.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0">
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5 first:rounded-tl-none">Num SP</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Empresa</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Concepto de Pago</TableHead>
                  <TableHead className="text-right whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Monto Total</TableHead>
                  <TableHead className="bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Moneda</TableHead>
                  <TableHead className="whitespace-nowrap bg-[#1B2A6B] text-white font-bold px-5 py-3.5">Fecha Pago Tentativa</TableHead>
                  <TableHead className="text-center bg-[#1B2A6B] text-white font-bold px-5 py-3.5 last:rounded-tr-none">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, i) => (
                  <TableRow
                    key={i}
                    className={`border-b border-border/40 transition-colors ${
                      i % 2 === 1 ? "bg-[#F5F5F5] dark:bg-muted/30" : "bg-white dark:bg-background"
                    }`}
                  >
                    <TableCell className="font-mono font-bold px-5 py-3.5 whitespace-nowrap">{r.num_sp}</TableCell>
                    <TableCell className="px-5 py-3.5">{r.empresa}</TableCell>
                    <TableCell className="px-5 py-3.5 max-w-[250px] truncate">{r.concepto_pago}</TableCell>
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
