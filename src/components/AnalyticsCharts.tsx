import React, { useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Globe } from 'lucide-react';
import { SheetRecord } from '../types';

interface AnalyticsChartsProps {
  records: SheetRecord[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ records }) => {
  // 1. Group by category
  const categoryStats = useMemo(() => {
    const counts: Record<string, { count: number; totalAmount: number }> = {};
    records.forEach(r => {
      const cat = r.data.categoria || r.data.rubro || r.data.tipo || 'Sin Categoría';
      const amt = Number(r.data.monto || r.data.total || r.data.precio || 0) || 0;
      if (!counts[cat]) counts[cat] = { count: 0, totalAmount: 0 };
      counts[cat].count += 1;
      counts[cat].totalAmount += amt;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1].totalAmount - a[1].totalAmount);
    const maxAmount = Math.max(...entries.map(e => e[1].totalAmount), 1);

    return { entries, maxAmount };
  }, [records]);

  // 2. Group by status
  const statusStats = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const st = r.data.estado || r.data.status || 'Completado';
      counts[st] = (counts[st] || 0) + 1;
    });
    return Object.entries(counts);
  }, [records]);

  // 3. Group by country
  const countryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const country = r.data.pais || r.data.region || r.data.ciudad || 'Global';
      counts[country] = (counts[country] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [records]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chart 1: Categorías y Volumen Monetario */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span>Volumen por Categoría</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Monto total y frecuencia de registros</p>
          </div>
          <span className="text-xs font-mono text-slate-400">USD</span>
        </div>

        <div className="space-y-3 mt-2">
          {categoryStats.entries.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Sin datos de categorías</p>
          ) : (
            categoryStats.entries.map(([cat, data]) => {
              const pct = Math.round((data.totalAmount / categoryStats.maxAmount) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-[160px]">{cat}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-slate-400 text-[11px]">{data.count} items</span>
                      <span className="font-semibold text-slate-900">${data.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-800 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chart 2: Estado de Operaciones */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 text-slate-500" />
              <span>Estado de Operaciones</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribución según columna estado</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Ratio</span>
        </div>

        <div className="space-y-3 mt-2">
          {statusStats.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Sin estados registrados</p>
          ) : (
            statusStats.map(([status, count]) => {
              const pct = records.length > 0 ? Math.round((count / records.length) * 100) : 0;
              const isCompleted = status.toLowerCase().includes('complet') || status.toLowerCase().includes('aprob') || status.toLowerCase().includes('pagad');
              const isPending = status.toLowerCase().includes('pend') || status.toLowerCase().includes('esper');

              const barColor = isCompleted
                ? 'bg-emerald-600'
                : isPending
                ? 'bg-amber-500'
                : 'bg-slate-600';

              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${barColor}`}></span>
                      <span className="font-medium text-slate-700">{status}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Actualización en tiempo real</span>
          <span className="font-mono tabular-nums">{records.length} transacciones</span>
        </div>
      </div>

      {/* Chart 3: Distribución Geográfica */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500" />
              <span>Distribución por País / Región</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Orígenes geográficos identificados</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Top 5</span>
        </div>

        <div className="space-y-3 mt-2">
          {countryStats.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Sin datos de ubicación</p>
          ) : (
            countryStats.map(([country, count]) => {
              const maxCountry = countryStats[0][1] || 1;
              const pct = Math.round((count / maxCountry) * 100);
              return (
                <div key={country} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{country}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">{count} filas</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Sincronización Multi-Fuente</span>
          <span className="font-mono tabular-nums">{countryStats.length} mercados</span>
        </div>
      </div>
    </div>
  );
};
