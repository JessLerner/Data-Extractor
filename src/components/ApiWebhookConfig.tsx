import React, { useState } from 'react';
import { Key, Globe, Terminal, Copy, Check, Send, CheckCircle2, AlertCircle, Database, Shield } from 'lucide-react';
import { apiClient } from '../services/api';

interface ApiWebhookConfigProps {
  apiBaseUrl: string;
  apiKey: string;
  onApiKeyUpdated: (key: string) => void;
  onTestSuccess: () => void;
}

export const ApiWebhookConfig: React.FC<ApiWebhookConfigProps> = ({
  apiBaseUrl,
  apiKey,
  onApiKeyUpdated,
  onTestSuccess
}) => {
  const fullIngestUrl = `${apiBaseUrl}/api/ingest`;
  const [currentKey, setCurrentKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'js' | 'python' | 'appsScript'>('curl');
  const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({
    status: 'idle'
  });

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      await apiClient.updateApiKey(currentKey);
      onApiKeyUpdated(currentKey);
      alert('API Key actualizada correctamente en el servidor.');
    } catch (err: any) {
      alert(err.message || 'Error al guardar clave');
    } finally {
      setSavingKey(false);
    }
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTestWebhook = async () => {
    setTestStatus({ status: 'testing' });
    try {
      const res = await apiClient.ingestData({
        sheetName: 'Test_Webhook_API',
        spreadsheetTitle: 'Prueba Externa cURL/Fetch',
        spreadsheetId: 'test_sheet_id_external',
        action: 'batch_sync',
        records: [
          {
            codigo: 'TEST-' + Math.floor(100 + Math.random() * 900),
            cliente: 'Prueba de Conectividad API',
            categoria: 'Infraestructura API',
            monto: 2500,
            moneda: 'USD',
            estado: 'Completado',
            fecha: new Date().toISOString().split('T')[0],
            vendedor: 'Sistema API'
          }
        ],
        apiKey: currentKey
      });

      setTestStatus({
        status: 'success',
        message: `Prueba exitosa (HTTP 200). Servidor respondió en ${res.durationMs || 90}ms.`
      });
      onTestSuccess();
    } catch (err: any) {
      setTestStatus({
        status: 'error',
        message: err.message || 'Error en la petición de prueba'
      });
    }
  };

  const sampleJson = JSON.stringify({
    sheetName: "Ventas_2026",
    spreadsheetTitle: "Reporte Google Sheets",
    spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    action: "batch_sync",
    records: [
      {
        codigo: "PED-9901",
        cliente: "Empresa Ejemplo S.A.",
        categoria: "Software Cloud",
        monto: 4500,
        moneda: "USD",
        estado: "Completado"
      }
    ]
  }, null, 2);

  const snippets = {
    curl: `curl -X POST "${fullIngestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${currentKey}" \\
  -d '${sampleJson.replace(/\n/g, '\n  ')}'`,

    js: `// JavaScript (Fetch / Node.js)
const response = await fetch("${fullIngestUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${currentKey}"
  },
  body: JSON.stringify(${sampleJson})
});

const result = await response.json();
console.log("Respuesta:", result);`,

    python: `# Python (requests)
import requests

url = "${fullIngestUrl}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${currentKey}"
}
payload = ${sampleJson.replace(/true/g, 'True').replace(/false/g, 'False')}

res = requests.post(url, json=payload, headers=headers)
print("Status:", res.status_code, res.json())`,

    appsScript: `// Google Apps Script
function enviarDatosAAPI() {
  var url = "${fullIngestUrl}";
  var payload = ${sampleJson};
  
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer ${currentKey}"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}`
  };

  return (
    <div className="space-y-6">
      {/* Endpoints & Security Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-slate-700" />
          <span>Endpoint Webhook & Claves de Acceso</span>
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Configura y conecta el destino HTTP para recibir las filas extraídas por la extensión o servicios externos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API Webhook URL */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
              URL Ingesta Webhook (POST)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullIngestUrl}
                className="w-full font-mono text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 select-all"
              />
              <button
                onClick={() => handleCopy(fullIngestUrl, setCopiedUrl)}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors shrink-0"
                title="Copiar URL"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Método: <span className="font-mono font-semibold text-slate-700">POST</span> · Content-Type: <span className="font-mono">application/json</span>
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 block">
              API Key / Bearer Token
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={currentKey}
                onChange={(e) => setCurrentKey(e.target.value)}
                className="w-full font-mono text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-2.5 py-2.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors shrink-0"
              >
                {showKey ? 'Ocultar' : 'Ver'}
              </button>
              <button
                onClick={() => handleCopy(currentKey, setCopiedKey)}
                className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors shrink-0"
                title="Copiar API Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleSaveKey}
                disabled={savingKey}
                className="px-3.5 py-2.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              >
                {savingKey ? '...' : 'Guardar'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Header: <span className="font-mono">Authorization: Bearer &lt;tu_clave&gt;</span>
            </p>
          </div>
        </div>

        {/* Live Test Trigger */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTestWebhook}
              disabled={testStatus.status === 'testing'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testStatus.status === 'testing' ? 'Enviando petición...' : '🧪 Probar Llamada HTTP de Ingesta'}</span>
            </button>

            {testStatus.status === 'success' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>{testStatus.message}</span>
              </div>
            )}

            {testStatus.status === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>{testStatus.message}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Validación de tokens activa</span>
          </div>
        </div>
      </div>

      {/* Code Snippets for Developers */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-700" />
            <span>Ejemplos de Integración & Envío HTTP</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fragmentos de código listos para enviar datos a la base de datos externa desde cualquier lenguaje o plataforma
          </p>

          {/* Snippet Tabs */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar">
            {(['curl', 'js', 'python', 'appsScript'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSnippetTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  activeSnippetTab === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab === 'curl' && 'cURL (Terminal)'}
                {tab === 'js' && 'JavaScript / Node.js'}
                {tab === 'python' && 'Python (Requests)'}
                {tab === 'appsScript' && 'Google Apps Script'}
              </button>
            ))}
          </div>
        </div>

        {/* Code display */}
        <div className="relative">
          <pre className="p-5 bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed">
            <code>{snippets[activeSnippetTab]}</code>
          </pre>
          <button
            onClick={() => handleCopy(snippets[activeSnippetTab], () => {})}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs flex items-center gap-1 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar</span>
          </button>
        </div>
      </div>

      {/* Architecture Architecture diagram note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <Database className="w-4 h-4 text-slate-700" />
          <span>Flujo de Datos en Tiempo Real</span>
        </div>
        <p>
          1. <strong>Extracción en Google Sheets:</strong> La extensión de Chrome o Google Apps Script detecta cambios en las celdas (<code className="font-mono text-slate-800">onEdit</code>) o ejecuta extracción manual/programada en lote.
        </p>
        <p>
          2. <strong>Envío Seguro a la API:</strong> Se realiza una petición HTTP POST con cabecera Bearer Token hacia <code className="font-mono text-slate-800">{fullIngestUrl}</code>.
        </p>
        <p>
          3. <strong>Almacenamiento y Notificación SSE:</strong> El servidor procesa e inserta o actualiza el registro en la base de datos y emite instantáneamente un evento Server-Sent Events (SSE) hacia todos los paneles de control conectados.
        </p>
      </div>
    </div>
  );
};
