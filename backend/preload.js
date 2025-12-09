const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

function readConfigFile() {
    try {
        const cfgPath = path.join(__dirname, 'config', 'default.json');
        const txt = fs.readFileSync(cfgPath, 'utf8');
        return JSON.parse(txt);
    } catch (e) {
        console.error('readConfigFile error', e);
        return null;
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    launchExe: (p) => ipcRenderer.invoke('launch-exe', p),
    openUrl: (u) => ipcRenderer.invoke('open-url', u),
    systemAction: (action, options) => ipcRenderer.invoke('system-action', action, options),
    onVolumeChange: (cb) => ipcRenderer.on('volume-change', (e, delta) => cb(delta)),
    onVolumeMute: (cb) => ipcRenderer.on('volume-mute', () => cb()),
    readConfig: () => readConfigFile()
});