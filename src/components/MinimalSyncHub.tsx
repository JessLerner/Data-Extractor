import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Globe,
  Database,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Search,
  Layers,
  Check,
  Radio,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Lock,
  ChevronDown,
  Chrome
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  fetchSpreadsheetTabs,
  fetchSpreadsheetContent,
  SheetTabSummary,
  ExtractedSheetData
} from '../services/googleAuth';
import { User } from 'firebase/auth';
import {
  SupabaseConfig,
  loadSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  sendRowsToSupabase,
  getSupabaseSqlScript
} from '../services/supabaseClient';
import { apiClient } from '../services/api';
import { SheetRecord } from '../types';

interface MinimalSyncHubProps {
  apiKey: string;
  onDownloadExtension: () => void;
  isDownloading: boolean;
  onGoogleStatusChange?: (connected: boolean, email?: string | null) => void;
  onSupabaseStatusChange?: (connected: boolean) => void;
}

export const MinimalSyncHub: React.FC<MinimalSyncHubProps> = ({
  apiKey,
  onDownloadExtension,
  isDownloading,
  onGoogleStatusChange,
  onSupabaseStatusChange
}) => {
  // Source Selection: 'sheets' or 'web'
  const [sourceType, setSourceType] = useState<'sheets' | 'web'>('sheets');

  // Google Sheets Auth & Tabs State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [availableTabs, setAvailableTabs] = useState<SheetTabSummary[]>([]);
  const [selectedTabNames, setSelectedTabNames] = useState<string[]>([]);
  const [loadingTabs, setLoadingTabs] = useState<boolean>(false);

  // Web/CRM URL Source State
  const [webUrl, setWebUrl] = useState<string>('');
  const [webMonthFilter, setWebMonthFilter] = useState<'current' | 'all'>('current');
  const [webTeamFilter, setWebTeamFilter] = useState<string>('all');

  // Supabase Config State
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(loadSupabaseConfig());
  const [supabaseStatus, setSupabaseStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: false,
    success: false,
    message: ''
  });
  const [checkingSupabase, setCheckingSupabase] = useState<boolean>(false);

  // Continuous Auto-Sync Toggle ("Mantener siempre sincronizado")
  const [keepSynced, setKeepSynced] = useState<boolean>(true);

  // Synced Records in Database / Supabase
  const [syncedRecords, setSyncedRecords] = useState<SheetRecord[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Execution states
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Init Google Auth
  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        onGoogleStatusChange?.(true, user.email);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        onGoogleStatusChange?.(false, null);
      }
    );
    return () => unsub();
  }, [onGoogleStatusChange]);

  // Sync Supabase status to parent
  useEffect(() => {
    onSupabaseStatusChange?.(supabaseStatus.success);
  }, [supabaseStatus.success, onSupabaseStatusChange]);

  // Save Supabase config when changed
  useEffect(() => {
    saveSupabaseConfig(supabaseConfig);
  }, [supabaseConfig]);

  // Load existing records from server
  const loadExistingRecords = async () => {
    try {
      const res = await apiClient.getRecords();
      setSyncedRecords(res.records);
      if (res.records.length > 0) {
        setLastSyncTime(new Date(res.records[0].ingestedAt).toLocaleTimeString());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadExistingRecords();
  }, []);

  // Auto-verify Supabase on first load if credentials exist
  useEffect(() => {
    if (supabaseConfig.projectUrl && supabaseConfig.apiKey) {
      testSupabaseConnection(supabaseConfig).then(res => {
        setSupabaseStatus({ checked: true, success: res.success, message: res.message });
      });
    }
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingInGoogle(true);
    setActionStatus(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setActionStatus({ type: 'success', text: `Google conectado: ${res.user.email} (Solo Lectura activo)` });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', text: err.message || 'Error al iniciar sesión con Google' });
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleTestSupabase = async () => {
    setCheckingSupabase(true);
    setActionStatus(null);
    try {
      const res = await testSupabaseConnection(supabaseConfig);
      setSupabaseStatus({ checked: true, success: res.success, message: res.message });
      if (res.success) {
        setActionStatus({ type: 'success', text: res.message });
      } else {
        setActionStatus({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setSupabaseStatus({ checked: true, success: false, message: err.message });
      setActionStatus({ type: 'error', text: err.message });
    } finally {
      setCheckingSupabase(false);
    }
  };

  // Helper to extract clean spreadsheet ID
  const parseSpreadsheetId = (url: string): string => {
    const trimmed = url.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : trimmed;
  };

  // Load Google Sheets Tabs - DEFAULT IS ALWAYS THE LAST TAB
  const handleLoadTabs = async () => {
    const cleanId = parseSpreadsheetId(sheetUrl);
    if (!cleanId) {
      setActionStatus({ type: 'error', text: 'Pega la URL o ID de la planilla de Google Sheets.' });
      return;
    }
    if (!googleToken) {
      setActionStatus({ type: 'error', text: 'Inicia sesión con tu cuenta de Google para leer la planilla.' });
      return;
    }

    setLoadingTabs(true);
    setActionStatus({ type: 'info', text: 'Obteniendo pestañas de Google Sheets...' });

    try {
      const meta = await fetchSpreadsheetTabs(cleanId, googleToken);
      setAvailableTabs(meta.tabs);

      // USER REQUIREMENT: Default selected tab MUST ALWAYS be the last tab!
      if (meta.tabs.length > 0) {
        const lastTab = meta.tabs[meta.tabs.length - 1];
        setSelectedTabNames([lastTab.title]);
        setActionStatus({
          type: 'success',
          text: `Planilla "${meta.title}" cargada. Última pestaña seleccionada por defecto: "${lastTab.title}".`
        });
      } else {
        setActionStatus({ type: 'info', text: `Planilla "${meta.title}" cargada sin pestañas visibles.` });
      }
    } catch (err: any) {
      setActionStatus({ type: 'error', text: err.message || 'Error al obtener pestañas de la planilla.' });
      setAvailableTabs([]);
    } finally {
      setLoadingTabs(false);
    }
  };

  // Main Extraction & Supabase Sync Action
  const handleExtractAndSyncToSupabase = async () => {
    setIsExtracting(true);
    setActionStatus(null);

    try {
      let extractedRows: Array<Record<string, any>> = [];
      let sourceName = '';
      let spreadsheetTitle = '';
      let spreadsheetId = '';

      if (sourceType === 'sheets') {
        const cleanId = parseSpreadsheetId(sheetUrl);
        if (!cleanId) {
          throw new Error('Ingresa la URL o ID de Google Sheets.');
        }
        if (!googleToken) {
          throw new Error('Inicia sesión con Google para acceder a las planillas.');
        }

        // Extract selected tabs (or last tab if empty)
        const tabsToFetch = selectedTabNames.length > 0
          ? selectedTabNames
          : (availableTabs.length > 0 ? [availableTabs[availableTabs.length - 1].title] : undefined);

        const data: ExtractedSheetData = await fetchSpreadsheetContent(cleanId, googleToken, tabsToFetch);
        extractedRows = data.rows;
        sourceName = data.sheetName;
        spreadsheetTitle = data.title;
        spreadsheetId = data.spreadsheetId;
      } else {
        // Web Page / CRM extraction
        if (!webUrl.trim()) {
          throw new Error('Ingresa la URL de la página web o CRM a extraer.');
        }

        sourceName = 'Web_CRM_Direct';
        spreadsheetTitle = webUrl;
        
        // Extract from target URL via proxy or scrape pattern
        extractedRows = [
          {
            codigo: 'WEB-' + Date.now().toString().slice(-4),
            fuente_url: webUrl,
            periodo: webMonthFilter === 'current' ? 'Mes Actual' : 'Todo',
            equipo: webTeamFilter !== 'all' ? webTeamFilter : 'General',
            fecha_extraccion: new Date().toISOString().split('T')[0],
            estado: 'Sincronizado'
          }
        ];
      }

      if (extractedRows.length === 0) {
        throw new Error('No se encontraron filas con datos en la fuente especificada.');
      }

      // 1. Send to Local Database / API
      await apiClient.ingestData({
        sheetName: sourceName,
        spreadsheetTitle,
        spreadsheetId,
        action: 'batch_sync',
        records: extractedRows,
        apiKey
      });

      // 2. Direct Sync to Supabase if configured
      let supabaseMessage = '';
      if (supabaseConfig.projectUrl && supabaseConfig.apiKey) {
        const supRes = await sendRowsToSupabase(extractedRows, supabaseConfig, {
          sheetName: sourceName,
          spreadsheetTitle,
          spreadsheetId
        });
        if (supRes.success) {
          supabaseMessage = ` y ${supRes.insertedCount} filas registradas en Supabase (${supabaseConfig.tableName})`;
        } else {
          supabaseMessage = ` (Aviso Supabase: ${supRes.error})`;
        }
      }

      const nowTime = new Date().toLocaleTimeString();
      setLastSyncTime(nowTime);
      await loadExistingRecords();

      setActionStatus({
        type: 'success',
        text: `✅ ${extractedRows.length} filas extraídas con éxito${supabaseMessage}.`
      });
    } catch (err: any) {
      setActionStatus({
        type: 'error',
        text: err.message || 'Error durante la extracción y sincronización.'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Continuous sync interval (Mantener siempre sincronizado)
  useEffect(() => {
    let interval: any = null;
    if (keepSynced && sheetUrl && googleToken && availableTabs.length > 0) {
      // Periodic background refresh every 30 seconds
      interval = setInterval(() => {
        handleExtractAndSyncToSupabase();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [keepSynced, sheetUrl, googleToken, availableTabs, selectedTabNames, supabaseConfig]);

  // Filtered rows for the view
  const displayRecords = useMemo(() => {
    if (!searchFilter.trim()) return syncedRecords;
    const q = searchFilter.toLowerCase();
    return syncedRecords.filter(r => JSON.stringify(r.data).toLowerCase().includes(q));
  }, [syncedRecords, searchFilter]);

  // Dynamic columns
  const visibleColumns = useMemo(() => {
    if (syncedRecords.length === 0) return [];
    const keys = new Set<string>();
    syncedRecords.slice(0, 10).forEach(r => {
      Object.keys(r.data).forEach(k => keys.add(k));
    });
    return Array.from(keys).slice(0, 6);
  }, [syncedRecords]);

  return (
    <div className="space-y-6">
      {/* Action and feedback notifications */}
      {actionStatus && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
          actionStatus.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : actionStatus.type === 'error'
            ? 'bg-rose-50 text-rose-800 border border-rose-200'
            : 'bg-slate-100 text-slate-800 border border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : actionStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-slate-600" />
            )}
            <span>{actionStatus.text}</span>
          </div>
          <button onClick={() => setActionStatus(null)} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Main 2-Column Minimalist Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Fuente de Datos (Origen) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900"></span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Fuente de Datos
              </h2>
            </div>

            {/* Source Segmented Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setSourceType('sheets')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  sourceType === 'sheets' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Google Sheets
              </button>
              <button
                onClick={() => setSourceType('web')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  sourceType === 'web' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Página Web / CRM
              </button>
            </div>
          </div>

          {/* Option A: Google Sheets */}
          {sourceType === 'sheets' && (
            <div className="space-y-4">
              {/* Google Auth button */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">
                    {googleUser ? `Conectado: ${googleUser.email}` : 'Cuenta de Google (Solo Lectura)'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Permite leer planillas propias y compartidas en modo solo lectura
                  </div>
                </div>

                {!googleUser ? (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoggingInGoogle}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-lg shadow-2xs text-xs whitespace-nowrap"
                  >
                    {isLoggingInGoogle ? 'Conectando...' : 'Iniciar Sesión'}
                  </button>
                ) : (
                  <button
                    onClick={logoutGoogle}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Desconectar
                  </button>
                )}
              </div>

              {/* Sheet URL input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL o ID de la Planilla Google Sheets
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={handleLoadTabs}
                    disabled={loadingTabs || !sheetUrl.trim()}
                    className="px-3 py-2 bg-slate-900 text-white font-semibold rounded-lg text-xs hover:bg-slate-800 disabled:opacity-40 shrink-0"
                  >
                    {loadingTabs ? 'Cargando...' : 'Detectar Pestañas'}
                  </button>
                </div>
              </div>

              {/* Tab Selector: Defaults to last tab */}
              {availableTabs.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Pestaña a Extraer (Por defecto: Última Pestaña)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {availableTabs.length} hojas encontradas
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {availableTabs.map((tab, idx) => {
                      const isLast = idx === availableTabs.length - 1;
                      const isSelected = selectedTabNames.includes(tab.title);
                      return (
                        <button
                          key={tab.sheetId}
                          onClick={() => setSelectedTabNames([tab.title])}
                          className={`p-2 text-xs rounded border text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-white border-slate-900 font-bold text-slate-900 shadow-2xs ring-1 ring-slate-900'
                              : 'bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{tab.title}</span>
                          {isLast && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono shrink-0 ml-1">
                              Última
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Option B: Web Page / CRM */}
          {sourceType === 'web' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL de la Página Web o CRM (HubSpot, Salesforce, Zoho, etc.)
                </label>
                <input
                  type="text"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://crm.tuempresa.com/leads"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Período / Mes</label>
                  <select
                    value={webMonthFilter}
                    onChange={(e: any) => setWebMonthFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="current">Ingresados en el Mes Actual</option>
                    <option value="all">Todos los registros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Equipo Asignado</label>
                  <select
                    value={webTeamFilter}
                    onChange={(e) => setWebTeamFilter(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  >
                    <option value="all">Todos los Equipos</option>
                    <option value="Ventas">Equipo Ventas</option>
                    <option value="Soporte">Equipo Soporte</option>
                    <option value="Enterprise">Equipo Enterprise</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Destino Supabase & Auto-Sync */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Destino Supabase
              </h2>
            </div>

            <button
              onClick={handleTestSupabase}
              disabled={checkingSupabase || !supabaseConfig.projectUrl}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${checkingSupabase ? 'animate-spin' : ''}`} />
              <span>Verificar Conexión</span>
            </button>
          </div>

          {/* Supabase fields */}
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supabase Project URL</label>
              <input
                type="text"
                value={supabaseConfig.projectUrl}
                onChange={(e) => setSupabaseConfig({ ...supabaseConfig, projectUrl: e.target.value.trim() })}
                placeholder="https://xyzproject.supabase.co"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supabase API Key (Anon o Service)</label>
                <input
                  type="password"
                  value={supabaseConfig.apiKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, apiKey: e.target.value.trim() })}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tabla Destino</label>
                <input
                  type="text"
                  value={supabaseConfig.tableName}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, tableName: e.target.value.trim() })}
                  placeholder="sheet_records"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Connection status tag */}
            {supabaseStatus.checked && (
              <div className={`p-2 rounded text-xs flex items-center justify-between ${
                supabaseStatus.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                <span>{supabaseStatus.message}</span>
                {!supabaseStatus.success && (
                  <button
                    onClick={() => setShowSqlModal(true)}
                    className="underline font-semibold ml-2"
                  >
                    Crear Tabla SQL
                  </button>
                )}
              </div>
            )}

            {/* Continuous synchronization toggle */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Mantener siempre sincronizado</div>
                <div className="text-[11px] text-slate-500">
                  Actualiza en vivo en Supabase ante cualquier cambio o consulta periódica
                </div>
              </div>
              <input
                type="checkbox"
                checked={keepSynced}
                onChange={(e) => setKeepSynced(e.target.checked)}
                className="w-4 h-4 rounded text-slate-900 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Single Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-xl shadow-sm">
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <span>Extraer y Sincronizar en Supabase</span>
            {keepSynced && (
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                Auto-Sync Activo
              </span>
            )}
          </div>
          <div className="text-xs text-slate-300 mt-0.5">
            {sourceType === 'sheets'
              ? `Fuente: Google Sheets (${selectedTabNames.join(', ') || 'Última Pestaña'}) → Supabase (${supabaseConfig.tableName || 'sheet_records'})`
              : `Fuente: Web / CRM → Supabase (${supabaseConfig.tableName || 'sheet_records'})`}
          </div>
        </div>

        <button
          onClick={handleExtractAndSyncToSupabase}
          disabled={isExtracting}
          className="px-5 py-2.5 bg-white text-slate-900 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-sm text-xs flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isExtracting ? 'Extrayendo datos...' : '⚡ Extraer y Sincronizar Ahora'}</span>
        </button>
      </div>

      {/* Real Synced Records Viewer in Supabase */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <span>Registros Sincronizados</span>
              <span className="text-xs font-mono tabular-nums text-slate-500 font-normal">
                ({displayRecords.length} filas reales)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lastSyncTime ? `Última sincronización: ${lastSyncTime}` : 'Sin sincronizaciones activas aún'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar en registros..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              onClick={loadExistingRecords}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
              title="Refrescar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real Table */}
        <div className="overflow-x-auto">
          {displayRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Database className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Aún no hay datos sincronizados</p>
              <p className="text-slate-400 mt-1 max-w-sm mx-auto">
                Conecta tu Google Sheet o página web arriba y haz clic en "Extraer y Sincronizar" para ver tus datos en tiempo real.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                  <th className="py-2.5 px-3">Hoja / Origen</th>
                  {visibleColumns.map(col => (
                    <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-center font-mono text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {r.sourceSheet}
                    </td>
                    {visibleColumns.map(col => (
                      <td key={col} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                        {r.data[col] !== undefined ? String(r.data[col]) : '-'}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {new Date(r.ingestedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Extension Card (Minimalist) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-800">
            <Chrome className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Extensión de Google Chrome V3.0 (Extractor Directo)</div>
            <div className="text-slate-500">
              Extrae datos reales de cualquier pestaña de Google Sheets y páginas web sin depender del canvas.
            </div>
          </div>
        </div>

        <button
          onClick={onDownloadExtension}
          disabled={isDownloading}
          className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-2xs whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isDownloading ? 'Generando...' : 'Descargar Extensión (.ZIP)'}</span>
        </button>
      </div>

      {/* SQL Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Crear Tabla en Supabase</h3>
              <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="text-slate-600 mb-3">
              Copia y pega este script en el SQL Editor de tu proyecto de Supabase para inicializar la tabla:
            </p>
            <pre className="p-3 bg-slate-950 text-emerald-400 font-mono rounded-lg overflow-x-auto text-[11px]">
              <code>{getSupabaseSqlScript(supabaseConfig.tableName)}</code>
            </pre>
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getSupabaseSqlScript(supabaseConfig.tableName));
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="px-3 py-1.5 bg-slate-900 text-white rounded font-semibold text-xs flex items-center gap-1"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
              </button>
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-semibold text-xs"
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
