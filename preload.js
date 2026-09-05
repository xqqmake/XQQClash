const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (content, defaultName) => ipcRenderer.invoke('save-file', content, defaultName),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  fetchUrl: (url) => ipcRenderer.invoke('fetch-url', url),
  syncConfig: (cfg) => ipcRenderer.invoke('sync-config', cfg),
  startServer: (port) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  serverStatus: () => ipcRenderer.invoke('server-status'),
  saveState: (data) => ipcRenderer.invoke('save-state', data),
  loadState: () => ipcRenderer.invoke('load-state'),
  isElectron: true
});
