import React, { useState } from 'react';
import { Download, Copy, Check, Chrome, Code2, BookOpen, Layers, Terminal, ExternalLink } from 'lucide-react';
import { getExtensionSources, downloadExtensionZip, ExtensionFiles } from '../services/extensionBundle';

interface ExtensionHubProps {
  apiBaseUrl: string;
  apiKey: string;
  onDownload: () => void;
  isDownloading: boolean;
}

export const ExtensionHub: React.FC<ExtensionHubProps> = ({
  apiBaseUrl,
  apiKey,
  onDownload,
  isDownloading
}) => {
  const sources = getExtensionSources(apiBaseUrl, apiKey);
  const fileKeys: Array<keyof ExtensionFiles> = [
    'manifest.json',
    'popup.html',
    'popup.js',
    'content.js',
    'background.js',
    'README.md'
  ];

  const [activeFile, setActiveFile] = useState<keyof ExtensionFiles>('manifest.json');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sources[activeFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-slate-900 text-white">
                <Chrome className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Suite de Extensión de Google & Apps Script
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Descarga el paquete completo de la <strong>Extensión para Google Chrome (Manifest V3)</strong> o utiliza el código de <strong>Google Apps Script</strong> para extraer datos de cualquier planilla Google Sheets y transmitirlos automáticamente a tu base de datos externa mediante la API REST.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Generando ZIP...' : 'Descargar Extensión (.ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Two Column: Installation Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Method 1: Chrome Extension */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <Chrome className="w-4 h-4 text-slate-800" />
            <h3 className="text-sm font-bold text-slate-900">
              Método 1: Extensión de Google Chrome (Manifest V3)
            </h3>
          </div>

          <ol className="text-xs text-slate-600 space-y-2.5 pl-4 list-decimal marker:font-semibold marker:text-slate-900">
            <li>
              Haz clic en <strong>Descargar Extensión (.ZIP)</strong> y descomprime la carpeta en tu disco.
            </li>
            <li>
              Abre el navegador Chrome e ingresa a: <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">chrome://extensions/</code>
            </li>
            <li>
              Activa la casilla <strong>Modo de desarrollador</strong> en la esquina superior derecha.
            </li>
            <li>
              Presiona el botón <strong>Cargar descomprimida</strong> y selecciona la carpeta descomprimida.
            </li>
            <li>
              Abre tu planilla en <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Google Sheets</a> y haz clic en el icono de SheetStream en tu barra de extensiones para sincronizar o activar auto-sync.
            </li>
          </ol>
        </div>

        {/* Method 2: Google Apps Script */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <Code2 className="w-4 h-4 text-slate-800" />
            <h3 className="text-sm font-bold text-slate-900">
              Método 2: Google Sheets Apps Script (Nativo en la Nube 24/7)
            </h3>
          </div>

          <ol className="text-xs text-slate-600 space-y-2.5 pl-4 list-decimal marker:font-semibold marker:text-slate-900">
            <li>
              Abre tu planilla en Google Sheets y ve al menú: <strong>Extensiones &gt; Apps Script</strong>.
            </li>
            <li>
              Copia el código del archivo <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">Code.gs</code> (pestaña inferior).
            </li>
            <li>
              Pégalo en el editor de Apps Script reemplazando el código existente y guarda (<kbd className="bg-slate-100 px-1 rounded">Ctrl+S</kbd>).
            </li>
            <li>
              Haz clic en <strong>Ejecutar &gt; onOpen</strong> una sola vez para conceder permisos.
            </li>
            <li>
              ¡Listo! Cada edición (<code className="font-mono text-emerald-700">onEdit</code>) o el menú personalizado enviará las filas en tiempo real a tu API.
            </li>
          </ol>
        </div>
      </div>

      {/* Code Browser & Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* File Tabs */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5">
            {fileKeys.map(file => (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                  activeFile === file
                    ? 'bg-slate-800 text-white font-medium border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {file}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors shrink-0 border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="relative">
          <pre className="p-5 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[500px] leading-relaxed">
            <code>{sources[activeFile]}</code>
          </pre>
        </div>

        {/* File info footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Archivo: {activeFile}</span>
          <span>{sources[activeFile].split('\n').length} líneas</span>
        </div>
      </div>
    </div>
  );
};
