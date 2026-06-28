import { schwimmerNummerErfragen, showStatusMessage } from './mymodals.js'

const schwimmerNrLength = parseInt("{{schwimmerNrLen}}");
const maxBahnen = parseInt("{{maxBahnen}}");
const TIMER_DAUER_MS = 5000; // ms bis automatisches Senden nach Klick
const fadeTime = parseInt("{{fadeTime}}") || 0; // Sekunden bis Schwimmer auf Bahn 0 gesetzt wird (0 = deaktiviert)
const DEBUG = false;

function logMessage(text, isSuccess = true) {
    statMessages.push({ message: text, success: isSuccess, timestamp: new Date().toISOString() });
}

let formIsDirty = false;
window.addEventListener('beforeunload', function (event) {
    if (formIsDirty || pendingTimers.size > 0) {
        event.preventDefault();
        return "Es gibt ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?";
    }
});

let verwaltete_bahnen = [0];
const aktiveBahnen = new Set();

let schwimmer = [];
let actions = [];
let statMessages = [];
let alleSchwimmer = {};

// Ausstehende Aktionen: nummer → { timerId, clickTimestamp }
const pendingTimers = new Map();

let longPressTimer;

document.getElementById('schwimmerHinzufuegen').addEventListener('click', promptSchwimmerHinzufuegen);
document.getElementById('downloadJsonBtn').addEventListener('click', downloadJSON);

async function promptSchwimmerHinzufuegen() {
    const nummer = await schwimmerNummerErfragen(schwimmerNrLength);
    if (nummer == null) return;
    if (!(nummer.trim() !== "" && !isNaN(nummer))) {
        showStatusMessage("Ungültige Schwimmernummer", false);
        return;
    }
    schwimmerHinzufuegen(nummer);
}

function schwimmerHinzufuegen(nummer) {
    const aktiver = schwimmer.find(s => s.nummer == nummer);
    if (!aktiver) {
        fetchSchwimmer(nummer);
        const bekannter = alleSchwimmer[parseInt(nummer)] ?? null;
        if (bekannter) {
            schwimmer.push({
                nummer: parseInt(nummer),
                vorname: bekannter.vorname,
                nachname: bekannter.nachname,
                bahnen: bekannter.bahnanzahl,
                aktiv: true,
                aufBahn: (!bekannter.auf_bahn || !(bekannter.auf_bahn in verwaltete_bahnen))
                    ? verwaltete_bahnen[0] : bekannter.auf_bahn,
                prio: 0,
            });
            actions.push({
                kommando: "ACT",
                parameter: [nummer, 1],
                timestamp: new Date().toISOString(),
                transmitted: false
            });
        } else {
            schwimmer.push({
                nummer: parseInt(nummer),
                vorname: `Schwimmer ${nummer}`,
                nachname: '',
                bahnen: 0,
                aufBahn: verwaltete_bahnen[0],
                aktiv: 1,
                prio: 0,
            });
        }
    }
    render();
}

function fillSchwimmerAusMeinenBahnen() {
    Object.values(alleSchwimmer)
        .filter(s => verwaltete_bahnen.includes(s.auf_bahn) && s.aktiv == 1)
        .forEach(s_neu => {
            if (!schwimmer.some(s => s.nummer == s_neu.nummer)) {
                schwimmer.push({
                    nummer: parseInt(s_neu.nummer),
                    vorname: s_neu.vorname,
                    nachname: s_neu.nachname,
                    bahnen: s_neu.bahnanzahl,
                    aktiv: true,
                    aufBahn: s_neu.auf_bahn,
                    prio: 0,
                });
            }
        });
}

function toggleInfoBar() {
    const infoBar = document.getElementById("infoBar");
    infoBar.style.display = (infoBar.style.display === "none" || infoBar.style.display === "") ? "flex" : "none";
}

