import React from 'react';
import { Download, Chrome, Radio, CheckCircle2, ShieldCheck, Database, Terminal, Code2 } from 'lucide-react';

interface HeaderProps {
  isLiveConnected: boolean;
  isGoogleConnected: boolean;
  googleEmail?: string | null;
  isSupabaseConnected: boolean;
  onDownloadExtension: () => void;
  isDownloading?: boolean;
  onOpenApiDocs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isLiveConnected,
  isGoogleConnected,
  googleEmail,
  isSupabaseConnected,
  onDownloadExtension,
  isDownloading = false,
  onOpenApiDocs
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
            S
          </div>
          <div>
            <div className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>SheetStream</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                v3.2
              </span>
            </div>
            <div className="text-[11px] text-slate-500 hidden sm:block">
              Extractor Google Sheets & Web → Supabase
            </div>
          </div>
        </div>

        {/* Status Indicators & Action */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Connection Status Pills */}
          <div className="hidden md:flex items-center gap-3 text-xs">
            {/* Google Sheets Auth status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              isGoogleConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isGoogleConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="truncate max-w-[140px]">
                {isGoogleConnected ? (googleEmail || 'Google Conectado') : 'Google (Solo Lectura)'}
              </span>
            </div>

            {/* Supabase status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${
              isSupabaseConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <Database className="w-3 h-3" />
              <span>{isSupabaseConnected ? 'Supabase Activo' : 'Supabase Configurable'}</span>
            </div>

            {/* Real-time SSE status */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isLiveConnected ? 'En vivo' : 'Conectando'}</span>
            </div>
          </div>

          {/* API Docs Button */}
          {onOpenApiDocs && (
            <button
              onClick={onOpenApiDocs}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Abrir consola y documentación de API REST"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Consola API & Webhook</span>
              <span className="sm:hidden">API</span>
            </button>
          )}

          {/* Primary Action: Download Chrome Extension */}
          <button
            onClick={onDownloadExtension}
            disabled={isDownloading}
            className="px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Chrome className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isDownloading ? 'Generando...' : 'Descargar Extensión Chrome'}</span>
            <span className="sm:hidden">{isDownloading ? '...' : 'Extensión'}</span>
            <Download className="w-3 h-3 opacity-70" />
          </button>
        </div>

      </div>
    </header>
  );
};
