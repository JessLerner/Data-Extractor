import React, { useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Clock, RefreshCw, FileText } from 'lucide-react';
import { SyncLog } from '../types';

interface SyncLogsViewerProps {
  logs: SyncLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const SyncLogsViewer: React.FC<SyncLogsViewerProps> = ({ logs, loading, onRefresh }) => {
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-700" />
            <span>Registro de Auditoría de Webhooks & Ingesta API</span>
            <span className="text-xs font-mono tabular-nums text-slate-500 font-normal">
              ({logs.length} eventos)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro en tiempo real de cada llamada HTTP recibida desde la extensión de Chrome y Google Apps Script
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar Logs</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4">Estado</th>
              <th className="py-2.5 px-3">Fecha y Hora</th>
              <th className="py-2.5 px-3">Acción</th>
              <th className="py-2.5 px-3">Hoja Google</th>
              <th className="py-2.5 px-3 text-right">Filas</th>
              <th className="py-2.5 px-3 text-right">Latencia</th>
              <th className="py-2.5 px-3">Origen / Cliente</th>
              <th className="py-2.5 px-4 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Cargando registros de auditoría...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No hay registros de webhook aún</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Las llamadas entrantes desde Google Sheets aparecerán aquí en vivo.
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isSuccess = log.status === 'success';
                const dateObj = new Date(log.timestamp);
                const formattedDate = dateObj.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isSuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        )}
                        <span className={`font-semibold ${isSuccess ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isSuccess ? '200 OK' : 'ERR'}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono tabular-nums">
                      {formattedDate} {formattedTime}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      {log.sourceSheet}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-900 font-medium">
                      {log.rowCount}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-500">
                      {log.durationMs}ms
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 truncate max-w-[180px]">
                      {log.userAgent || log.clientIp}
                    </td>

                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="text-xs text-slate-600 group-hover:text-slate-900 font-medium underline flex items-center gap-1 justify-end ml-auto"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver Payload</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Log Drawer/Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {selectedLog.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  Detalles del Evento HTTP
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">ID del Evento:</span>
                  <span className="font-mono text-slate-800">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha y Hora:</span>
                  <span className="font-mono text-slate-800">{new Date(selectedLog.timestamp).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Acción Ejecutada:</span>
                  <span className="font-mono font-medium text-slate-800">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tiempo de Ejecución:</span>
                  <span className="font-mono text-slate-800">{selectedLog.durationMs} ms</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hoja de Origen:</span>
                  <span className="font-medium text-slate-800">{selectedLog.sourceSheet}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Filas Procesadas:</span>
                  <span className="font-mono font-medium text-slate-800">{selectedLog.rowCount}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block mb-1 font-semibold uppercase tracking-wider text-[11px]">
                  Resumen de la Carga Útil
                </span>
                <p className="p-3 bg-slate-100 rounded text-slate-800 font-mono text-xs">
                  {selectedLog.payloadPreview || 'Sin vista previa adicional.'}
                </p>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <span className="text-rose-600 block mb-1 font-semibold uppercase tracking-wider text-[11px]">
                    Mensaje de Error
                  </span>
                  <p className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 font-mono text-xs">
                    {selectedLog.errorMessage}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
