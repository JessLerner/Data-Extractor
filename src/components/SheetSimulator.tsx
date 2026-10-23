import React, { useState, useEffect } from 'react';
import { Plus, Play, RefreshCw, Send, CheckCircle2, AlertCircle, Sparkles, Clock } from 'lucide-react';
import { apiClient } from '../services/api';

interface SheetRow {
  codigo: string;
  cliente: string;
  pais: string;
  categoria: string;
  monto: number;
  moneda: string;
  estado: string;
  vendedor: string;
}

const DEFAULT_ROWS: SheetRow[] = [
  { codigo: 'PED-5001', cliente: 'BioTech Solutions', pais: 'Argentina', categoria: 'Software Cloud', monto: 4500, moneda: 'USD', estado: 'Completado', vendedor: 'Valentina Morales' },
  { codigo: 'PED-5002', cliente: 'Minería del Norte', pais: 'Chile', categoria: 'IoT & Telemetría', monto: 8200, moneda: 'USD', estado: 'En Proceso', vendedor: 'Martín Navarro' },
  { codigo: 'PED-5003', cliente: 'Fintech Capital', pais: 'México', categoria: 'Infraestructura API', monto: 14000, moneda: 'USD', estado: 'Completado', vendedor: 'Sofía Herrera' },
  { codigo: 'PED-5004', cliente: 'AgroData Latam', pais: 'Colombia', categoria: 'Consultoría BI', monto: 6300, moneda: 'USD', estado: 'Pendiente', vendedor: 'Lucas Rossi' },
  { codigo: 'PED-5005', cliente: 'Retail Express', pais: 'España', categoria: 'Licencias Enterprise', monto: 11500, moneda: 'USD', estado: 'Completado', vendedor: 'Valentina Morales' }
];

interface SheetSimulatorProps {
  apiKey: string;
  onSyncTriggered: () => void;
}

