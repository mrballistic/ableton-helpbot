const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel, ...args) => {
        const validChannels = ['health-check', 'chat', 'initialize'];
        if (validChannels.includes(channel)) {
          return ipcRenderer.invoke(channel, ...args);
        }
        return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
      },
      on: (channel, func) => {
        const validChannels = ['initialization-progress', 'status-update'];
        if (validChannels.includes(channel)) {
          // Strip event as it includes `sender` and other internal electron stuff
          ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
      },
      removeListener: (channel, func) => {
        const validChannels = ['initialization-progress', 'status-update'];
        if (validChannels.includes(channel)) {
          ipcRenderer.removeListener(channel, func);
        }
      }
    }
  }
);
