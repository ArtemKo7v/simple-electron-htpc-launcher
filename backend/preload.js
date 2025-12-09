const { app, contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Detect if app is packaged
function detectPackagedFallback() {
    try {
        // 1) process.defaultApp true => dev
        if (process.defaultApp) return false;

        // 2) asar in path => packaged
        if (typeof __dirname === 'string' && __dirname.includes('.asar')) return true;

        // 3) execPath contains 'electron' => dev, otherwise packaged
        const exe = path.basename(process.execPath || '').toLowerCase();
        if (exe.includes('electron')) return false;

        // 4) resourcesPath heuristic (packaged apps usually have resources != cwd)
        try {
            if (process.resourcesPath && process.resourcesPath !== process.cwd()) {
                // if resourcesPath ends with 'app.asar' or 'resources' — likely packaged
                if (process.resourcesPath.includes('app.asar') || process.resourcesPath.toLowerCase().includes('\\resources')) {
                    return true;
                }
            }
        } catch (e) { }

        // default to packaged (safer)
        return true;
    } catch (e) {
        return true;
    }
}

let isPackaged = detectPackagedFallback();

// best-effort try to get app.isPackaged if available (may be undefined)
try {
    const electron = require('electron');
    // electron.app may be undefined in preload; also check remote if enabled
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.isPackaged === 'boolean') {
        isPackaged = app.isPackaged;
    }
} catch (e) {
    // ignore, we'll use fallback
}

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