import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, RefreshCw, Clock, FileX, Wallet, CheckCircle2, ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchRecords } from "@/lib/google-api";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, LabelList,
} from "recharts";

interface DashRecord {
  num_sp: string;
  empresa: string;
  moneda: string;
  monto_total: number;
  transferencia_nombre: string;
  orden_compra: string;
  fecha_solicitud: string;
  fecha_pago: string; // tentativa
  fecha_pago_real: string;
  pagado: boolean;
  comentarios: string;
  solicitante: string;
}

const EMPRESA_COLORS: Record<string, string> = {
  WET: "#CC0000",
  WEST: "#1B2A6B",
  VCC: "#2E75B6",
  ALDM: "#F5C400",
  ITR: "#2E7D32",
};

const CURRENCY_COLORS: Record<string, string> = {
  MXN: "#1E3A5F",
  USD: "#2E86AB",
  EUR: "#48CAE4",
};

const TREEMAP_SCALE = ["#1E3A5F", "#2E86AB", "#48CAE4", "#90E0EF", "#CAF0F8"];

function treemapColorByRank(rank: number): string {
  if (rank === 0) return "#1E3A5F";
  if (rank <= 2) return "#2E86AB";
  if (rank <= 5) return "#48CAE4";
  if (rank <= 9) return "#90E0EF";
  return "#CAF0F8";
}

const DARK_TREEMAP_FILLS = new Set(["#1E3A5F", "#2E86AB"]);

const renderPieLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, name, percent } = props;
  const RAD = Math.PI / 180;
  // empujar más afuera los slices pequeños para evitar encimado
  const extra = percent < 0.05 ? 28 : percent < 0.1 ? 20 : 14;
  const r = outerRadius + extra;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = x > cx ? "start" : "end";
  const pct = percent * 100;
  const pctStr = pct < 1 ? pct.toFixed(1) : pct.toFixed(0);
  return (
    <text x={x} y={y} fill="#2D3748" fontSize={12} fontWeight={500} textAnchor={anchor} dominantBaseline="central">
      {`${name} ${pctStr}%`}
    </text>
  );
};

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fmtMXN(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}
function fmtCur(n: number, c = "MXN") {
  try { return new Intl.NumberFormat("es-MX", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtDate(raw: string): string {
  const d = parseDate(raw);
  if (!d) return raw || "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function isPaid(r: DashRecord): boolean {
  return r.pagado === true;
}

const KPIDashboard = () => {
  const [records, setRecords] = useState<DashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [usdRate, setUsdRate] = useState(17.5);
  const [eurRate, setEurRate] = useState(19.5);
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [paramsOpen, setParamsOpen] = useState(false);
  const [highlightVencidas, setHighlightVencidas] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchRecords();
      const normalized = (Array.isArray(data) ? data : []).map((r: any) => ({
        num_sp: String(r.num_sp ?? ""),
        empresa: String(r.empresa ?? ""),
        moneda: String(r.moneda ?? "MXN").toUpperCase(),
        monto_total: Number(r.monto_total) || 0,
        transferencia_nombre: String(r.transferencia_nombre ?? ""),
        orden_compra: String(r.orden_compra ?? "").trim(),
        fecha_solicitud: String(r.fecha_solicitud ?? ""),
        fecha_pago: String(r.fecha_pago ?? ""),
        fecha_pago_real: String(r.fecha_pago_real ?? ""),
        pagado: r.pagado === true || String(r.pagado).toUpperCase() === "TRUE",
        comentarios: String(r.comentarios ?? ""),
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

  const toMXN = (amount: number, moneda: string): number => {
    if (moneda === "USD") return amount * usdRate;
    if (moneda === "EUR") return amount * eurRate;
    return amount;
  };

  const filtered = useMemo(() => {
    return records.filter(r => filterEmpresa === "all" || r.empresa === filterEmpresa);
  }, [records, filterEmpresa]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Vencidas
  const vencidas = useMemo(() => {
    return filtered.filter(r => {
      if (isPaid(r)) return false;
      const d = parseDate(r.fecha_pago);
      return d && d < today;
    });
  }, [filtered, today]);

  const vencidasMXN = vencidas.filter(r => r.moneda === "MXN").reduce((s, r) => s + r.monto_total, 0);
  const vencidasUSD = vencidas.filter(r => r.moneda === "USD").reduce((s, r) => s + r.monto_total, 0);
  const vencidasEUR = vencidas.filter(r => r.moneda === "EUR").reduce((s, r) => s + r.monto_total, 0);

  // KPI 1: Pendiente de pago por moneda
  const pendientes = useMemo(() => filtered.filter(r => !isPaid(r)), [filtered]);
  const pendMXN = pendientes.filter(r => r.moneda === "MXN").reduce((s, r) => s + r.monto_total, 0);
  const pendUSD = pendientes.filter(r => r.moneda === "USD").reduce((s, r) => s + r.monto_total, 0);
  const pendEUR = pendientes.filter(r => r.moneda === "EUR").reduce((s, r) => s + r.monto_total, 0);

  // KPI 2: Pagado este mes (por moneda)
  const pagadoMesPorMoneda = useMemo(() => {
    const m = today.getMonth(), y = today.getFullYear();
    const acc = { MXN: 0, USD: 0, EUR: 0 } as Record<string, number>;
    filtered.forEach(r => {
      if (!isPaid(r)) return;
      const d = parseDate(r.fecha_pago_real);
      if (!d || d.getMonth() !== m || d.getFullYear() !== y) return;
      acc[r.moneda] = (acc[r.moneda] || 0) + r.monto_total;
    });
    return acc;
  }, [filtered, today]);

  // KPI 3: Días promedio al pago — solo pagados con ambas fechas válidas
  const diasPromedioInfo = useMemo(() => {
    const pagadosArr = filtered.filter(isPaid);
    let sum = 0, count = 0;
    pagadosArr.forEach(r => {
      const fs = parseDate(r.fecha_solicitud);
      const fp = parseDate(r.fecha_pago_real);
      if (!fs || !fp) return;
      const diff = Math.round((fp.getTime() - fs.getTime()) / 86400000);
      if (diff < 0) return;
      sum += diff;
      count++;
    });
    return {
      avg: count > 0 ? sum / count : 0,
      validos: count,
      totalPagados: pagadosArr.length,
    };
  }, [filtered]);

  // KPI 4: Sin OC
  const sinOC = useMemo(() => filtered.filter(r => {
    const oc = stripAccents(r.orden_compra).toUpperCase();
    return !oc || oc === "SN" || oc === "S/N" || oc === "N/A";
  }).length, [filtered]);

  // Section 3: Donut por Empresa (MXN equiv)
  const byEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const e = r.empresa || "—";
      map[e] = (map[e] || 0) + toMXN(r.monto_total, r.moneda);
    });
    const arr = Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);
    return arr.map(d => ({ ...d, __total: total }));
  }, [filtered, usdRate, eurRate]);

  // Donut por Moneda (MXN equiv)
  const byMoneda = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      map[r.moneda] = (map[r.moneda] || 0) + toMXN(r.monto_total, r.moneda);
    });
    const arr = Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);
    return arr.map(d => ({ ...d, __total: total }));
  }, [filtered, usdRate, eurRate]);

  // Section 4: Treemap proveedores
  const treemapData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      if (!r.transferencia_nombre) return;
      const k = stripAccents(r.transferencia_nombre);
      map[k] = (map[k] || 0) + toMXN(r.monto_total, r.moneda);
    });
    const arr = Object.entries(map)
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 30);
    const total = arr.reduce((s, d) => s + d.size, 0);
    return arr.map((d, i) => ({ ...d, __total: total, __fill: treemapColorByRank(i) }));
  }, [filtered, usdRate, eurRate]);

  // Section 6: Timeline pendientes
  const timeline = useMemo(() => {
    const list = highlightVencidas ? vencidas : pendientes;
    return [...list].sort((a, b) => {
      const da = parseDate(a.fecha_pago); const db = parseDate(b.fecha_pago);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }, [pendientes, vencidas, highlightVencidas]);

  // Totales por empresa (MXN eq.) — siempre todas las empresas (ignora filtro)
  const totalesPorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => {
      const e = r.empresa || "—";
      map[e] = (map[e] || 0) + toMXN(r.monto_total, r.moneda);
    });
    const arr = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);
    return { rows: arr, total };
  }, [records, usdRate, eurRate]);

  // Gasto mensual (MXN eq.) — respeta filtro empresa; agrupado por mes (fecha_solicitud)
  const gastoMensual = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const d = parseDate(r.fecha_solicitud) || parseDate(r.fecha_pago_real) || parseDate(r.fecha_pago);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + toMXN(r.monto_total, r.moneda);
    });
    return Object.entries(map)
      .map(([key, value]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
        return { key, label, value };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered, usdRate, eurRate]);


  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const empresasList = [...new Set(records.map(r => r.empresa).filter(Boolean))].sort();

  return (
    <div className="space-y-6 max-w-7xl mx-auto bg-[#F4F5F7] -mx-4 px-4 py-4 rounded-lg">
      {/* Filtro principal: empresa */}
      <Card className="rounded-2xl shadow-sm border-slate-200">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4A5568]">Filtrar por empresa</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={loadRecords}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const isAll = filterEmpresa === "all";
              return (
                <button
                  onClick={() => setFilterEmpresa("all")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all",
                    isAll
                      ? "bg-slate-800 text-white border-slate-800 shadow-md scale-105"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  )}
                >
                  Todas
                </button>
              );
            })()}
            {empresasList.map(e => {
              const color = EMPRESA_COLORS[e] || "#64748b";
              const active = filterEmpresa === e;
              return (
                <button
                  key={e}
                  onClick={() => setFilterEmpresa(active ? "all" : e)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all",
                    active ? "text-white shadow-md scale-105" : "bg-white hover:scale-[1.02]"
                  )}
                  style={
                    active
                      ? { backgroundColor: color, borderColor: color }
                      : { color, borderColor: color }
                  }
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Parámetros (tipos de cambio) */}
      <Card className="rounded-2xl shadow-sm border-slate-200">
        <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-700 hover:text-slate-900">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Ajuste de tipo de cambio
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", paramsOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 grid grid-cols-2 gap-4 max-w-md">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">USD → MXN</label>
                <Input type="number" step="0.01" value={usdRate} onChange={e => setUsdRate(Number(e.target.value) || 0)} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">EUR → MXN</label>
                <Input type="number" step="0.01" value={eurRate} onChange={e => setEurRate(Number(e.target.value) || 0)} className="h-9 rounded-lg" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* SECCIÓN 1 - Banner vencidas */}
      {vencidas.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-r from-red-600 to-red-700 text-white">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm opacity-90 font-medium">Solicitudes vencidas</p>
                <p className="text-2xl font-bold font-heading">{vencidas.length} SP{vencidas.length !== 1 ? "s" : ""} sin pagar</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-right">
                <p className="text-xs opacity-80">Monto vencido</p>
                <div className="flex flex-wrap gap-3 justify-end">
                  {vencidasMXN > 0 && <span className="font-bold">{fmtCur(vencidasMXN, "MXN")}</span>}
                  {vencidasUSD > 0 && <span className="font-bold">{fmtCur(vencidasUSD, "USD")}</span>}
                  {vencidasEUR > 0 && <span className="font-bold">{fmtCur(vencidasEUR, "EUR")}</span>}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setHighlightVencidas(v => !v)} className="rounded-lg bg-white text-red-700 hover:bg-white/90">
                {highlightVencidas ? "Ver todas pendientes" : "Ver vencidas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECCIÓN 2 - KPIs principales */}
      {/* Timeline pendientes - justo debajo del banner rojo */}
      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold text-slate-700">
            {highlightVencidas ? "Solicitudes vencidas" : "Pagos pendientes — timeline"}
          </CardTitle>
          <span className="text-xs text-slate-500">{timeline.length} solicitud{timeline.length !== 1 ? "es" : ""}</span>
        </CardHeader>
        <CardContent className="max-h-[28rem] overflow-auto">
          {timeline.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 hover:bg-transparent">
                  <TableHead className="text-xs">Num SP</TableHead>
                  <TableHead className="text-xs">Empresa</TableHead>
                  <TableHead className="text-xs">Beneficiario</TableHead>
                  <TableHead className="text-xs text-right">Monto</TableHead>
                  <TableHead className="text-xs">Moneda</TableHead>
                  <TableHead className="text-xs">F. tentativa</TableHead>
                  <TableHead className="text-xs text-right">Días</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeline.map((r, i) => {
                  const fp = parseDate(r.fecha_pago);
                  const dias = fp ? daysBetween(today, fp) : null;
                  const vencida = dias !== null && dias < 0;
                  return (
                    <TableRow key={r.num_sp + i} className={cn("border-slate-100", i % 2 === 1 && "bg-slate-50/60")}>
                      <TableCell className="text-xs font-medium">{r.num_sp}</TableCell>
                      <TableCell className="text-xs">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: (EMPRESA_COLORS[r.empresa] || "#64748B") + "22", color: EMPRESA_COLORS[r.empresa] || "#475569" }}>
                          {r.empresa}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.transferencia_nombre}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtCur(r.monto_total, r.moneda)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{r.moneda}</TableCell>
                      <TableCell className="text-xs">{fmtDate(r.fecha_pago)}</TableCell>
                      <TableCell className={cn("text-xs text-right font-semibold", vencida ? "text-red-600" : dias !== null && dias <= 3 ? "text-amber-600" : "text-slate-600")}>
                        {dias === null ? "—" : vencida ? `${Math.abs(dias)}d vencida` : `${dias}d`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : <p className="text-slate-400 text-sm text-center py-10">Sin solicitudes pendientes</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pendiente de pago</span>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#1B2A6B]/10">
                <Wallet className="h-4 w-4 text-[#1B2A6B]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">MXN</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pendMXN, "MXN")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">USD</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pendUSD, "USD")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">EUR</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pendEUR, "EUR")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pagado este mes</span>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">MXN</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pagadoMesPorMoneda.MXN || 0, "MXN")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">USD</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pagadoMesPorMoneda.USD || 0, "USD")}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">EUR</span>
                <span className="text-base font-bold font-heading text-slate-900 truncate">{fmtCur(pagadoMesPorMoneda.EUR || 0, "EUR")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <KpiCard
          icon={Clock}
          label="Días promedio al pago"
          tone="navy"
          mainValue={`${diasPromedioInfo.avg.toFixed(1)} días`}
          subValues={[`Basado en ${diasPromedioInfo.validos} de ${diasPromedioInfo.totalPagados} registros pagados`]}
        />
        <KpiCard
          icon={FileX}
          label="SPs sin OC"
          tone={sinOC > 15 ? "red" : sinOC > 5 ? "amber" : "navy"}
          mainValue={`${sinOC}`}
          subValues={["solicitudes"]}
        />
      </div>

      {/* SECCIÓN 3 - Distribución del gasto */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[#4A5568]">Gasto por empresa (MXN eq.)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {byEmpresa.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byEmpresa} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2} label={renderPieLabel} labelLine={{ stroke: "#CBD5E0" }} minAngle={6}>
                    {byEmpresa.map((d, i) => <Cell key={i} fill={EMPRESA_COLORS[d.name] || TREEMAP_SCALE[i % TREEMAP_SCALE.length]} />)}
                  </Pie>
                  <Tooltip content={<NavyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center pt-20">Sin datos</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[#4A5568]">Gasto por moneda (MXN eq.)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {byMoneda.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byMoneda} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2} label={renderPieLabel} labelLine={{ stroke: "#CBD5E0" }} minAngle={6}>
                    {byMoneda.map((d, i) => <Cell key={i} fill={CURRENCY_COLORS[d.name] || TREEMAP_SCALE[i % TREEMAP_SCALE.length]} />)}
                  </Pie>
                  <Tooltip content={<NavyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-400 text-sm text-center pt-20">Sin datos</p>}
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN 4 - Treemap proveedores */}
      <Card className="rounded-2xl shadow-sm border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[#4A5568]">Top proveedores (MXN eq.)</CardTitle>
        </CardHeader>
        <CardContent className="h-[28rem]">
          {treemapData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={treemapData.slice(0, 15).map(d => ({ ...d, value: d.size }))}
                layout="vertical"
                margin={{ top: 8, right: 80, left: 8, bottom: 8 }}
                barCategoryGap={6}
              >
                <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "#718096", fontSize: 11 }}
                  axisLine={{ stroke: "#CBD5E0" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fill: "#2D3748", fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + "…" : v)}
                />
                <Tooltip cursor={{ fill: "rgba(30,58,95,0.06)" }} content={<NavyTooltip />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                  {treemapData.slice(0, 15).map((d, i) => (
                    <Cell key={i} fill={d.__fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    style={{ fill: "#4A5568", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm text-center pt-20">Sin datos</p>}
        </CardContent>
      </Card>

      {/* SECCIÓN 5 - Proyectos */}
    </div>
  );
};

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  mainValue: string;
  subValues?: string[];
  tone?: "navy" | "green" | "amber" | "red";
}

const TONE_STYLES: Record<string, { bg: string; icon: string; value: string }> = {
  navy:  { bg: "bg-[#1B2A6B]/10", icon: "text-[#1B2A6B]", value: "text-slate-900" },
  green: { bg: "bg-emerald-100",  icon: "text-emerald-700", value: "text-slate-900" },
  amber: { bg: "bg-amber-100",    icon: "text-amber-700",   value: "text-amber-700" },
  red:   { bg: "bg-red-100",      icon: "text-red-600",     value: "text-red-600" },
};

const KpiCard = ({ icon: Icon, label, mainValue, subValues = [], tone = "navy" }: KpiCardProps) => {
  const t = TONE_STYLES[tone];
  return (
    <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.bg)}>
            <Icon className={cn("h-4 w-4", t.icon)} />
          </div>
        </div>
        <p className={cn("text-2xl font-bold font-heading leading-tight", t.value)}>{mainValue}</p>
        {subValues.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {subValues.map((v, i) => <p key={i} className="text-xs text-slate-500 font-medium">{v}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Tooltip navy unificado
const NavyTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const name = p.name || p.payload?.name || "";
  const value = Number(p.value || p.payload?.size || 0);
  // calcular % usando dataset total cuando esté disponible
  let pctStr = "";
  const total = p.payload?.__total;
  if (typeof total === "number" && total > 0) {
    pctStr = ` · ${((value / total) * 100).toFixed(1)}%`;
  }
  return (
    <div style={{ background: "#1E3A5F", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{name}</div>
      <div style={{ opacity: 0.9 }}>{fmtMXN(value)}{pctStr}</div>
    </div>
  );
};

// Treemap custom node — escala azul según tamaño
const TreemapNode = (props: any) => {
  const { x, y, width, height, name, size, payload, index, root } = props;
  let fill: string = payload?.__fill || props.__fill;
  if (!fill) {
    const rank = typeof index === "number"
      ? index
      : (root?.children ? root.children.findIndex((c: any) => c.name === name) : 0);
    fill = treemapColorByRank(rank >= 0 ? rank : 0);
  }
  const textColor = DARK_TREEMAP_FILLS.has(fill) ? "#fff" : "#1E3A5F";
  const showLabel = width > 70 && height > 36;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: "#fff", strokeWidth: 2 }} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fill={textColor} fontSize={11} fontWeight={700} style={{ pointerEvents: "none" }}>
            {String(name).length > Math.floor(width / 7) ? String(name).slice(0, Math.floor(width / 7) - 1) + "…" : name}
          </text>
          {height > 50 && (
            <text x={x + 8} y={y + 34} fill={textColor} fontSize={10} fontWeight={400} style={{ pointerEvents: "none" }}>
              ${(size / 1000).toFixed(0)}k
            </text>
          )}
        </>
      )}
    </g>
  );
};

export default KPIDashboard;