function downloadJSON() {
    const data = { "schwimmer": schwimmer, "alleSchwimmer": alleSchwimmer, "actions": actions, "statMessages": statMessages };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "24hschwimmen.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function entferneFremdbahnen() {
    let index = schwimmer.findIndex(s => !verwaltete_bahnen.includes(s.aufBahn));
    while (index !== -1) {
        const div = document.querySelector(`div[data-nummer="${schwimmer[index].nummer}"]`);
        removeSchwimmerDiv(div, false, false);
        index = schwimmer.findIndex(s => !verwaltete_bahnen.includes(s.aufBahn));
    }
    render();
    contextMenu.style.display = "none";
}

function initBahnButtons() {
    const container = document.getElementById("bahnButtons");
    for (let i = 1; i <= maxBahnen; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.dataset.bahn = i;
        btn.addEventListener("click", () => toggleBahn(i));
        container.appendChild(btn);
    }

    const broomBtn = document.createElement("button");
    broomBtn.id = "nurEigeneBtn";
    broomBtn.title = "Fremdbahnen entfernen";
    broomBtn.innerHTML = '<i class="fa-solid fa-broom"></i>';
    broomBtn.style.cssText = [
        "display: none",
        "width: 36px", "height: 36px", "border-radius: 50%",
        "border: 2px solid rgba(255,200,80,0.7)",
        "background: rgba(255,200,80,0.2)",
        "color: rgba(255,200,80,1)",
        "cursor: pointer", "font-size: 15px", "padding: 0", "line-height: 1",
        "margin-left: 8px",
        "transition: background 0.15s"
    ].join(";");
    broomBtn.addEventListener("click", entferneFremdbahnen);
    container.appendChild(broomBtn);

    // Bahn 1 als Standardauswahl
    aktiveBahnen.add(1);
    verwaltete_bahnen = [1];
    updateBahnButtonStyles();
}

function updateBahnButtonStyles() {
    document.querySelectorAll("#bahnButtons button").forEach(btn => {
        btn.classList.toggle("bahn-aktiv", aktiveBahnen.has(parseInt(btn.dataset.bahn)));
    });
}

function toggleBahn(bahn) {
    if (aktiveBahnen.has(bahn)) {
        aktiveBahnen.delete(bahn);
    } else {
        aktiveBahnen.add(bahn);
    }
    verwaltete_bahnen = aktiveBahnen.size > 0 ? [...aktiveBahnen].sort((a, b) => a - b) : [0];
    updateBahnButtonStyles();
    fetchSchwimmerVonBahnen();
    fillSchwimmerAusMeinenBahnen();
    render();
}

const contextMenu = document.getElementById("contextMenu");
let clickedDiv = null;
const container = document.getElementById('container');

// Nach TIMER_DAUER_MS automatisch senden
function autoSenden(nummer, clickTimestamp, betrag = 1, kommentar = null) {
    pendingTimers.delete(nummer);
    const s_data = schwimmer.find(s => s.nummer == nummer);
    if (s_data) {
        if (!s_data.aufBahn || !verwaltete_bahnen.includes(s_data.aufBahn)) {
            s_data.aufBahn = verwaltete_bahnen[0];
        }
        s_data.bahnen = Math.max(s_data.bahnen, alleSchwimmer[nummer] ? alleSchwimmer[nummer].bahnanzahl : 0);
        s_data.bahnen = Math.max(0, s_data.bahnen + betrag);
        const parameter = [nummer, betrag, s_data.aufBahn];
        if (kommentar) parameter.push(kommentar);
        actions.push({ kommando: "ADD", parameter, timestamp: clickTimestamp, transmitted: false });
        updateFormIsDirty(true);
        transmitActions();
    }
    render();
}