export const SheetSimulator: React.FC<SheetSimulatorProps> = ({ apiKey, onSyncTriggered }) => {
  const [sheetTabs, setSheetTabs] = useState<string[]>(['Ventas_2026', 'Prospectos_Leads', 'Inventario_Stock', 'Equipos_Soporte']);
  const [activeSheet, setActiveSheet] = useState<string>('Ventas_2026');
  const [rows, setRows] = useState<SheetRow[]>(DEFAULT_ROWS);
  const [triggerOnEdit, setTriggerOnEdit] = useState<boolean>(true);
  const [autoTimerActive, setAutoTimerActive] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ status: 'idle' | 'syncing' | 'success' | 'error'; message: string; timestamp?: string }>({
    status: 'idle',
    message: 'Listo para simular la extracción de Google Sheets.'
  });

  // Cell edit handler
  const handleCellChange = async (index: number, field: keyof SheetRow, value: any) => {
    const updated = [...rows];
    let parsedVal = value;
    if (field === 'monto') {
      parsedVal = Number(value) || 0;
    }
    updated[index] = { ...updated[index], [field]: parsedVal };
    setRows(updated);

    // If triggerOnEdit is enabled, simulate Google Sheets onEdit(e) trigger
    if (triggerOnEdit) {
      setSyncStatus({ status: 'syncing', message: `Simulando onEdit() celda [${field}] en fila ${index + 1}...` });
      try {
        await apiClient.ingestData({
          sheetName: activeSheet,
          spreadsheetTitle: 'Simulador Planilla Google Sheets',
          spreadsheetId: 'sim_googlesheets_live_test',
          action: 'cell_edit',
          record: updated[index],
          apiKey
        });
        setSyncStatus({
          status: 'success',
          message: `onEdit ejecutado: Fila ${updated[index].codigo} enviada vía webhook a la BD en tiempo real.`,
          timestamp: new Date().toLocaleTimeString()
        });
        onSyncTriggered();
      } catch (err: any) {
        setSyncStatus({ status: 'error', message: err.message || 'Error al enviar cambio' });
      }
    }
  };

  // Add row
  const handleAddRow = () => {
    const randomId = Math.floor(5000 + Math.random() * 4000);
    const clients = ['Nexus Logistics', 'Quantum Labs', 'Solaris Energy', 'Global Retail Corp', 'Banco Vanguardia'];
    const countries = ['Argentina', 'Chile', 'México', 'Colombia', 'España', 'Perú'];
    const categories = ['Software Cloud', 'Infraestructura API', 'Consultoría BI', 'Licencias Enterprise', 'IoT & Telemetría'];
    const sellers = ['Valentina Morales', 'Martín Navarro', 'Sofía Herrera', 'Lucas Rossi'];

    const newRow: SheetRow = {
      codigo: `PED-${randomId}`,
      cliente: clients[Math.floor(Math.random() * clients.length)],
      pais: countries[Math.floor(Math.random() * countries.length)],
      categoria: categories[Math.floor(Math.random() * categories.length)],
      monto: Math.round(2000 + Math.random() * 15000),
      moneda: 'USD',
      estado: 'Completado',
      vendedor: sellers[Math.floor(Math.random() * sellers.length)]
    };

    const newRows = [...rows, newRow];
    setRows(newRows);

    if (triggerOnEdit) {
      apiClient.ingestData({
        sheetName: activeSheet,
        spreadsheetTitle: 'Simulador Planilla Google Sheets',
        spreadsheetId: 'sim_googlesheets_live_test',
        action: 'cell_edit',
        record: newRow,
        apiKey
      }).then(() => {
        setSyncStatus({
          status: 'success',
          message: `Nueva fila ${newRow.codigo} creada y sincronizada automáticamente con la base de datos externa.`,
          timestamp: new Date().toLocaleTimeString()
        });
        onSyncTriggered();
      }).catch(err => {
        setSyncStatus({ status: 'error', message: err.message });
      });
    }
  };

  // Sync entire sheet (Simulate button click in Chrome Extension or "syncAllSheetData" in Apps Script)
  const handleSyncEntireSheet = async () => {
    setSyncStatus({ status: 'syncing', message: 'Extrayendo todas las filas y enviando a la API...' });
    try {
      const res = await apiClient.ingestData({
        sheetName: activeSheet,
        spreadsheetTitle: 'Simulador Planilla Google Sheets',
        spreadsheetId: 'sim_googlesheets_live_test',
        action: 'batch_sync',
        records: rows,
        apiKey
      });
      setSyncStatus({
        status: 'success',
        message: `Sincronización en lote completada: ${rows.length} filas enviadas (${res.durationMs || 105}ms).`,
        timestamp: new Date().toLocaleTimeString()
      });
      onSyncTriggered();
    } catch (err: any) {
      setSyncStatus({ status: 'error', message: err.message || 'Error en la sincronización en lote' });
    }
  };

  // Periodic Auto-Sync simulation
  useEffect(() => {
    let interval: any = null;
    if (autoTimerActive) {
      interval = setInterval(async () => {
        // Randomly update an existing row's amount or status to simulate live edits
        setRows(prev => {
          if (prev.length === 0) return prev;
          const targetIndex = Math.floor(Math.random() * prev.length);
          const current = prev[targetIndex];
          const delta = Math.round((Math.random() - 0.4) * 500);
          const updatedRow = {
            ...current,
            monto: Math.max(1000, current.monto + delta),
            estado: Math.random() > 0.7 ? 'Completado' : 'En Proceso'
          };
          const nextRows = [...prev];
          nextRows[targetIndex] = updatedRow;

          apiClient.ingestData({
            sheetName: activeSheet,
            spreadsheetTitle: 'Simulador Planilla Google Sheets',
            spreadsheetId: 'sim_googlesheets_live_test',
            action: 'cell_edit',
            record: updatedRow,
            apiKey
          }).then(() => {
            setSyncStatus({
              status: 'success',
              message: `Auto-Sync Timer: Fila ${updatedRow.codigo} actualizada con $${updatedRow.monto} USD.`,
              timestamp: new Date().toLocaleTimeString()
            });
            onSyncTriggered();
          }).catch(console.error);

          return nextRows;
        });
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoTimerActive, activeSheet, apiKey, onSyncTriggered]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Simulation Banner & Title */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 tracking-tight">
              Simulador Interactivo de Google Sheets
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Sandbox en Vivo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prueba cómo la extensión y el script detectan cambios en las celdas y los envían automáticamente a la API en tiempo real.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Fila</span>
          </button>

          <button
            onClick={handleSyncEntireSheet}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sincronizar Planilla Completa</span>
          </button>
        </div>
      </div>

      {/* Simulator Toolbar & Automation Triggers */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        {/* Sheet Tab Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-slate-600 shrink-0">Pestaña Seleccionada:</span>
          {sheetTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSheet(tab)}
              className={`px-3 py-1 rounded font-medium transition-colors shrink-0 ${
                activeSheet === tab
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => {
              const name = window.prompt('Nombre de la nueva pestaña:', `Pestaña_${sheetTabs.length + 1}`);
              if (name && name.trim()) {
                const clean = name.trim().replace(/\s+/g, '_');
                setSheetTabs(prev => [...prev, clean]);
                setActiveSheet(clean);
              }
            }}
            className="px-2 py-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold shrink-0"
            title="Crear nueva pestaña"
          >
            + Nueva Pestaña
          </button>
        </div>

        {/* Automation Triggers Toggles */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={triggerOnEdit}
              onChange={(e) => setTriggerOnEdit(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
            />
            <span>Disparar en cada edición (onEdit)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
            <input
              type="checkbox"
              checked={autoTimerActive}
              onChange={(e) => setAutoTimerActive(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Auto-Sync cada 5s</span>
            </span>
          </label>
        </div>
      </div>

      {/* Live Spreadsheet Grid */}
      <div className="overflow-x-auto bg-slate-100/40 p-4">
        <div className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-2 px-3 border-r border-slate-300 w-10 text-center bg-slate-200/60 font-mono">#</th>
                <th className="py-2 px-3 border-r border-slate-300">Código</th>
                <th className="py-2 px-3 border-r border-slate-300">Cliente</th>
                <th className="py-2 px-3 border-r border-slate-300">Categoría</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right">Monto (USD)</th>
                <th className="py-2 px-3 border-r border-slate-300">Moneda</th>
                <th className="py-2 px-3 border-r border-slate-300">País</th>
                <th className="py-2 px-3 border-r border-slate-300">Estado</th>
                <th className="py-2 px-3">Vendedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-1.5 px-3 border-r border-slate-200 text-center font-mono text-slate-400 bg-slate-50 text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.codigo}
                      onChange={(e) => handleCellChange(idx, 'codigo', e.target.value)}
                      className="w-full py-1 px-1.5 font-mono text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 font-medium">
                    <input
                      type="text"
                      value={row.cliente}
                      onChange={(e) => handleCellChange(idx, 'cliente', e.target.value)}
                      className="w-full py-1 px-1.5 text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300 text-slate-900"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.categoria}
                      onChange={(e) => handleCellChange(idx, 'categoria', e.target.value)}
                      className="w-full py-1 px-1.5 text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300 text-slate-700"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 text-right">
                    <input
                      type="number"
                      value={row.monto}
                      onChange={(e) => handleCellChange(idx, 'monto', e.target.value)}
                      className="w-full py-1 px-1.5 text-right font-mono tabular-nums text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300 font-semibold text-slate-900"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200 font-mono text-slate-500">
                    <input
                      type="text"
                      value={row.moneda}
                      onChange={(e) => handleCellChange(idx, 'moneda', e.target.value)}
                      className="w-full py-1 px-1.5 text-xs font-mono bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.pais}
                      onChange={(e) => handleCellChange(idx, 'pais', e.target.value)}
                      className="w-full py-1 px-1.5 text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300"
                    />
                  </td>
                  <td className="py-1 px-2 border-r border-slate-200">
                    <select
                      value={row.estado}
                      onChange={(e) => handleCellChange(idx, 'estado', e.target.value)}
                      className="w-full py-1 px-1 text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300 text-slate-800"
                    >
                      <option value="Completado">Completado</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </td>
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      value={row.vendedor}
                      onChange={(e) => handleCellChange(idx, 'vendedor', e.target.value)}
                      className="w-full py-1 px-1.5 text-xs bg-transparent focus:bg-white focus:outline-blue-500 rounded border border-transparent hover:border-slate-300 text-slate-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-Time Status Feedback Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {syncStatus.status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : syncStatus.status === 'syncing' ? (
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          ) : syncStatus.status === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="text-slate-700 font-medium">{syncStatus.message}</span>
        </div>

        {syncStatus.timestamp && (
          <span className="text-slate-400 font-mono text-[11px] shrink-0">
            Último evento: {syncStatus.timestamp}
          </span>
        )}
      </div>
    </div>
  );
};
