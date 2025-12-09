const { app, contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Check if app is packaged to .exe
const isPackaged = app.isPackaged;

function readConfigFile() {
    const exeDir = path.dirname(process.execPath);
    const bundledDir = __dirname;

    const candidates = isPackaged ? [
        path.join(exeDir, 'config', 'config.json'),
        path.join(exeDir, 'config.json'),
    ] : [
        path.join(bundledDir, '..', 'config', 'config.json'),
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const cfg = tryReadJson(p);
            if (cfg) {
                return cfg;
            }
        }
    }
    console.warn('No readable config found');
    return null;
}

function tryReadJson(filePath) {
    try {
        const txt = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(txt);
    } catch (e) {
        console.error('tryReadJson error', e);
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