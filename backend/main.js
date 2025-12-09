const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const isKiosk = process.argv.includes('--kiosk');
const isDebug = process.argv.includes('--debugTools');

let win;
function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 720,
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
