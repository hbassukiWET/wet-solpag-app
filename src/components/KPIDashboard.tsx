import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, RefreshCw, DollarSign, FileText, Clock, TrendingUp, Users, Package, Receipt } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fetchRecords } from "@/lib/google-api";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from "recharts";

interface DashRecord {
  num_sp: string;
  empresa: string;
  moneda: string;
  monto_total: number;
  subtotal: number;
  impuestos: number;
  transferencia_nombre: string;
  orden_compra: string;
  fecha_solicitud: string;
  fecha_pago: string;
  solicitante: string;
}

const COLORS = [
  "hsl(220, 60%, 25%)", // primary
  "hsl(38, 92%, 50%)",  // accent
  "hsl(0, 72%, 51%)",   // destructive
  "hsl(210, 20%, 60%)", // muted
  "hsl(150, 50%, 40%)", // green
  "hsl(280, 50%, 50%)", // purple
  "hsl(30, 80%, 55%)",  // orange
  "hsl(190, 60%, 45%)", // teal
  "hsl(340, 60%, 50%)", // pink
  "hsl(60, 70%, 45%)",  // yellow-green
];

const empresaBadgeStyles: Record<string, string> = {
  WET: "bg-[#CC0000] text-white",
  WEST: "bg-[#1B2A6B] text-white",
  VCC: "bg-[#2E75B6] text-white",
  ALDM: "bg-[#F5C400] text-black",
  ITR: "bg-[#2E7D32] text-white",
};

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // dd/MM/yyyy
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function fmtCurrency(n: number, moneda = "MXN") {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda, minimumFractionDigits: 2 }).format(n);
  } catch { return `$${n.toFixed(2)}`; }
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const KPIDashboard = () => {
  const [records, setRecords] = useState<DashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [filterMoneda, setFilterMoneda] = useState("all");
  const [filterSolicitante, setFilterSolicitante] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchRecords();
      const normalized = (Array.isArray(data) ? data : []).map((r: any) => ({
        num_sp: String(r.num_sp ?? ""),
        empresa: String(r.empresa ?? ""),
        moneda: String(r.moneda ?? "MXN"),
        monto_total: Number(r.monto_total) || 0,
        subtotal: Number(r.subtotal) || 0,
        impuestos: Number(r.impuestos) || 0,
        transferencia_nombre: String(r.transferencia_nombre ?? ""),
        orden_compra: String(r.orden_compra ?? ""),
        fecha_solicitud: String(r.fecha_solicitud ?? ""),
        fecha_pago: String(r.fecha_pago ?? ""),
        solicitante: String(r.solicitante ?? ""),
      }));
      setRecords(normalized);
    } catch (err) {
      console.error("Error loading records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const empresas = useMemo(() => [...new Set(records.map(r => r.empresa).filter(Boolean))], [records]);
  const solicitantes = useMemo(() => [...new Set(records.map(r => r.solicitante).filter(Boolean))], [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterEmpresa !== "all" && r.empresa !== filterEmpresa) return false;
      if (filterMoneda !== "all" && r.moneda !== filterMoneda) return false;
      if (filterSolicitante !== "all" && r.solicitante !== filterSolicitante) return false;
      if (dateFrom || dateTo) {
        const d = parseDate(r.fecha_solicitud);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  }, [records, filterEmpresa, filterMoneda, filterSolicitante, dateFrom, dateTo]);

  

  // SECTION 1 - Volume
  const totalMXN = useMemo(() => filtered.filter(r => r.moneda === "MXN").reduce((s, r) => s + r.monto_total, 0), [filtered]);
  const totalUSD = useMemo(() => filtered.filter(r => r.moneda === "USD").reduce((s, r) => s + r.monto_total, 0), [filtered]);
  const totalRequests = filtered.length;
  const avgTicket = totalRequests > 0 ? (totalMXN + totalUSD) / totalRequests : 0;

  const byEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.empresa] = (map[r.empresa] || 0) + r.monto_total; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byCurrency = useMemo(() => [
    { name: "MXN", value: totalMXN },
    { name: "USD", value: totalUSD },
  ].filter(d => d.value > 0), [totalMXN, totalUSD]);

  // SECTION 2 - Times
  const avgDaysToPayment = useMemo(() => {
    let sum = 0, count = 0;
    filtered.forEach(r => {
      const fs = parseDate(r.fecha_solicitud);
      const fp = parseDate(r.fecha_pago);
      if (fs && fp) { sum += daysBetween(fs, fp); count++; }
    });
    return count > 0 ? Math.round(sum / count) : 0;
  }, [filtered]);


  // SECTION 4 - Providers by currency
  const currencies = useMemo(() => [...new Set(filtered.map(r => r.moneda).filter(Boolean))].sort(), [filtered]);

  const topProvidersByCurrency = useMemo(() => {
    const result: Record<string, { providers: { name: string; value: number }[]; top5Pct: number }> = {};
    currencies.forEach(cur => {
      const curRecords = filtered.filter(r => r.moneda === cur);
      const map: Record<string, number> = {};
      curRecords.forEach(r => {
        if (r.transferencia_nombre) map[r.transferencia_nombre] = (map[r.transferencia_nombre] || 0) + r.monto_total;
      });
      const sorted = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      const total = curRecords.reduce((s, r) => s + r.monto_total, 0);
      const top5Sum = sorted.slice(0, 5).reduce((s, p) => s + p.value, 0);
      result[cur] = {
        providers: sorted.slice(0, 10),
        top5Pct: total > 0 ? Math.round((top5Sum / total) * 100) : 0,
      };
    });
    return result;
  }, [filtered, currencies]);

  // SECTION 5 - OC
  const ocData = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filtered.forEach(r => {
      if (!r.orden_compra) return;
      if (!map[r.orden_compra]) map[r.orden_compra] = { count: 0, total: 0 };
      map[r.orden_compra].count++;
      map[r.orden_compra].total += r.monto_total;
    });
    return Object.entries(map)
      .map(([oc, d]) => ({ oc, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const multiOC = useMemo(() => ocData.filter(d => d.count > 1), [ocData]);
  const topOC = useMemo(() => ocData.slice(0, 10).map(d => ({ name: d.oc, value: d.total })), [ocData]);

  // SECTION 6 - Taxes
  const totalTax = useMemo(() => filtered.reduce((s, r) => s + r.impuestos, 0), [filtered]);
  const avgTaxRatio = useMemo(() => {
    const totalSub = filtered.reduce((s, r) => s + r.subtotal, 0);
    return totalSub > 0 ? Math.round((totalTax / totalSub) * 100) : 0;
  }, [filtered, totalTax]);

  const totalBacklog = useMemo(() => filtered.reduce((s, r) => s + r.monto_total, 0), [filtered]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Moneda</label>
              <Select value={filterMoneda} onValueChange={setFilterMoneda}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Solicitante</label>
              <Select value={filterSolicitante} onValueChange={setFilterSolicitante}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {solicitantes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] h-9 justify-start text-left text-sm", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy", { locale: es }) : "Inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={es} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] h-9 justify-start text-left text-sm", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd/MM/yy", { locale: es }) : "Fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={es} className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterEmpresa("all"); setFilterMoneda("all"); setFilterSolicitante("all"); setDateFrom(undefined); setDateTo(undefined); }}>
              Limpiar
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 ml-auto" onClick={loadRecords}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label="Total MXN" value={fmtCurrency(totalMXN, "MXN")} />
        <KPICard icon={DollarSign} label="Total USD" value={fmtCurrency(totalUSD, "USD")} />
        <KPICard icon={FileText} label="Solicitudes" value={String(totalRequests)} />
        <KPICard icon={TrendingUp} label="Ticket Promedio" value={fmtCurrency(avgTicket, "MXN")} />
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Clock} label="Días Prom. al Pago" value={`${avgDaysToPayment} días`} />
        <KPICard icon={Package} label="Backlog Abierto" value={String(totalRequests)} />
        <KPICard icon={DollarSign} label="Monto Backlog" value={fmtCurrency(totalBacklog, "MXN")} />
        <KPICard icon={Receipt} label="Impuestos Acumulados" value={fmtCurrency(totalTax, "MXN")} />
      </div>

      {/* KPI Cards Row 3 */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <KPICard icon={Receipt} label="Ratio Impuestos/Subtotal" value={`${avgTaxRatio}%`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* By Empresa */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Desglose por Empresa</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byEmpresa.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byEmpresa} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {byEmpresa.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCurrency(v, "MXN")} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center pt-20">Sin datos</p>}
          </CardContent>
        </Card>

        {/* MXN vs USD */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Split MXN vs USD</CardTitle></CardHeader>
          <CardContent className="h-64">
            {byCurrency.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCurrency} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    <Cell fill="hsl(150, 50%, 30%)" />
                    <Cell fill="hsl(150, 50%, 55%)" />
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCurrency(v, "MXN")} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center pt-20">Sin datos</p>}
          </CardContent>
        </Card>
      </div>

      {/* Charts - Providers by Currency */}
      {currencies.map(cur => {
        const data = topProvidersByCurrency[cur];
        if (!data || data.providers.length === 0) return null;
        return (
          <Card key={cur}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Top 10 Proveedores — {cur}</CardTitle>
                <span className="text-xs text-muted-foreground">Top 5 = {data.top5Pct}% del total</span>
              </div>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.providers} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis type="number" tickFormatter={(v) => fmtCurrency(v, cur)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v, cur)} />
                  <Bar dataKey="value" fill={cur === "MXN" ? "hsl(220, 60%, 25%)" : cur === "USD" ? "hsl(150, 50%, 40%)" : "hsl(38, 92%, 50%)"} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })}

      {/* Charts Row 3 - OC */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top 10 Órdenes de Compra</CardTitle></CardHeader>
          <CardContent className="h-72">
            {topOC.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topOC} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v, "MXN")} />
                  <Bar dataKey="value" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center pt-20">Sin datos</p>}
          </CardContent>
        </Card>

        {/* OC with multiple requests */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">OCs con Múltiples Solicitudes</CardTitle></CardHeader>
          <CardContent className="max-h-72 overflow-auto">
            {multiOC.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Orden de Compra</TableHead>
                    <TableHead className="text-xs text-center">Solicitudes</TableHead>
                    <TableHead className="text-xs text-right">Monto Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multiOC.map(d => (
                    <TableRow key={d.oc}>
                      <TableCell className="text-xs font-medium">{d.oc}</TableCell>
                      <TableCell className="text-xs text-center">{d.count}</TableCell>
                      <TableCell className="text-xs text-right">{fmtCurrency(d.total, "MXN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-muted-foreground text-sm text-center pt-10">Todas las OC tienen una sola solicitud</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface KPICardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: "default" | "destructive";
}

const KPICard = ({ icon: Icon, label, value, variant = "default" }: KPICardProps) => (
  <Card className={cn(variant === "destructive" && "border-destructive/50 bg-destructive/5")}>
    <CardContent className="pt-4 pb-4 px-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", variant === "destructive" ? "text-destructive" : "text-muted-foreground")} />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <p className={cn("text-lg font-bold font-heading truncate", variant === "destructive" && "text-destructive")}>{value}</p>
    </CardContent>
  </Card>
);

export default KPIDashboard;
