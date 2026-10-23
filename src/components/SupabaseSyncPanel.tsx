import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Send,
  RefreshCw,
  Copy,
  Check,
  Shield,
  Code2,
  Key,
  Globe,
  Sliders,
  ExternalLink,
  LogIn,
  UserCheck
} from 'lucide-react';
import {
  SupabaseConfig,
  loadSupabaseConfig,
  saveSupabaseConfig,
  getSupabase,
  testSupabaseConnection,
  sendRowsToSupabase,
  getSupabaseSqlScript
} from '../services/supabaseClient';
import { SheetRecord } from '../types';

interface SupabaseSyncPanelProps {
  records: SheetRecord[];
  onSyncCompleted: () => void;
}

export const SupabaseSyncPanel: React.FC<SupabaseSyncPanelProps> = ({
  records,
  onSyncCompleted
}) => {
  const [config, setConfig] = useState<SupabaseConfig>(loadSupabaseConfig());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; rowCount?: number } | null>(null);
  const [syncingRows, setSyncingRows] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [showSql, setShowSql] = useState<boolean>(false);

  // Supabase User Auth State (optional email/password login to Supabase project)
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [loggingIn, setLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    saveSupabaseConfig(config);
    // Check if active session exists
    const client = getSupabase(config);
    if (client) {
      client.auth.getUser().then(({ data }) => {
        if (data?.user) setSupabaseUser(data.user);
      }).catch(() => {});
    }
  }, [config]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(config);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error al conectar' });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncCurrentRecords = async () => {
    if (records.length === 0) return;
    setSyncingRows(true);
    setSyncResult(null);
    try {
      const rowsToSend = records.map(r => r.data);
      const res = await sendRowsToSupabase(rowsToSend, config, {
        sheetName: records[0]?.sourceSheet || 'Google Sheets',
        spreadsheetTitle: records[0]?.spreadsheetTitle
      });

      if (res.success) {
        setSyncResult({
          success: true,
          message: `¡Éxito! ${res.insertedCount} filas enviadas y sincronizadas en la tabla "${config.tableName}" de Supabase.`
        });
        onSyncCompleted();
      } else {
        setSyncResult({
          success: false,
          message: res.error || 'Error al enviar a Supabase'
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Error en la sincronización con Supabase'
      });
    } finally {
      setSyncingRows(false);
    }
  };

  const handleSupabaseAuth = async (mode: 'signin' | 'signup') => {
    const client = getSupabase(config);
    if (!client) {
      setAuthError('Ingresa primero la URL y la API Key de Supabase.');
      return;
    }
    setLoggingIn(true);
    setAuthError(null);
    try {
      if (mode === 'signin') {
        const { data, error } = await client.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setSupabaseUser(data.user);
      } else {
        const { data, error } = await client.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        setSupabaseUser(data.user);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error al autenticar en Supabase');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSupabaseSignOut = async () => {
    const client = getSupabase(config);
    if (client) {
      await client.auth.signOut();
      setSupabaseUser(null);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getSupabaseSqlScript(config.tableName));
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const isConfigured = Boolean(config.projectUrl && config.apiKey);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Integración & Base de Datos Supabase (PostgreSQL)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Conecta tu proyecto de Supabase para almacenar las filas extraídas de Google Sheets y alimentar tus dashboards en tiempo real
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={!isConfigured || testing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Comprobando...' : '🧪 Probar Conexión'}</span>
            </button>

            <button
              onClick={handleSyncCurrentRecords}
              disabled={!isConfigured || syncingRows || records.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{syncingRows ? 'Transmitiendo...' : `Enviar ${records.length} Filas a Supabase`}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            testResult.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {syncResult && (
          <div className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
            syncResult.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {syncResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncResult.message}</span>
          </div>
        )}

        {/* Configuration Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Supabase Project URL
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={config.projectUrl}
                onChange={(e) => setConfig({ ...config, projectUrl: e.target.value.trim() })}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Disponible en Settings &gt; API de tu proyecto Supabase</p>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Supabase Anon / Service API Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value.trim() })}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Clave anon (public) o service_role para escritura directa</p>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Nombre de la Tabla Destino
            </label>
            <div className="relative">
              <Database className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={config.tableName}
                onChange={(e) => setConfig({ ...config, tableName: e.target.value.trim() })}
                placeholder="sheet_records"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Tabla de PostgreSQL donde se insertarán las filas</p>
          </div>
        </div>

        {/* Automatic Forwarding Toggle */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 select-none">
            <input
              type="checkbox"
              checked={config.autoForward}
              onChange={(e) => setConfig({ ...config, autoForward: e.target.checked })}
              className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
            />
            <span>Reenviar automáticamente cada ingesta entrante hacia Supabase (Auto-Forward)</span>
          </label>

          <button
            onClick={() => setShowSql(!showSql)}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 underline"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showSql ? 'Ocultar Script SQL' : 'Ver Script SQL para crear tabla'}</span>
          </button>
        </div>
      </div>

      {/* Supabase User Login (Optional Email/Password) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-slate-700" />
              <span>Autenticación de Usuario en Supabase</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Si tu proyecto de Supabase tiene políticas de seguridad estrictas (RLS), puedes iniciar sesión con tu usuario
            </p>
          </div>

          {supabaseUser && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sesión Activa: {supabaseUser.email}</span>
              </span>
              <button
                onClick={handleSupabaseSignOut}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 underline"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        {!supabaseUser ? (
          <div className="space-y-3 text-xs max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email de Supabase</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Contraseña</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {authError && (
              <div className="text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded text-xs">
                {authError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleSupabaseAuth('signin')}
                disabled={loggingIn || !authEmail || !authPassword}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 text-xs"
              >
                {loggingIn ? 'Autenticando...' : 'Iniciar Sesión en Supabase'}
              </button>
              <button
                onClick={() => handleSupabaseAuth('signup')}
                disabled={loggingIn || !authEmail || !authPassword}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-40 text-xs"
              >
                Registrar Usuario
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-600">
            Usuario autenticado en Supabase. Las peticiones a la base de datos se ejecutan con el contexto del token de tu cuenta.
          </div>
        )}
      </div>

      {/* SQL Script Accordion */}
      {showSql && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-slate-300 font-semibold">
              schema_supabase_{config.tableName}.sql
            </span>
            <button
              onClick={handleCopySql}
              className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-mono transition-colors"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
            </button>
          </div>
          <pre className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
            <code>{getSupabaseSqlScript(config.tableName)}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
