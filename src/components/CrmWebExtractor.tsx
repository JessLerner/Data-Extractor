import React, { useState, useMemo } from 'react';
import {
  Globe,
  Filter,
  Calendar,
  Users,
  Send,
  CheckCircle2,
  AlertCircle,
  Database,
  Search,
  Sliders,
  TrendingUp,
  Download,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../services/api';
import { sendRowsToSupabase, loadSupabaseConfig } from '../services/supabaseClient';

export interface CrmRecord {
  id: string;
  codigo_crm: string;
  empresa_cliente: string;
  contacto: string;
  equipo_asignado: string;
  fecha_ingreso: string; // YYYY-MM-DD
  monto_estimado: number;
  moneda: string;
  estado: string;
  canal_origen: string;
  responsable: string;
}

// Initial realistic CRM Web Dataset
const SAMPLE_CRM_RECORDS: CrmRecord[] = [
  {
    id: 'crm_1',
    codigo_crm: 'CRM-2026-1001',
    empresa_cliente: 'Laboratorios Farmacéuticos Andinos',
    contacto: 'Dr. Alejandro Ruiz',
    equipo_asignado: 'Equipo Enterprise',
    fecha_ingreso: '2026-10-02',
    monto_estimado: 18500,
    moneda: 'USD',
    estado: 'Cerrado Ganado',
    canal_origen: 'Portal Web CRM',
    responsable: 'Camila Torres'
  },
  {
    id: 'crm_2',
    codigo_crm: 'CRM-2026-1002',
    empresa_cliente: 'Soluciones Logísticas del Plata',
    contacto: 'Ing. Marcelo Gómez',
    equipo_asignado: 'Equipo Ventas Latam',
    fecha_ingreso: '2026-10-06',
    monto_estimado: 7400,
    moneda: 'USD',
    estado: 'En Negociación',
    canal_origen: 'Formulario Web',
    responsable: 'Lucas Rossi'
  },
  {
    id: 'crm_3',
    codigo_crm: 'CRM-2026-1003',
    empresa_cliente: 'Fintech Vanguardia Digital',
    contacto: 'Lic. Paula Mendez',
    equipo_asignado: 'Equipo Enterprise',
    fecha_ingreso: '2026-10-11',
    monto_estimado: 32000,
    moneda: 'USD',
    estado: 'Cerrado Ganado',
    canal_origen: 'Llamada Entrante',
    responsable: 'Valentina Morales'
  },
  {
    id: 'crm_4',
    codigo_crm: 'CRM-2026-1004',
    empresa_cliente: 'Retail & Supermercados del Sur',
    contacto: 'Esteban Morales',
    equipo_asignado: 'Equipo Soporte & Retención',
    fecha_ingreso: '2026-10-15',
    monto_estimado: 5600,
    moneda: 'USD',
    estado: 'Pendiente Validación',
    canal_origen: 'Portal Web CRM',
    responsable: 'Martín Navarro'
  },
  {
    id: 'crm_5',
    codigo_crm: 'CRM-2026-1005',
    empresa_cliente: 'Automotriz Apex Europa',
    contacto: 'Helena Berg',
    equipo_asignado: 'Equipo Ventas Latam',
    fecha_ingreso: '2026-10-19',
    monto_estimado: 14200,
    moneda: 'USD',
    estado: 'En Negociación',
    canal_origen: 'Web Scraping / Lead',
    responsable: 'Sofía Herrera'
  },
  {
    id: 'crm_6',
    codigo_crm: 'CRM-2026-1006',
    empresa_cliente: 'Agroindustrias del Valle',
    contacto: 'Rodrigo Peña',
    equipo_asignado: 'Equipo Soporte & Retención',
    fecha_ingreso: '2026-10-21',
    monto_estimado: 8900,
    moneda: 'USD',
    estado: 'Cerrado Ganado',
    canal_origen: 'Portal Web CRM',
    responsable: 'Lucas Rossi'
  },
  {
    id: 'crm_7',
    codigo_crm: 'CRM-2026-1007',
    empresa_cliente: 'Telecomunicaciones del Pacífico',
    contacto: 'Verónica Castro',
    equipo_asignado: 'Equipo Enterprise',
    fecha_ingreso: '2026-10-22',
    monto_estimado: 24500,
    moneda: 'USD',
    estado: 'En Negociación',
    canal_origen: 'Portal Web CRM',
    responsable: 'Valentina Morales'
  },
  // Records from previous month (September 2026) to test monthly filter
  {
    id: 'crm_8',
    codigo_crm: 'CRM-2026-0925',
    empresa_cliente: 'Constructora Urbana Q3',
    contacto: 'Javier Silva',
    equipo_asignado: 'Equipo Ventas Latam',
    fecha_ingreso: '2026-09-25',
    monto_estimado: 9200,
    moneda: 'USD',
    estado: 'Cerrado Ganado',
    canal_origen: 'Histórico CRM',
    responsable: 'Martín Navarro'
  },
  {
    id: 'crm_9',
    codigo_crm: 'CRM-2026-0914',
    empresa_cliente: 'Cadena Hotelera Caribe',
    contacto: 'Ana Lucía Vélez',
    equipo_asignado: 'Equipo Enterprise',
    fecha_ingreso: '2026-09-14',
    monto_estimado: 16000,
    moneda: 'USD',
    estado: 'Cerrado Ganado',
    canal_origen: 'Histórico CRM',
    responsable: 'Camila Torres'
  }
];

interface CrmWebExtractorProps {
  apiKey: string;
  onDataIngested: () => void;
}

export const CrmWebExtractor: React.FC<CrmWebExtractorProps> = ({
  apiKey,
  onDataIngested
}) => {
  // User Criteria Filters
  const [periodFilter, setPeriodFilter] = useState<'current_month' | 'last_month' | 'all'>('current_month');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Custom monthly target
  const [monthlyTarget, setMonthlyTarget] = useState<number>(10);

  // Status & Actions
  const [extracting, setExtracting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const teams = ['Equipo Enterprise', 'Equipo Ventas Latam', 'Equipo Soporte & Retención'];

  // Current month prefix (2026-10)
  const currentMonthPrefix = '2026-10';
  const lastMonthPrefix = '2026-09';

  // Apply user criteria to CRM records
  const filteredCrmRecords = useMemo(() => {
    return SAMPLE_CRM_RECORDS.filter(record => {
      // Period filter
      if (periodFilter === 'current_month') {
        if (!record.fecha_ingreso.startsWith(currentMonthPrefix)) return false;
      } else if (periodFilter === 'last_month') {
        if (!record.fecha_ingreso.startsWith(lastMonthPrefix)) return false;
      }

      // Team filter
      if (selectedTeam !== 'all' && record.equipo_asignado !== selectedTeam) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && record.estado !== selectedStatus) {
        return false;
      }

      // Min amount
      if (minAmount > 0 && record.monto_estimado < minAmount) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const text = `${record.codigo_crm} ${record.empresa_cliente} ${record.contacto} ${record.responsable}`.toLowerCase();
        if (!text.includes(searchQuery.toLowerCase())) return false;
      }

      return true;
    });
  }, [periodFilter, selectedTeam, selectedStatus, minAmount, searchQuery]);

  // Monthly stats for control KPI
  const currentMonthTotalCount = useMemo(() => {
    return SAMPLE_CRM_RECORDS.filter(r => r.fecha_ingreso.startsWith(currentMonthPrefix)).length;
  }, []);

  const currentMonthTotalAmount = useMemo(() => {
    return SAMPLE_CRM_RECORDS
      .filter(r => r.fecha_ingreso.startsWith(currentMonthPrefix))
      .reduce((acc, r) => acc + r.monto_estimado, 0);
  }, []);

  const filteredTotalAmount = useMemo(() => {
    return filteredCrmRecords.reduce((acc, r) => acc + r.monto_estimado, 0);
  }, [filteredCrmRecords]);

  // Team breakdown in current month
  const teamBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    SAMPLE_CRM_RECORDS.filter(r => r.fecha_ingreso.startsWith(currentMonthPrefix)).forEach(r => {
      counts[r.equipo_asignado] = (counts[r.equipo_asignado] || 0) + 1;
    });
    return Object.entries(counts);
  }, []);

  // Execute extraction according to user criteria and send to External DB & Supabase
  const handleExtractAndSync = async () => {
    if (filteredCrmRecords.length === 0) {
      setStatusMessage({ type: 'error', text: 'No hay registros que coincidan con el criterio seleccionado.' });
      return;
    }

    setExtracting(true);
    setStatusMessage({
      type: 'info',
      text: `Extrayendo ${filteredCrmRecords.length} registros del CRM según el criterio del usuario...`
    });

    try {
      const recordsToIngest = filteredCrmRecords.map(r => ({
        codigo: r.codigo_crm,
        cliente: r.empresa_cliente,
        contacto: r.contacto,
        equipo: r.equipo_asignado,
        fecha_ingreso: r.fecha_ingreso,
        monto: r.monto_estimado,
        moneda: r.moneda,
        estado: r.estado,
        canal: r.canal_origen,
        responsable: r.responsable,
        origen_scraping: 'CRM Web Portal'
      }));

      // 1. Send to API Ingest Endpoint
      const apiRes = await apiClient.ingestData({
        sheetName: `CRM_Web_${periodFilter === 'current_month' ? 'Octubre_2026' : 'Filtrado'}`,
        spreadsheetTitle: 'Extracción Portal Web CRM',
        spreadsheetId: 'crm_web_scraping_live',
        action: 'batch_sync',
        records: recordsToIngest,
        apiKey
      });

      // 2. Forward to Supabase if configured
      const supabaseConfig = loadSupabaseConfig();
      let supabaseMsg = '';
      if (supabaseConfig.projectUrl && supabaseConfig.apiKey) {
        const supRes = await sendRowsToSupabase(recordsToIngest, supabaseConfig, {
          sheetName: 'CRM_Web_Portal',
          spreadsheetTitle: 'Extracción Portal CRM'
        });
        if (supRes.success) {
          supabaseMsg = ` y ${supRes.insertedCount} filas sincronizadas en Supabase (${supabaseConfig.tableName})`;
        }
      }

      setStatusMessage({
        type: 'success',
        text: `¡Extracción Exitosa! Se enviaron ${apiRes.insertedCount || recordsToIngest.length} registros del CRM a la base de datos externa${supabaseMsg}.`
      });
      onDataIngested();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al procesar la extracción del CRM.'
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Monthly Control & Team Overview Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                <Globe className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Control de Datos Ingresados en el Mes & Equipos (CRM Web)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Monitorea el volumen de datos ingresados en el mes activo, controla los equipos asignados y extrae según el criterio deseado
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExtractAndSync}
              disabled={extracting || filteredCrmRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{extracting ? 'Extrayendo...' : `Extraer y Enviar (${filteredCrmRecords.length} filas)`}</span>
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Monthly Control Strip Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Ingresados en el Mes</span>
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {currentMonthTotalCount}
              </span>
              <span className="text-xs text-slate-500">registros en Octubre 2026</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Meta mensual: <span className="font-mono font-semibold text-slate-700">{monthlyTarget}</span> ({Math.round((currentMonthTotalCount / monthlyTarget) * 100)}%)
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Valor Estimado Mes</span>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                ${currentMonthTotalAmount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">USD</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Suma de oportunidades de este mes
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Equipos Activos</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {teamBreakdown.length}
              </span>
              <span className="text-xs text-slate-500">equipos ingresando datos</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 truncate">
              {teamBreakdown.map(([t, c]) => `${t}: ${c}`).join(' · ')}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Filtrados para Extraer</span>
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                {filteredCrmRecords.length}
              </span>
              <span className="text-xs text-slate-500">listos para ingesta</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums">
              Total: ${filteredTotalAmount.toLocaleString()} USD
            </div>
          </div>
        </div>
      </div>

      {/* User Extraction Criteria Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-700" />
          <span>Configurar Criterio de Extracción del Usuario</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Period Criteria */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Período de Ingreso
            </label>
            <select
              value={periodFilter}
              onChange={(e: any) => setPeriodFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none"
            >
              <option value="current_month">Mes Actual (Octubre 2026)</option>
              <option value="last_month">Mes Anterior (Septiembre 2026)</option>
              <option value="all">Todos los Períodos Registrados</option>
            </select>
          </div>

          {/* Team Criteria */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Filtrar por Equipo
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none"
            >
              <option value="all">Todos los Equipos</option>
              {teams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Criteria */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Estado de Oportunidad
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="Cerrado Ganado">Cerrado Ganado</option>
              <option value="En Negociación">En Negociación</option>
              <option value="Pendiente Validación">Pendiente Validación</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              Búsqueda por Texto
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cliente, contacto, responsable..."
                className="w-full pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Live Web CRM View */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Browser Mockup Chrome Header */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
            </div>
            <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              https://crm.corporativo.net/leads-mensuales
            </span>
          </div>

          <div className="text-[11px] font-medium text-slate-600">
            Página Web Externa / CRM Activo
          </div>
        </div>

        {/* Table of CRM records */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-2.5 px-3">Código CRM</th>
                <th className="py-2.5 px-3">Empresa Cliente</th>
                <th className="py-2.5 px-3">Contacto</th>
                <th className="py-2.5 px-3">Equipo Asignado</th>
                <th className="py-2.5 px-3">Fecha Ingreso</th>
                <th className="py-2.5 px-3 text-right">Monto Estimado</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCrmRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Ningún registro coincide con el criterio actual. Modifica el período o equipo.
                  </td>
                </tr>
              ) : (
                filteredCrmRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-800 font-medium">
                      {rec.codigo_crm}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {rec.empresa_cliente}
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {rec.contacto}
                    </td>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium text-[11px]">
                        {rec.equipo_asignado}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                      {rec.fecha_ingreso}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      ${rec.monto_estimado.toLocaleString()} {rec.moneda}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        rec.estado === 'Cerrado Ganado'
                          ? 'bg-emerald-50 text-emerald-800'
                          : rec.estado === 'En Negociación'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}>
                        {rec.estado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {rec.responsable}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando {filteredCrmRecords.length} de {SAMPLE_CRM_RECORDS.length} registros del CRM
          </span>
          <button
            onClick={handleExtractAndSync}
            disabled={extracting || filteredCrmRecords.length === 0}
            className="flex items-center gap-1.5 font-semibold text-slate-900 hover:underline"
          >
            <span>Extraer y Sincronizar Criterio Actual</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
