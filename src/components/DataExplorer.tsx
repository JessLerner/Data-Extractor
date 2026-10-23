import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Trash2, Eye, ArrowUpDown, ChevronRight, FileSpreadsheet, X, Sliders } from 'lucide-react';
import { SheetRecord } from '../types';

interface DataExplorerProps {
  records: SheetRecord[];
  sheets: string[];
  selectedSheet: string;
  setSelectedSheet: (sheet: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  loading: boolean;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({
  records,
  sheets,
  selectedSheet,
  setSelectedSheet,
  searchQuery,
  setSearchQuery,
  onDeleteRecord,
  onClearAll,
  loading
}) => {
  const [inspectRecord, setInspectRecord] = useState<SheetRecord | null>(null);
  const [sortField, setSortField] = useState<string>('ingestedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [showColPicker, setShowColPicker] = useState<boolean>(false);

  // Compute all available dynamic columns from all records (no slice limit)
  const allColumns = useMemo(() => {
    const colSet = new Set<string>();
    // First prioritize common business columns
    const priority = ['codigo', 'id', 'cliente', 'nombre', 'categoria', 'monto', 'total', 'moneda', 'estado', 'status', 'pais', 'vendedor', 'fecha'];
    priority.forEach(p => {
      if (records.some(r => r.data[p] !== undefined)) {
        colSet.add(p);
      }
    });

    // Add all remaining columns
    records.forEach(r => {
      Object.keys(r.data).forEach(k => {
        if (!colSet.has(k) && k !== '_source_tab') {
          colSet.add(k);
        }
      });
    });

    return Array.from(colSet);
  }, [records]);

  // Default selected columns to all columns
  useEffect(() => {
    if (selectedCols.length === 0 && allColumns.length > 0) {
      setSelectedCols(allColumns);
    }
  }, [allColumns, selectedCols.length]);

  const activeColumns = useMemo(() => {
    return selectedCols.length > 0 ? selectedCols : allColumns;
  }, [selectedCols, allColumns]);

  // Sort and filter records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (sortField === 'ingestedAt') {
      result.sort((a, b) => {
        const timeA = new Date(a.ingestedAt).getTime();
        const timeB = new Date(b.ingestedAt).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    } else {
      result.sort((a, b) => {
        const valA = a.data[sortField] ?? '';
        const valB = b.data[sortField] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return sortOrder === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [records, sortField, sortOrder]);

  const toggleSort = (colKey: string) => {
    if (sortField === colKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(colKey);
      setSortOrder('asc');
    }
  };

  const handleToggleCol = (col: string) => {
    if (selectedCols.includes(col)) {
      setSelectedCols(selectedCols.filter(c => c !== col));
    } else {
      setSelectedCols([...selectedCols, col]);
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return;
    const colsToExport = activeColumns;
    const allHeaders = ['id', 'sourceSheet', 'spreadsheetTitle', 'ingestedAt', ...colsToExport];
    const csvRows = [
      allHeaders.join(','),
      ...filteredRecords.map(r => {
        return allHeaders.map(h => {
          let val = '';
          if (h === 'id') val = r.id;
          else if (h === 'sourceSheet') val = r.sourceSheet;
          else if (h === 'spreadsheetTitle') val = r.spreadsheetTitle;
          else if (h === 'ingestedAt') val = r.ingestedAt;
          else val = r.data[h] !== undefined ? String(r.data[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sheetstream-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header controls strip */}
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Registros Extraídos en Base de Datos</span>
            <span className="text-xs font-mono tabular-nums text-slate-500 font-normal">
              ({filteredRecords.length} filas disponibles)
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Datos ingestados automáticamente desde Google Sheets a través del Webhook REST
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en registros..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <button
            onClick={() => setShowColPicker(!showColPicker)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
              showColPicker
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Columnas ({selectedCols.length}/{allColumns.length})</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar BD</span>
          </button>
        </div>
      </div>

      {/* Column picker dropdown panel */}
      {showColPicker && (
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">
              Selecciona las columnas que deseas mostrar y exportar a CSV:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCols([...allColumns])}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                Todas
              </button>
              <button
                onClick={() => setSelectedCols([])}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                Ninguna
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {allColumns.map(col => {
              const isSelected = selectedCols.includes(col);
              return (
                <button
                  key={col}
                  onClick={() => handleToggleCol(col)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors border ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sheet tab segmented filter bar */}
      <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-xs font-medium text-slate-500 mr-2 shrink-0">Filtrar por Hoja:</span>
        <button
          onClick={() => setSelectedSheet('all')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors shrink-0 ${
            selectedSheet === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Todas ({records.length})
        </button>
        {sheets.map(sheet => {
          const count = records.filter(r => r.sourceSheet === sheet).length;
          return (
            <button
              key={sheet}
              onClick={() => setSelectedSheet(sheet)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors shrink-0 flex items-center gap-1.5 ${
                selectedSheet === sheet
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-3 h-3 text-slate-400" />
              <span>{sheet}</span>
              <span className="font-mono tabular-nums text-[11px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Table grid with horizontal scroll container */}
      <div className="table-scroll-container overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs min-w-max">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 w-12 text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-2xs">#</th>
              <th 
                className="py-2.5 px-3 cursor-pointer hover:text-slate-900 sticky left-12 bg-slate-50 z-10 border-r border-slate-200 shadow-2xs"
                onClick={() => toggleSort('ingestedAt')}
              >
                <div className="flex items-center gap-1">
                  <span>Hora Ingesta</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3">Hoja Origen</th>
              {activeColumns.map(col => {
                const isNumeric = records.some(r => typeof r.data[col] === 'number');
                return (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={`py-2.5 px-3 cursor-pointer hover:text-slate-900 font-mono ${isNumeric ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex items-center gap-1 ${isNumeric ? 'justify-end' : 'justify-start'}`}>
                      <span>{col.replace(/_/g, ' ')}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                );
              })}
              <th className="py-2.5 px-3 text-right sticky right-0 bg-slate-50 z-10 border-l border-slate-200 shadow-2xs">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && records.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="h-10 animate-pulse bg-slate-50/30">
                  <td colSpan={activeColumns.length + 4} className="py-3 px-4 text-slate-400 text-center">
                    Cargando registros...
                  </td>
                </tr>
              ))
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 4} className="py-12 text-center text-slate-500">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No se encontraron registros</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Envía datos usando Google Sheets, carga un archivo XLS/CSV o conecta tu CRM.
                  </p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, index) => {
                const timeStr = new Date(record.ingestedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-2 px-4 text-center font-mono tabular-nums text-slate-400 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-100 shadow-2xs">
                      {index + 1}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono tabular-nums sticky left-12 bg-white hover:bg-slate-50 z-10 border-r border-slate-100 shadow-2xs">
                      {timeStr}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>{record.sourceSheet}</span>
                      </div>
                    </td>
                    {activeColumns.map(col => {
                      const val = record.data[col];
                      const isNumeric = typeof val === 'number';
                      const isMoney = col.includes('monto') || col.includes('total') || col.includes('precio');

                      let displayVal = '-';
                      if (val !== undefined && val !== null) {
                        if (isMoney && isNumeric) {
                          displayVal = `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        } else if (isNumeric) {
                          displayVal = val.toLocaleString();
                        } else {
                          displayVal = String(val);
                        }
                      }

                      return (
                        <td
                          key={col}
                          className={`py-2 px-3 whitespace-nowrap font-mono ${
                            isNumeric ? 'text-right tabular-nums font-medium text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right whitespace-nowrap sticky right-0 bg-white hover:bg-slate-50 z-10 border-l border-slate-100 shadow-2xs">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => setInspectRecord(record)}
                          title="Inspeccionar registro completo"
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRecord(record.id)}
                          title="Eliminar de base de datos"
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Row inspector modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xl w-full p-6 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Detalles del Registro #{inspectRecord.id}
                </h3>
                <p className="text-xs text-slate-500">
                  Planilla: {inspectRecord.spreadsheetTitle} ({inspectRecord.sourceSheet})
                </p>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">ID Interno BD:</span>
                  <span className="font-mono font-medium text-slate-800">{inspectRecord.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Fecha/Hora Ingesta:</span>
                  <span className="font-mono text-slate-800">{new Date(inspectRecord.ingestedAt).toLocaleString('es-ES')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hoja de Cálculo:</span>
                  <span className="font-medium text-slate-800">{inspectRecord.sourceSheet}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">ID de Google Sheets:</span>
                  <span className="font-mono text-slate-600 truncate block">
                    {inspectRecord.spreadsheetId || 'No provisto'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Carga Útil Extraída (Payload)
                </h4>
                <div className="space-y-1.5">
                  {Object.entries(inspectRecord.data).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between py-1.5 px-3 bg-white border border-slate-100 rounded text-xs">
                      <span className="font-mono text-slate-500">{key}:</span>
                      <span className="font-medium text-slate-900 font-mono">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  JSON Crudo
                </h4>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(inspectRecord, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
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
