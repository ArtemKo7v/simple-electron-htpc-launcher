const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const SoundMixer = require('native-sound-mixer');
const { DeviceType } = require('native-sound-mixer');

const path = require('path');
const { exec } = require('child_process');
const isKiosk = process.argv.includes('--kiosk');
const isDebug = process.argv.includes('--debugTools');

let win;
function createWindow() {
    win = new BrowserWindow({
        // width: 1280,
        // height: 720,
        kiosk: isKiosk,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });
    win.loadFile('front/index.html');
    // Debugging
    if (isDebug) {
        console.log('Opening DevTools in undocked mode');
        win.webContents.openDevTools({ mode: 'undocked' });
    }
}

app.whenReady().then(() => {
    createWindow();

    // Register media keys in kiosk mode
    try {
        globalShortcut.register('VolumeUp', () => { win.webContents.send('volume-change', +5); });
        globalShortcut.register('VolumeDown', () => { win.webContents.send('volume-change', -5); });
        globalShortcut.register('VolumeMute', () => { win.webContents.send('volume-mute'); });
    } catch (e) {
        console.warn('globalShortcut registration failed', e);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// helper: get default audio output device
function getDefaultAudioDevice() {
    try {
        console.log('Available audio devices:', SoundMixer.default.devices);
        console.log('Default audio device:', SoundMixer.default.getDefaultDevice(DeviceType.RENDER));
        console.log('First audio device:', SoundMixer.default.devices[0]);
        return SoundMixer.default.getDefaultDevice(DeviceType.RENDER) || SoundMixer.default.devices[0];
    } catch (e) {
        console.error('Error getting default device:', e);
        return undefined;
    }
}

function clamp(v, min = 0, max = 1) {
    if (typeof v !== 'number' || Number.isNaN(v)) return min;
    return Math.max(min, Math.min(max, v));
}

// IPC actions from renderer:
ipcMain.handle('launch-exe', (e, exePath) => {
    if (process.platform === 'win32') {
        exec(`start "" "${exePath}"`);
        return true;
    } else {
        exec(`"${exePath}"`, () => { });
        return true;
    }
});

ipcMain.handle('open-url', (e, url) => {
    // open in external browser or let renderer load in webview; use shell as fallback
    shell.openExternal(url);
    return true;
});

ipcMain.handle('system-action', (e, action, options) => {
    // options: {kiosk}
    if (process.platform !== 'win32') return false;
    if (action === 'shutdown') {
        exec('shutdown /s /t 0');
    } else if (action === 'restart') {
        exec('shutdown /r /t 0');
    } else if (action === 'sleep') {
        // try SetSuspendState; may require privileges
        exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
    } else if (action === 'exit') {
        if (options && options.kiosk) {
            // restore explorer before quitting
            exec('start "" explorer.exe', () => { app.quit(); });
        } else {
            app.quit();
        }
    }
    return true;
});

ipcMain.handle('audio:mute', async (event, isMute) => {
    const device = getDefaultAudioDevice();
    if (!device) throw new Error('No audio device found');
    // device.mute is read/write (boolean)
    device.mute = !!isMute;
    return { name: device.name, mute: device.mute };
});

ipcMain.handle('audio:volumeUp', async (event, delta = 0.05) => {
    const device = getDefaultAudioDevice();
    if (!device) throw new Error('No audio device found');
    // device.volume is a VolumeScalar in [0,1]
    const curr = typeof device.volume === 'number' ? device.volume : 0;
    const next = clamp(curr + Number(delta));
    device.volume = next;
    return { name: device.name, volume: device.volume };
});

ipcMain.handle('audio:volumeDown', async (event, delta = 0.05) => {
    const device = getDefaultAudioDevice();
    if (!device) throw new Error('No audio device found');
    const curr = typeof device.volume === 'number' ? device.volume : 0;
    const next = clamp(curr - Number(delta));
    device.volume = next;
    return { name: device.name, volume: device.volume };
});    
