// Renderer: loads config, renders tiles or carousel, handles actions.
const defaultConfig = {
    "theme": "default",
    "buttonSize": 256,
    "display": "tiles",
    "menu": {
        "main": {
            "label": "Main Menu",
            "backgroundColor": "#121212",
            "buttons": [
                { "id": "calc", "label": "Calculator" },
                { "id": "youtube", "label": "YouTube" },
                { "id": "system", "label": "System", "type": "submenu", "submenu": "system" }
            ]            
        },
        "system": {
            "label": "System Menu",
            "backgroundColor": "#121212",
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

function loadTheme(themeName) {
    const defaultTheme = {};
    return new Promise((resolve) => {
        try {
            const themeCfg = window.electronAPI.loadTheme(themeName);
            if (themeCfg) return resolve(themeCfg);
            return resolve(defaultTheme);
        } catch (e) {
            console.error('loadTheme error', e);
            resolve(defaultTheme);
        }
    });
}

function applyTheme(t) {
    if (t.background) {
        document.body.style.background = t.background;
    }
    if (t.backgroundColor) {
        document.body.style.backgroundColor = t.backgroundColor;
    }
    if (t.backgroundImage) {
        document.body.style.backgroundImage = `url(../themes/${cfg.theme}/${t.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'top-center';
        document.body.style.backgroundRepeat = 'no-repeat';
    }
    if (t.textColor) {
        document.body.style.color = t.textColor;
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

    const menu = cfg.menu[currentMenu];

    const style = cfg.buttonStyle || 'tile';

    menu.buttons.forEach(b => {
        let btn;
  
        if (style === 'avatar') {
            btn = $(`<div class="avatar-wrap">
                       <div class="avatar"></div>
                       <div class="avatar-label">${b.label}</div>
                     </div>`);

            if (b.image) {
                btn.find('.avatar').css('background-image', `url(../themes/${cfg.theme}/${b.image})`);
            }
            btn.find('.avatar').on('click', () => onButtonClick(b));
        } else {
            btn = $(`<div class="tile btn btn-light d-flex flex-column
                       justify-content-center align-items-center m-2"
                       style="width:${cfg.buttonSize}px;height:${cfg.buttonSize}px;">
                       <span class="tile-label">${b.label}</span>
                     </div>`);
            btn.on('click', () => onButtonClick(b));
        }
        area.append(btn);
    });
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
        const prev = currentMenu;
        currentMenu = b.submenu;
        renderButtons();
        // add back button
        const back = $('<button class="btn btn-sm btn-secondary mt-2">Back</button>');
        back.on('click', () => { currentMenu = prev; renderButtons(); });
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

let isMuted = false;

// Startup
$(function () {
    loadConfig().then(c => {
        cfg = Object.assign({}, defaultConfig, c);
        console.log('Loaded config:', cfg);
        loadTheme(cfg.theme).then(t => {
            Object.assign(cfg, t);
            console.log('Applied theme:', t);
            applyTheme(t);
            renderButtons();
            startClock();
        });
    });

    $('#webview-close').on('click', () => {
        $('#webview').attr('src', '');
        $('#webviewModal').addClass('d-none');
    });

    // Volume control
    window.electronAPI.onVolumeChange(async (delta) => {
        console.log('Volume change requested:', delta);
        let res = null;
        if (delta > 0) {
            res = await window.audioAPI.volumeUp(delta / 100);           
        } else {
            res = await window.audioAPI.volumeDown(-delta / 100);
        }
        console.log('Volume change result:', res);
    });

    // Mute toggle
    window.electronAPI.onVolumeMute(async () => {
        isMuted = !isMuted;
        console.log('Volume mute requested');
        const res = await window.audioAPI.mute(isMuted);
        console.log('Muted:', res);
    });
});