// Klick auf Schwimmer-Div: Timer starten oder abbrechen
container.addEventListener('click', (event) => {
    const clicked_schwimmer = event.target.closest('.schwimmer');
    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) return;

    const nummer = parseInt(clicked_schwimmer.dataset.nummer);

    if (pendingTimers.has(nummer)) {
        // Abbrechen
        clearTimeout(pendingTimers.get(nummer).timerId);
        pendingTimers.delete(nummer);
    } else {
        // Timer starten, Inaktivitätszähler zurücksetzen
        const s_data = schwimmer.find(s => s.nummer === nummer);
        if (s_data) s_data.prio = 0;
        const clickTimestamp = new Date().toISOString();
        const timerId = setTimeout(() => autoSenden(nummer, clickTimestamp), TIMER_DAUER_MS);
        pendingTimers.set(nummer, { timerId, clickTimestamp });
    }
    render();
});

container.addEventListener('contextmenu', function (event) {
    const clicked_schwimmer = event.target.closest('.schwimmer');
    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) return;
    event.preventDefault();
    clickedDiv = clicked_schwimmer;
    showSchwimmerContextMenu(event.pageX, event.pageY);
});

document.addEventListener("click", function (e) {
    if (!contextMenu.contains(e.target)) contextMenu.style.display = "none";
});
document.addEventListener("contextmenu", function (e) {
    const clicked_schwimmer = e.target.closest('.schwimmer');
    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) contextMenu.style.display = "none";
});

function showSchwimmerContextMenu(x, y) {
    const s_data = schwimmer.find(s => s.nummer == parseInt(clickedDiv.dataset.nummer));
    const hatBahnen = s_data && s_data.bahnen > 0;
    document.getElementById("rundeAbziehenOption").style.display = hatBahnen ? "block" : "none";
    document.getElementById("bahnanzahlReset").style.display = hatBahnen ? "block" : "none";
    contextMenu.style.display = "block";
    contextMenu.style.top = "0px";
    contextMenu.style.left = "0px";
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const posX = (x + menuWidth > window.innerWidth) ? window.innerWidth - menuWidth - 5 : x;
    const posY = (y + menuHeight > window.innerHeight) ? window.innerHeight - menuHeight - 5 : y;
    contextMenu.style.left = `${Math.max(posX, 0)}px`;
    contextMenu.style.top = `${Math.max(posY, 0)}px`;
}

function addSwipeHandler(div) {
    let startX = 0;
    let startY = 0;
    let swipedleft = false;
    let direction = null; // 'horizontal' | 'vertical' | null
    const threshold = 70;
    const dirThreshold = 10; // Pixel bis zur Richtungsentscheidung

    function resetDiv() {
        div.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
        div.style.transform = 'translateX(0)';
        div.style.backgroundColor = '';
        div.style.zIndex = '';
    }

    div.addEventListener('touchstart', e => {
        longPressTimer = setTimeout(() => {
            showSchwimmerContextMenu(e.touches[0].clientX, e.touches[0].clientY);
        }, 600);
        swipedleft = false;
        direction = null;
        div.dataset.swiping = "true";
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        div.style.zIndex = '1000';
        div.style.transition = 'none';
    }, { passive: false });

    div.addEventListener('touchmove', e => {
        clearTimeout(longPressTimer);
        if (div.dataset.swiping != "true") return;

        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;

        // Richtung einmalig festlegen sobald genug Bewegung vorhanden
        if (direction === null && (Math.abs(deltaX) > dirThreshold || Math.abs(deltaY) > dirThreshold)) {
            direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
        }

        // Vertikal oder noch unklar: Scroll freigeben, nichts tun
        if (direction !== 'horizontal') {
            resetDiv();
            return;
        }

        // Horizontal: Scroll sperren
        e.preventDefault();

        // Rechts: keine Aktion, kein visuelles Feedback
        if (deltaX > 0) {
            div.style.transform = 'translateX(0)';
            div.style.backgroundColor = '';
            swipedleft = false;
            return;
        }

        // Links: Schwimmer entfernen-Geste
        const clamped = Math.max(-220, deltaX);
        div.style.transform = `translateX(${clamped}px)`;
        if (clamped < -threshold) {
            div.style.backgroundColor = '#ef9a9a';
            swipedleft = true;
        } else {
            div.style.backgroundColor = '';
            swipedleft = false;
        }
    }, { passive: false });

    div.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (div.dataset.swiping != "true") return;
        delete div.dataset.swiping;
        if (swipedleft) {
            swipedleft = false;
            div.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
            div.style.transform = 'translateX(-130%)';
            div.style.opacity = '0';
            setTimeout(() => removeSchwimmerDiv(div), 260);
        } else {
            resetDiv();
        }
    });
}

