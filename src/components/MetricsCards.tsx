import React from 'react';
import { Database, FileSpreadsheet, Zap, CheckCircle2, DollarSign } from 'lucide-react';
import { SystemStats } from '../types';

interface MetricsCardsProps {
  stats: SystemStats | null;
  loading: boolean;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ stats, loading }) => {
  const total = stats?.totalRecords ?? 0;
  const sheets = stats?.sheetsCount ?? 0;
  const avgLatency = stats?.avgLatency ?? 0;
  const totalSyncs = stats?.totalSyncs ?? 0;
  const errorSyncs = stats?.errorSyncs ?? 0;
  const monetary = stats?.totalMonetary ?? 0;

  const successRate = totalSyncs + errorSyncs > 0
    ? Math.round((totalSyncs / (totalSyncs + errorSyncs)) * 100)
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Metric 1 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Registros en BD</span>
          <Database className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {loading ? '---' : total.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500">filas</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <span>Persistente en memoria</span>
          <span aria-hidden="true">·</span>
          <span>Actualización en vivo</span>
        </div>
      </div>

      {/* Metric 2 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Planillas Activas</span>
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {loading ? '---' : sheets}
          </span>
          <span className="text-xs text-slate-500">hojas Google</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <span className="truncate">{stats?.sheets?.join(', ') || 'Sin planillas'}</span>
        </div>
      </div>

      {/* Metric 3 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Latencia Ingesta</span>
          <Zap className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {loading ? '---' : avgLatency}
          </span>
          <span className="text-xs text-slate-500">ms promedio</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <span>HTTP POST /api/ingest</span>
        </div>
      </div>

      {/* Metric 4 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Tasa de Entrega</span>
          <CheckCircle2 className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {loading ? '---' : `${successRate}%`}
          </span>
          <span className="text-xs text-slate-500">éxito</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <span className="font-mono tabular-nums">{totalSyncs} sincronizaciones</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{errorSyncs} fallas</span>
        </div>
      </div>

      {/* Metric 5 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold tracking-wider uppercase">Volumen Registrado</span>
          <DollarSign className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
            {loading ? '---' : `$${monetary.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </span>
          <span className="text-xs text-slate-500">USD</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
          <span>Valores numéricos sumados</span>
        </div>
      </div>
    </div>
  );
};
