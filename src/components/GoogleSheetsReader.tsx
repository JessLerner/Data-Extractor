import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  LogIn,
  LogOut,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Send,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  fetchDriveSpreadsheets,
  fetchSpreadsheetContent,
  fetchSpreadsheetTabs,
  DriveSpreadsheetFile,
  ExtractedSheetData,
  SheetTabSummary
} from '../services/googleAuth';
import { User } from 'firebase/auth';
import { apiClient } from '../services/api';
import { sendRowsToSupabase, loadSupabaseConfig } from '../services/supabaseClient';

interface GoogleSheetsReaderProps {
  apiKey: string;
  onDataIngested: () => void;
}

export const GoogleSheetsReader: React.FC<GoogleSheetsReaderProps> = ({
  apiKey,
  onDataIngested
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [manualSheetInput, setManualSheetInput] = useState<string>('');
  
  // Tabs management
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>('');
  const [activeSpreadsheetTitle, setActiveSpreadsheetTitle] = useState<string>('');
  const [availableTabs, setAvailableTabs] = useState<SheetTabSummary[]>([]);
  const [selectedTabNames, setSelectedTabNames] = useState<string[]>([]);
  const [loadingTabs, setLoadingTabs] = useState<boolean>(false);

  // Extraction state
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<ExtractedSheetData | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        loadUserSpreadsheets(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setSpreadsheets([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        loadUserSpreadsheets(result.accessToken);
        setStatusMessage({
          type: 'success',
          text: `Conectado como ${result.user.email} con permisos de solo lectura.`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al iniciar sesión con Google.'
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setSpreadsheets([]);
    setAvailableTabs([]);
    setSelectedTabNames([]);
    setExtractedData(null);
  };

  const loadUserSpreadsheets = async (accessToken: string) => {
    setLoadingFiles(true);
    try {
      const files = await fetchDriveSpreadsheets(accessToken);
      setSpreadsheets(files);
    } catch (err: any) {
      console.warn('Error fetching Drive files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const parseSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) return urlMatch[1];
    return trimmed;
  };

  // Inspect and load all tabs (pestañas) for a spreadsheet
  const handleLoadTabs = async (id: string, name?: string) => {
    if (!token) {
      setStatusMessage({ type: 'error', text: 'Inicia sesión con Google para ver las pestañas.' });
      return;
    }
    const cleanId = parseSpreadsheetId(id);
    if (!cleanId) {
      setStatusMessage({ type: 'error', text: 'Ingresa un enlace o ID válido de Google Sheets.' });
      return;
    }

    setLoadingTabs(true);
    setStatusMessage({ type: 'info', text: 'Consultando pestañas (hojas) de la planilla...' });
    setActiveSpreadsheetId(cleanId);
    setExtractedData(null);

    try {
      const result = await fetchSpreadsheetTabs(cleanId, token);
      setActiveSpreadsheetTitle(result.title);
      setAvailableTabs(result.tabs);
      // Default is ALWAYS the last tab per user requirement
      if (result.tabs.length > 0) {
        const lastTab = result.tabs[result.tabs.length - 1];
        setSelectedTabNames([lastTab.title]);
      }
      setStatusMessage({
        type: 'success',
        text: `Planilla "${result.title}" cargada. Se detectaron ${result.tabs.length} pestañas. Selecciona cuáles deseas extraer.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudieron leer las pestañas de la planilla.'
      });
      setAvailableTabs([]);
    } finally {
      setLoadingTabs(false);
    }
  };

  const toggleTabSelection = (tabTitle: string) => {
    setSelectedTabNames(prev => {
      if (prev.includes(tabTitle)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(t => t !== tabTitle);
      } else {
        return [...prev, tabTitle];
      }
    });
  };

  const selectAllTabs = () => {
    setSelectedTabNames(availableTabs.map(t => t.title));
  };

  const handleExtractFromSelectedTabs = async () => {
    if (!token || !activeSpreadsheetId) return;
    if (selectedTabNames.length === 0) {
      setStatusMessage({ type: 'error', text: 'Selecciona al menos una pestaña para extraer.' });
      return;
    }

    setExtracting(true);
    setStatusMessage({
      type: 'info',
      text: `Extrayendo datos de ${selectedTabNames.length} pestaña(s): [${selectedTabNames.join(', ')}]...`
    });

    try {
      const data = await fetchSpreadsheetContent(activeSpreadsheetId, token, selectedTabNames);
      setExtractedData(data);
      setStatusMessage({
        type: 'success',
        text: `¡Extracción completada! Se extrajeron ${data.rows.length} filas de las pestañas [${selectedTabNames.join(', ')}].`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al extraer filas de las pestañas seleccionadas.'
      });
    } finally {
      setExtracting(false);
    }
  };

  // Pipe extracted rows to local external DB API and Supabase
  const handleIngestAndForward = async () => {
    if (!extractedData || extractedData.rows.length === 0) return;

    setStatusMessage({ type: 'info', text: 'Enviando filas a la base de datos y Supabase...' });

    try {
      const apiRes = await apiClient.ingestData({
        sheetName: extractedData.sheetName,
        spreadsheetTitle: extractedData.title,
        spreadsheetId: extractedData.spreadsheetId,
        action: 'batch_sync',
        records: extractedData.rows,
        apiKey
      });

      const supabaseConfig = loadSupabaseConfig();
      let supabaseMsg = '';
      if (supabaseConfig.projectUrl && supabaseConfig.apiKey) {
        const supRes = await sendRowsToSupabase(extractedData.rows, supabaseConfig, {
          sheetName: extractedData.sheetName,
          spreadsheetTitle: extractedData.title,
          spreadsheetId: extractedData.spreadsheetId
        });
        if (supRes.success) {
          supabaseMsg = ` y ${supRes.insertedCount} filas sincronizadas en Supabase (${supabaseConfig.tableName})`;
        }
      }

      setStatusMessage({
        type: 'success',
        text: `✅ ${apiRes.insertedCount || extractedData.rows.length} filas ingestadas en la base de datos externa${supabaseMsg}.`
      });
      onDataIngested();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al ingestar los datos.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Guarantee Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs text-emerald-950 space-y-1">
            <h3 className="text-sm font-bold text-emerald-900">
              Garantía de Funcionamiento para Hojas de "Solo Lectura" (Lector) y Multi-Pestaña
            </h3>
            <p className="leading-relaxed">
              <strong>Sí, funciona al 100% con hojas donde solo tienes permisos de visualización.</strong> Para extraer datos <strong>nunca se requiere permiso de edición</strong>. Ahora puedes seleccionar de forma individual o combinada exactamente <strong>de qué pestañas</strong> extraer los datos.
            </p>
          </div>
        </div>
      </div>

      {/* Google Sign In & Account Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-800" />
              <span>Conexión de Cuenta de Google</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inicia sesión con tu cuenta de Google para leer planillas propias o compartidas en modo solo lectura
            </p>
          </div>

          <div>
            {!user ? (
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="inline-flex items-center gap-3 px-4 py-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors disabled:opacity-50"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>{isLoggingIn ? 'Conectando...' : 'Iniciar Sesión con Google'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Usuario'}
                      className="w-7 h-7 rounded-full border border-slate-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-900">{user.displayName || user.email}</div>
                    <div className="text-[11px] text-slate-500">{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión de Google"
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Notification */}
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
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-blue-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Manual URL or ID Input */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
            Ingresar URL o ID de Google Sheets (Solo Lectura o Propia)
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <FileSpreadsheet className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualSheetInput}
                onChange={(e) => setManualSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:bg-white text-slate-900"
              />
            </div>
            <button
              onClick={() => handleLoadTabs(manualSheetInput)}
              disabled={!token || loadingTabs || !manualSheetInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 shrink-0"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{loadingTabs ? 'Detectando pestañas...' : 'Detectar Pestañas'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Al detectar la planilla, podrás marcar y elegir exactamente de qué pestañas extraer la información.
          </p>
        </div>

        {/* Tab Selection Section */}
        {availableTabs.length > 0 && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <span>Pestañas Disponibles en "{activeSpreadsheetTitle}"</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Marca las pestañas que deseas incluir en la extracción
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllTabs}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700"
                >
                  Seleccionar Todas ({availableTabs.length})
                </button>
                <button
                  onClick={handleExtractFromSelectedTabs}
                  disabled={extracting || selectedTabNames.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors disabled:opacity-40"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{extracting ? 'Extrayendo...' : `Extraer Datos (${selectedTabNames.length} pestañas)`}</span>
                </button>
              </div>
            </div>

            {/* Checkable Tabs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
              {availableTabs.map(tab => {
                const isSelected = selectedTabNames.includes(tab.title);
                return (
                  <div
                    key={tab.sheetId}
                    onClick={() => toggleTabSelection(tab.title)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2 select-none ${
                      isSelected
                        ? 'bg-white border-slate-900 shadow-2xs ring-1 ring-slate-900'
                        : 'bg-white/60 border-slate-200 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-slate-900 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">{tab.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {tab.rowCount ? `${tab.rowCount} filas aprox.` : 'Hoja activa'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* User Spreadsheets List from Google Drive */}
        {user && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Planillas Detectadas en tu Google Drive
              </h3>
              <button
                onClick={() => token && loadUserSpreadsheets(token)}
                disabled={loadingFiles}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                <span>Actualizar Lista</span>
              </button>
            </div>

            {loadingFiles ? (
              <p className="text-xs text-slate-400 py-3 text-center">Buscando planillas de Google...</p>
            ) : spreadsheets.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No se encontraron planillas o usa el campo superior para pegar un enlace directo.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {spreadsheets.map(file => {
                  const isReadOnly = file.capabilities?.canEdit === false;
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setManualSheetInput(file.id);
                        handleLoadTabs(file.id, file.name);
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 truncate">{file.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          {isReadOnly ? (
                            <span className="text-amber-700 font-medium bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px]">
                              Solo Lectura
                            </span>
                          ) : (
                            <span className="text-slate-500">Editor</span>
                          )}
                          <span>·</span>
                          <span className="font-mono text-[10px] truncate max-w-[100px]">{file.id}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setManualSheetInput(file.id);
                          handleLoadTabs(file.id, file.name);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:bg-slate-50 rounded text-slate-700 shrink-0"
                      >
                        Ver Pestañas
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extracted Data Preview & Dispatch to Supabase / External DB */}
      {extractedData && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {extractedData.title}
                </span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                  Pestañas: {extractedData.sheetName}
                </span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  {extractedData.rows.length} filas leídas
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Datos leídos de las pestañas seleccionadas mediante la API oficial con permisos de solo lectura
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleIngestAndForward}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ingestar a Base de Datos & Supabase</span>
              </button>
            </div>
          </div>

          {/* Grid Preview */}
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <th className="py-2 px-3 w-10 text-center font-mono">#</th>
                  {extractedData.headers.map(h => (
                    <th key={h} className="py-2 px-3 whitespace-nowrap">
                      {h === '_source_tab' ? 'Pestaña Origen' : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extractedData.rows.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {idx + 1}
                    </td>
                    {extractedData.headers.map(h => {
                      const val = row[h];
                      return (
                        <td key={h} className={`py-1.5 px-3 whitespace-nowrap ${
                          h === '_source_tab' ? 'font-semibold text-slate-900 bg-slate-50/70 font-mono text-[11px]' : 'text-slate-800'
                        }`}>
                          {typeof val === 'number' ? (
                            <span className="font-mono tabular-nums font-medium">{val.toLocaleString()}</span>
                          ) : (
                            String(val ?? '')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {extractedData.rows.length > 15 && (
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              Mostrando las primeras 15 filas de {extractedData.rows.length}. Haz clic en "Ingestar a Base de Datos & Supabase" para sincronizar todas.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
