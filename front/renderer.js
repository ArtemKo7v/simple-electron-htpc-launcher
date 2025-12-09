// Renderer: loads config, renders tiles or carousel, handles actions.
const defaultConfig = {
    "theme": "dark",
    "buttonSize": 256,
    "display": "tiles",
    "menu": {
        "main": {
            "label": "Main Menu",
            "background": "#121212",
            "buttons": [
                { "id": "calc", "label": "Calculator" },
                { "id": "youtube", "label": "YouTube" },
                { "id": "system", "label": "System", "type": "submenu", "submenu": "system" }
            ]            
        },
        "system": {
            "label": "System Menu",
            "background": "#121212",
            "buttons": [
                { "id": "sleep", "label": "Sleep" },
                { "id": "restart", "label": "Restart" },
                { "id": "shutdown", "label": "Shutdown" },
                { "id": "exit", "label": "Exit" }
            ]
        }
    }
};

let cfg = defaultConfig;
function loadConfig() {
    return new Promise((resolve) => {
        try {
            const cfg = window.electronAPI.readConfig();
            if (cfg) return resolve(cfg);
            // fallback to default embedded config (existing defaultConfig)
            return resolve(defaultConfig);
        } catch (e) {
            console.error('loadConfig error', e);
            resolve(defaultConfig);
        }
    });
}

function applyTheme(t) {
    if (t.background) {
        document.body.style.background = t.background;
    }
    if (t.clockPosition === 'left') {
        document.getElementById('header').classList.add('justify-content-start');
    }
    document.documentElement.style.setProperty('--tile-size', (cfg.buttonSize || 256) + 'px');
}

let currentMenu = 'main';
function renderButtons() {
    const area = $('#buttons-area');
    area.empty();

    console.log(cfg);

    const menu = cfg.menu[currentMenu];
    if (cfg.display === 'tiles') {
        // todo
        menu.buttons.forEach(b => {
            const btn = $(`<div class="tile btn btn-light d-flex flex-column justify-content-center align-items-center m-2" style="width:${cfg.buttonSize}px; height:${cfg.buttonSize}px;"><span class="tile-label">${b.label}</span></div>`);
            btn.on('click', () => { onButtonClick(b); });
            area.append(btn);
        });
    } else if (cfg.display === 'carousel') {
        // todo
    }
}

function onButtonClick(b) {
    if (b.type === 'exe') {
        window.electronAPI.launchExe(b.exe);
    } else if (b.type === 'webview') {
        // open webview modal
        $('#yt-webview').attr('src', b.url);
        $('#webviewModal').removeClass('d-none');
    } else if (b.type === 'submenu') {
        // render submenu buttons replacing main buttons area (store a history)
        const prev = cfg;
        cfg = {
            display: cfg.display,
            buttonSize: cfg.buttonSize,
            buttons: b.buttons,
            theme: cfg.theme
        };
        renderButtons();
        // add back button
        const back = $('<button class="btn btn-sm btn-secondary mt-2">Back</button>');
        back.on('click', () => { cfg = prev; renderButtons(); });
        $('#buttons-area').append(back);
    } else if (b.type === 'system') {
        // call system action
        window.electronAPI.systemAction(b.action, { kiosk: location.search.includes('kiosk') });
    }
}

// clock
function startClock() {
    setInterval(() => {
        const d = new Date();
        $('#clock').text(d.toLocaleTimeString());
    }, 500);
}

// Startup
$(function () {
    loadConfig().then(c => {
        cfg = Object.assign({}, defaultConfig, c);
        applyTheme(c.theme || {});
        renderButtons();
        startClock();
    });

    $('#webview-close').on('click', () => {
        $('#webview').attr('src', '');
        $('#webviewModal').addClass('d-none');
    });

    // volume control from main
    window.electronAPI.onVolumeChange((delta) => {
        // Try adjust <audio> elements or use system mixer via native modules; here we emit a custom event for pages
        $(document).trigger('volume-adjust', [delta]);
    });
    window.electronAPI.onVolumeMute(() => {
        $(document).trigger('volume-mute');
    });
});