function removeSchwimmerDiv(div, setinactive = true, dorender = true) {
    div.style.opacity = 0;
    const nummer = parseInt(div.dataset.nummer);
    if (pendingTimers.has(nummer)) {
        clearTimeout(pendingTimers.get(nummer).timerId);
        pendingTimers.delete(nummer);
    }
    const index = schwimmer.findIndex(s => parseInt(s.nummer) == nummer);
    if (index !== -1) {
        const entfernterSchwimmer = schwimmer[index];
        schwimmer.splice(index, 1);
        if (alleSchwimmer[entfernterSchwimmer.nummer]) {
            alleSchwimmer[entfernterSchwimmer.nummer].bahnanzahl = Math.max(
                alleSchwimmer[entfernterSchwimmer.nummer].bahnanzahl,
                entfernterSchwimmer.bahnen
            );
        }
        if (setinactive) {
            if (alleSchwimmer[entfernterSchwimmer.nummer]) alleSchwimmer[entfernterSchwimmer.nummer].aktiv = 0;
            actions.push({
                kommando: "ACT",
                parameter: [entfernterSchwimmer.nummer, 0],
                timestamp: new Date().toISOString(),
                transmitted: false
            });
            updateFormIsDirty(true);
            transmitActions();
        }
    }
    if (dorender) render();
}

function render() {
    const container = document.getElementById("container");
    const firstRects = new Map();
    const existingDivs = new Map();
    container.querySelectorAll(".schwimmer").forEach(div => {
        firstRects.set(div.dataset.nummer, div.getBoundingClientRect());
        existingDivs.set(Number(div.dataset.nummer), div);
    });

    // Immer nach Nummer aufsteigend (absteigende Vorsortierung + insertBefore = aufsteigend im DOM)
    const sortedSchwimmer = [...schwimmer].sort((a, b) => b.nummer - a.nummer);
    const aktuelleSNummern = new Set(sortedSchwimmer.map(s => s.nummer));

    existingDivs.forEach((div, nummer) => {
        if (!aktuelleSNummern.has(nummer)) {
            div.classList.add("fade-out");
            div.style.transition = "opacity 300ms, transform 300ms";
            div.style.opacity = 0;
            div.style.transform = "scale(0.9)";
            setTimeout(() => div.remove(), 300);
        }
    });

    sortedSchwimmer.forEach((s) => {
        let div = existingDivs.get(s.nummer);
        if (!div) {
            div = document.createElement("div");
            div.className = "schwimmer";
            div.dataset.nummer = s.nummer;
            container.appendChild(div);
            addSwipeHandler(div);
        }

        if (div.dataset.swiping !== "true") {
            const snummer = schwimmerNrLength > 0 ? String(s.nummer).padStart(schwimmerNrLength, '0') : s.nummer;
            div.innerHTML = `
                <div class="nummer">${snummer}</div>
                <div class="info">
                    <span class="name">${s.vorname}</span>
                    <span class="bahnen">(${s.bahnen})</span>
                    ${DEBUG ? `<span style="font-size:0.7em;color:#555">Prio: ${Math.round(s.prio ?? 0)}</span>` : ""}
                </div>
            `;

            if (pendingTimers.has(s.nummer)) {
                const pending = pendingTimers.get(s.nummer);
                if (pending.type === 'reset') {
                    div.classList.remove('selected');
                    div.style.backgroundColor = "#e53935";
                } else {
                    div.classList.add('selected');
                    div.style.removeProperty("background-color");
                }
            } else if (fadeTime > 0 && (s.prio ?? 0) >= fadeTime) {
                div.classList.remove('selected');
                div.style.backgroundColor = "#c8c8c8";
            } else if (!verwaltete_bahnen.includes(s.aufBahn)) {
                div.classList.remove('selected');
                div.style.backgroundColor = "#b8d4ea";
            } else {
                div.classList.remove('selected');
                div.style.removeProperty("background-color");
            }
        }

        container.insertBefore(div, container.firstChild);
    });

    const broomBtn = document.getElementById("nurEigeneBtn");
    if (broomBtn) {
        broomBtn.style.display = schwimmer.some(s => !verwaltete_bahnen.includes(s.aufBahn)) ? "inline-block" : "none";
    }

    container.querySelectorAll(".schwimmer").forEach(div => {
        const nummer = div.dataset.nummer;
        const first = firstRects.get(nummer);
        const last = div.getBoundingClientRect();
        if (first && !div.classList.contains("fade-out")) {
            const dx = first.left - last.left;
            const dy = first.top - last.top;
            if (dx !== 0 || dy !== 0) {
                div.animate([
                    { transform: `translate(${dx}px, ${dy}px)` },
                    { transform: 'translate(0, 0)' }
                ], { duration: 300, easing: 'ease' });
            }
        }
    });
}

