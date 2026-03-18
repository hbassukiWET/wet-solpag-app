import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, FileText } from "lucide-react";
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
      setRecords(data);
    } catch (err) {
      console.error("Error loading records:", err);
      setError("No se pudieron cargar los registros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const formatCurrency = (amount: number, moneda: string) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda || "MXN",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card className="glass-card">
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
      <CardContent>
        {error && (
          <div className="text-sm text-destructive text-center py-8">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : records.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay registros.</p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Num SP</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Concepto de Pago</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Monto Total</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-center">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-medium">{r.num_sp}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.marca_temporal}</TableCell>
                    <TableCell>{r.empresa}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.concepto_pago}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.monto_total, r.moneda)}
                    </TableCell>
                    <TableCell>{r.moneda}</TableCell>
                    <TableCell className="text-center">
                      {r.url_drive ? (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={r.url_drive} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 text-primary" />
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
