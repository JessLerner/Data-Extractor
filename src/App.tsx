/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MinimalSyncHub } from './components/MinimalSyncHub';
import { ApiWebhookConfig } from './components/ApiWebhookConfig';
import { apiClient, realtimeStream } from './services/api';
import { downloadExtensionZip } from './services/extensionBundle';
import { loadSupabaseConfig, sendRowsToSupabase } from './services/supabaseClient';
import { X } from 'lucide-react';

export default function App() {
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('sk_live_sheetstream_prod_99f2');
  const [notification, setNotification] = useState<{ title: string; subtitle: string } | null>(null);
  const [showApiModal, setShowApiModal] = useState<boolean>(false);

  // Dynamic API Base URL
  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  // Load API config
  useEffect(() => {
    apiClient.getConfig().then(cfg => {
      if (cfg?.apiKey) setApiKey(cfg.apiKey);
    }).catch(console.error);
  }, []);

  // Connect Real-Time SSE Stream for automatic live updates
  useEffect(() => {
    realtimeStream.connect();

    const unsubscribe = realtimeStream.subscribe((event, data) => {
      if (event === 'status_change') {
        setIsLiveConnected(data.connected);
      } else if (event === 'connected') {
        setIsLiveConnected(true);
      } else if (event === 'record_ingested') {
        setNotification({
          title: '⚡ Nueva Sincronización en Tiempo Real',
          subtitle: `${data.insertedCount || 1} fila(s) recibidas de [${data.sheetName}]`
        });
        setTimeout(() => setNotification(null), 4500);

        // Auto-forward to Supabase if configured
        const supConfig = loadSupabaseConfig();
        if (supConfig.autoForward && supConfig.projectUrl && supConfig.apiKey && data.records) {
          sendRowsToSupabase(data.records.map((r: any) => r.data || r), supConfig, {
            sheetName: data.sheetName,
            spreadsheetTitle: data.spreadsheetTitle
          }).catch(console.error);
        }
      }
    });

    return () => {
      unsubscribe();
      realtimeStream.cleanup();
    };
  }, []);

  // Download Chrome Extension ZIP handler
  const handleDownloadExtension = async () => {
    setIsDownloading(true);
    try {
      const zipBlob = await downloadExtensionZip(apiBaseUrl, apiKey);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sheetstream-extractor-v3.2.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar archivo ZIP:', err);
      alert('Error al generar el paquete de la extensión.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased">
      {/* Header */}
      <Header
        isLiveConnected={isLiveConnected}
        isGoogleConnected={isGoogleConnected}
        googleEmail={googleEmail}
        isSupabaseConnected={isSupabaseConnected}
        onDownloadExtension={handleDownloadExtension}
        isDownloading={isDownloading}
        onOpenApiDocs={() => setShowApiModal(true)}
      />

      {/* Interactive API Console & Documentation Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full my-8 p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Consola de API REST & Webhook en Vivo
                </h2>
                <p className="text-xs text-slate-500">
                  Integra esta aplicación como una API autónoma desde Python, cURL, Node.js, Zapier, Make o Google Apps Script.
                </p>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ApiWebhookConfig
              apiBaseUrl={apiBaseUrl}
              apiKey={apiKey}
              onApiKeyUpdated={(newKey) => setApiKey(newKey)}
              onTestSuccess={() => {}}
            />
          </div>
        </div>
      )}

      {/* Floating Real-Time Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <div>
            <div className="text-xs font-bold text-white">{notification.title}</div>
            <div className="text-[11px] text-slate-300">{notification.subtitle}</div>
          </div>
        </div>
      )}

      {/* Main Minimalist Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <MinimalSyncHub
          apiKey={apiKey}
          onDownloadExtension={handleDownloadExtension}
          isDownloading={isDownloading}
          onOpenApiDocs={() => setShowApiModal(true)}
          onGoogleStatusChange={(connected, email) => {
            setIsGoogleConnected(connected);
            setGoogleEmail(email || null);
          }}
          onSupabaseStatusChange={(connected) => {
            setIsSupabaseConnected(connected);
          }}
        />
      </main>

      {/* Quiet minimal footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>SheetStream · Extractor a Supabase en Tiempo Real</div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadExtension}
              className="hover:text-slate-700 transition-colors"
            >
              Descargar Extensión Chrome
            </button>
            <span aria-hidden="true">·</span>
            <span>Google Sheets (Solo Lectura) & CRM Web</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