// **********************************************************
//  DATENAUSTAUSCH mit dem Server
// **********************************************************
let isFetching = false;
let server_verbunden = true;

async function transmitActions() {
    if (isFetching) return;
    const pending = actions.filter(a => !a.transmitted);
    if (pending.length === 0) return;
    try {
        isFetching = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            pending.forEach(a => a.transmitted = true);
            const resp = await response.json();
            if (resp["updates"]) parseUpdates(resp);
            if (resp["results"]) showResultErrors(resp["results"]);
            updateFormIsDirty(false);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log("Error on transmit", error);
        updateServerStatus(false);
    } finally {
        isFetching = false;
    }
}

function redrawStatusBar() {
    const statusspan = document.getElementById('serverStatus');
    if (server_verbunden) {
        statusspan.innerHTML = `
            <span style="height: 10px; width: 10px; background-color: ${formIsDirty ? 'yellow' : 'green'}; border-radius: 50%; display: inline-block; margin-right: 5px"></span>
            Verbunden`;
    } else {
        statusspan.innerHTML = `
            <span style="height: 10px; width: 10px; background-color: red; border-radius: 50%; display: inline-block; margin-right: 5px"></span>
            Nicht Verbunden`;
    }
}

function updateServerStatus(neu) {
    if (server_verbunden != neu) {
        server_verbunden = neu;
        logMessage(neu ? "Server wieder verbunden" : "Serververbindung verloren", neu);
        showStatusMessage(neu ? "Server wieder verbunden" : "Serververbindung verloren", neu);
        redrawStatusBar();
    }
}

function updateFormIsDirty(neu) {
    if (formIsDirty != neu) {
        formIsDirty = neu;
        redrawStatusBar();
    }
}

async function fetchSchwimmer(id = -1) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "GET", 'parameter': id == -1 ? [] : [id], 'timestamp': new Date().toISOString() }]),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const resp = await response.json();
            if (resp["updates"]) parseUpdates(resp);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log(`Error on fetchSchwimmer mit ID ${id}`, error);
        updateServerStatus(false);
    }
}

async function fetchSchwimmerVonBahnen() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "GETB", 'parameter': verwaltete_bahnen, 'timestamp': new Date().toISOString() }]),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
            const resp = await response.json();
            if (resp["updates"]) parseUpdates(resp);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log(`Error on fetchSchwimmerVonBahnen (${verwaltete_bahnen}):`, error);
        updateServerStatus(false);
    }
}

function showResultErrors(results) {
    const errors = results.filter(r => r.status !== "erfolgreich" && r.status !== "existierte bereits");
    if (errors.length === 0) return;
    showStatusMessage(
        errors.map(r => `${r.nummer != null ? `Schwimmer ${r.nummer}: ` : ''}${r.status}`).join('\n'),
        false, 6000
    );
}

function parseUpdates(resp) {
    if (resp["updates"] && Array.isArray(resp["updates"])) {
        resp["updates"].forEach((eintrag) => {
            const nummer = parseInt(eintrag["nummer"]);
            alleSchwimmer[nummer] = { ...eintrag };
            const aktiv = schwimmer.find(s => s.nummer === nummer);
            if (aktiv) {
                if (eintrag.bahnanzahl != null) aktiv.bahnen = eintrag.bahnanzahl;
                if (eintrag.vorname)  aktiv.vorname  = eintrag.vorname;
                if (eintrag.nachname) aktiv.nachname = eintrag.nachname;
            }
        });
    }
}

document.getElementById("rundeAbziehenOption").addEventListener("click", function () {
    if (clickedDiv) {
        const nummer = parseInt(clickedDiv.dataset.nummer);
        if (confirm(`Eine Bahn bei Schwimmer ${nummer} abziehen?`)) {
            const s_data = schwimmer.find(s => s.nummer == nummer);
            if (s_data) {
                s_data.bahnen -= 1;
                render();
                actions.push({
                    kommando: "ADD",
                    parameter: [nummer, -1, s_data.aufBahn],
                    timestamp: new Date().toISOString(),
                    transmitted: false
                });
                updateFormIsDirty(true);
                transmitActions();
            }
        }
    }
    clickedDiv = null;
    contextMenu.style.display = "none";
});

document.getElementById("deleteSwimmer").addEventListener("click", function () {
    if (clickedDiv) {
        contextMenu.style.display = "none";
        const nummer = parseInt(clickedDiv.dataset.nummer);
        if (confirm(`Soll die Nummer ${nummer} entfernt werden?`)) {
            removeSchwimmerDiv(clickedDiv);
        }
    }
    clickedDiv = null;
    contextMenu.style.display = "none";
});

document.getElementById("bahnanzahlReset").addEventListener("click", function () {
    if (!clickedDiv) return;
    const nummer = parseInt(clickedDiv.dataset.nummer);
    const s_data = schwimmer.find(s => s.nummer == nummer);
    contextMenu.style.display = "none";
    clickedDiv = null;
    if (!s_data || s_data.bahnen <= 0) return;

    const betrag = -s_data.bahnen;
    const clickTimestamp = new Date().toISOString();
    if (pendingTimers.has(nummer)) {
        clearTimeout(pendingTimers.get(nummer).timerId);
    }
    const timerId = setTimeout(() => autoSenden(nummer, clickTimestamp, betrag, "Bahnanzahl reset"), TIMER_DAUER_MS);
    pendingTimers.set(nummer, { timerId, clickTimestamp, type: 'reset' });
    render();
});


document.getElementById("toggleInfoBar").addEventListener("click", toggleInfoBar);
initBahnButtons();

setInterval(transmitActions, 30000);

if (fadeTime > 0) {
    const FADE_STEP_S = 10;
    setInterval(() => {
        let changed = false;
        schwimmer.forEach(s => {
            if (pendingTimers.has(s.nummer)) return; // aktiv in Nutzung
            s.prio = (s.prio ?? 0) + FADE_STEP_S;
            if (s.prio >= fadeTime && verwaltete_bahnen.includes(s.aufBahn)) {
                s.aufBahn = 0; // Besen-Symbol erscheint
                changed = true;
            }
        });
        if (changed || DEBUG) render();
    }, FADE_STEP_S * 1000);
}

fetchSchwimmer().then(() => {
    fillSchwimmerAusMeinenBahnen();
    render();
});

window.debugSchwimmerHinzufuegen = function(nummer) {
    schwimmerHinzufuegen(String(nummer));
    render();
};
window.debugSchwimmerEntfernen = function() {
    if (schwimmer.length === 0) return;
    const zufaelliger = schwimmer[Math.floor(Math.random() * schwimmer.length)];
    const div = document.querySelector(`div[data-nummer="${zufaelliger.nummer}"]`);
    if (div) removeSchwimmerDiv(div);
};
