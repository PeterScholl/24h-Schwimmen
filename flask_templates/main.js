import { schwimmerNummerErfragen, showStatusMessage } from './mymodals.js'

const schwimmerNrLength = parseInt("{{schwimmerNrLen}}");
const fade_timeout_ms = parseInt("{{fade_timeout_ms}}");
const fade_to_endOfList = parseBoolean("{{fade_to_endOfList}}");
const DEBUG = false;

function parseBoolean(value) {
    console.log("parseBoolean", value);
  return value === 'true' || value === 'True' || value === true;
}

function logMessage(text, isSuccess = true) {
    statMessages.push({
        message: text,
        success: isSuccess,
        timestamp: new Date().toISOString()
    });
}

let formIsDirty = false; // Flag, das anzeigt, ob Daten geändert wurden
// Beim Verlassen der Seite warnen, falls Änderungen vorhanden sind
window.addEventListener('beforeunload', function (event) {
    if (formIsDirty) {
        event.preventDefault();
        // Zeigt eine Bestätigungsmeldung an, wenn der Benutzer versucht, die Seite zu verlassen
        const message = "Es gibt ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?";
        //event.returnValue = message;  // Laut Chat-GPT Standard für viele Browser
        return message; // Für einige andere Browser
    }
});

let verwaltete_bahnen = [7]; //Liste der Bahnen, die von diesem Client verwaltet werden
const input = document.getElementById("bahnen");
if (isBahnenInputValid(input.value)) {
    verwaltete_bahnen = input.value.split(",").map(s => parseInt(s.trim(), 10));
    //console.log("Verwaltete Bahnen", verwaltete_bahnen);
}

// Daten schwimmer und actions
let schwimmer = [];
let actions = [];
let statMessages = [];
let alleSchwimmer = {}; // Beinhaltet die Schwimmer in der Datenbank in einem Dictionary mit nummer als Key

let longPressTimer; // Variable für den Timer um einen Longpress von einem Touchmove zu unterscheiden

document.getElementById('schwimmerHinzufuegen').addEventListener('click', promptSchwimmerHinzufuegen);
document.getElementById('downloadJsonBtn').addEventListener('click', downloadJSON);

async function promptSchwimmerHinzufuegen() {
    // var nummer = prompt("Nummer:");
    var nummer = await schwimmerNummerErfragen(schwimmerNrLength);
    console.log("Erfrage Nummer:", nummer);

    if (nummer == null) {
        // Modal wurde geschlossen
        return
    }

    if (!(nummer !== null && nummer.trim() !== "" && !isNaN(nummer))) {
        showStatusMessage("Ungültige Schwimmernummer", false);
        return;
    }

    schwimmerHinzufuegen(nummer);
}

function schwimmerHinzufuegen(nummer) {
    console.debug("Schwimmer Nr. ", nummer, "wird gesucht...");

    // Der gesuchte Schwimmer soll auf jeden Fall oben in die Liste
    const maxPrio = Math.max(Math.max(...schwimmer.map(s => s.prio)), 0);

    //Wenn der schwimmer schon in der Liste schwimmer ist, wird seine Priorität auf das aktuelle Maximum gesetzt
    const aktiver = schwimmer.find(s => s.nummer == nummer);
    if (aktiver) {
        console.debug("... aktiver Schwimmer");
        // prio auf max
        aktiver.prio = maxPrio + 1;
    } else { //Wenn der schwimmer in der Liste alleSchwimmer ist, wird er in die Liste schwimmer übernommen ...
        fetchSchwimmer(nummer);
        const bekannter = alleSchwimmer[parseInt(nummer)] ?? null;
        if (bekannter) {
            console.debug(`Schwimmer ${nummer} Nummer war schon vorhanden:`, bekannter);
            const scopy = {
                nummer: parseInt(nummer),
                vorname: bekannter.vorname,
                nachname: bekannter.nachname,
                bahnen: bekannter.bahnanzahl,
                aktiv: true,
                prio: maxPrio + 1
            };
            if (!bekannter.auf_bahn || !bekannter.auf_bahn in verwaltete_bahnen) {
                scopy.aufBahn = verwaltete_bahnen[0];
            } else {
                scopy.aufBahn = bekannter.auf_bahn;
            }
            console.log("SchwimmerKopie", scopy);
            schwimmer.push(scopy);
            actions.push({
                kommando: "ACT",
                parameter: [nummer, 1],
                timestamp: new Date().toISOString(),
                transmitted: false
            });
        } else { //Ansonsten wird er in der Liste Schwimmer neu erzeugt
            console.debug("Schwimmer war nicht bekannt");
            const neuer = {
                nummer: parseInt(nummer),
                vorname: `Schwimmer ${nummer}`,
                nachname: '',
                bahnen: 0,
                aufBahn: verwaltete_bahnen[0],
                aktiv: 1,
                prio: maxPrio + 1
            };
            schwimmer.push(neuer);
        }
    }
}

function fillSchwimmerAusMeinenBahnen() {
    const alleSchwimmerValues = Object.keys(alleSchwimmer).map(function (key) {
        return alleSchwimmer[key];
    });
    console.log("Alle Schwimmer Values", alleSchwimmerValues);
    const meineSchwimmer = alleSchwimmerValues.filter(s => verwaltete_bahnen.includes(s.auf_bahn) && s.aktiv == 1);
    // Alle Schwimmer die davon noch nicht in schwimmer sind einfügen
    meineSchwimmer.forEach(s_neu => {
        console.log("Prüfe: ", s_neu);
        if (!schwimmer.some(s => s.nummer == s_neu.nummer)) {
            const scopy = {
                nummer: parseInt(s_neu.nummer),
                vorname: s_neu.vorname,
                nachname: s_neu.nachname,
                bahnen: s_neu.bahnanzahl,
                aktiv: true,
                aufBahn: s_neu.auf_bahn,
                prio: 0 //hinten anfügen
            };
            console.log("SchwimmerKopie", scopy);
            schwimmer.push(scopy);
        }
    });
}

function toggleInfoBar() {
    // Das Info-Bar-Element auswählen
    const infoBar = document.getElementById("infoBar");

    // Überprüfen, ob die Info-Leiste gerade sichtbar ist
    if (infoBar.style.display === "none" || infoBar.style.display === "") {
        // Info-Leiste einblenden
        infoBar.style.display = "flex";
    } else {
        // Info-Leiste ausblenden
        infoBar.style.display = "none";
    }
}


function downloadJSON() {
    // Daten für JSON-Umwandlung in ein Dictionary packen
    const data = { "schwimmer": schwimmer, "alleSchwimmer": alleSchwimmer, "actions": actions, "statMessages": statMessages };

    // In JSON-Text umwandeln
    const jsonString = JSON.stringify(data, null, 2);

    // Blob erstellen (Dateiobjekt)
    const blob = new Blob([jsonString], { type: "application/json" });

    // Temporären Download-Link erstellen
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "24hschwimmen.json";

    // Link klicken (Download starten)
    document.body.appendChild(link);
    link.click();

    // Aufräumen
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function isBahnenInputValid(value) {
    // Prüft, ob der Eingabewert eine durch Kommas getrennte Liste von Zahlen ist,
    // z. B. "3", "1,2", "10,20,30", aber kein leerer String.
    // Regulärer Ausdruck:
    // ^         → Anfang des Strings
    // \d+       → mindestens eine Ziffer
    // (,\d+)*   → optional beliebig viele Gruppen aus Komma gefolgt von mindestens einer Ziffer
    // $         → Ende des Strings
    return /^(\d+(,\d+)*)$/.test(value.trim());
}

function checkBahnenInput() {
    const input = document.getElementById("bahnen");
    if (isBahnenInputValid(input.value)) {
        input.style.backgroundColor = ""; // gültig
    } else {
        input.style.backgroundColor = "#fdd"; // ungültig (rot)
    }
}

function parseBahnenInput() {
    const input = document.getElementById("bahnen");
    if (isBahnenInputValid(input.value)) {
        input.blur();
        const zahlen = input.value.split(",").map(s => parseInt(s.trim(), 10));
        console.log("Gültige Bahnnummern:", zahlen);
        verwaltete_bahnen = zahlen;
        showStatusMessage("Bahnen geändert", true, 1000);
        fetchSchwimmerVonBahnen();
        fillSchwimmerAusMeinenBahnen();
    } else { //Fehlerhafte Bahnnummern
        showStatusMessage("Ungültiges Format! Bitte nur Zahlen, getrennt durch Kommas.", false);
        input.value = verwaltete_bahnen.join(',');
        checkBahnenInput(); //Farbe wieder richtig setzen
    }
}

const contextMenu = document.getElementById("contextMenu");
let clickedDiv = null; //Wenn auf ein Div geklickt wird - merken

// **********************************************************
//   Behandlung und Verarbeitung der DIV-Darstellung
// **********************************************************
const container = document.getElementById('container');

// Map für laufende Fade-Operationen - soll auf ein DIV nach einem Klick angewandt werden
const fadeControllers = new Map();

// Fading-Funktion blendet ein Div langsam aus
async function fadeOut(div, duration = fade_timeout_ms) {
    return new Promise((resolve, reject) => {
        let opacity = 1;
        const interval = 50;
        const decrement = interval / duration;

        const controller = fadeControllers.get(div.dataset.nummer);

        if (!controller || controller.signal.aborted) {
            return reject('Fade abgebrochen');
        }

        const fade = setInterval(() => {
            if (!controller || controller.signal.aborted) {
                clearInterval(fade);
                div.style.opacity = 1;
                return reject('Fade abgebrochen');
            }
            opacity -= decrement;
            div.style.opacity = opacity;
            if (opacity <= 0) {
                clearInterval(fade);
                resolve();
            }
        }, interval);
    });
}


// Angezeigte Bahnen in einem Schwimmer-Div verändern
function aendereBahnenInDiv(div, anz) {
    // Finde das span mit der Klasse "bahnen"
    const bahnenSpan = div.querySelector('.bahnen');
    // Extrahiere die Zahl aus dem Textinhalt des span
    let bahnen = parseInt(bahnenSpan.textContent.match(/\d+/)[0], 10);
    // Ändere um Anzahl
    bahnen += anz;
    // Setze die neue Zahl im span
    bahnenSpan.textContent = `(${bahnen})`;
}

// Click auf ein Element in dem Container mit den Schimmern
container.addEventListener('click', async (event) => {
    const clicked_schwimmer = event.target.closest('.schwimmer');
    console.log("Klick in Container", clicked_schwimmer);

    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) {
        return; // Klick war außerhalb eines Box-Elements
    }

    const nummer = clicked_schwimmer.dataset.nummer; // oder eine andere Info
    clicked_schwimmer.style.backgroundColor = "aqua";
    console.log(`Schwimmer ${nummer} wurde geklickt.`);
    // Falls schon ein Fade läuft: abbrechen
    if (fadeControllers.has(nummer)) {
        fadeControllers.get(nummer).abort();
        fadeControllers.delete(nummer);
        clicked_schwimmer.style.opacity = 1; // sofort wieder sichtbar
        //Angezeigte Bahn wieder um eins Verringern
        aendereBahnenInDiv(clicked_schwimmer, -1);
        clicked_schwimmer.style.backgroundColor = "";
        //console.log(`Fade von Div ${nummer} abgebrochen.`);
        return;
    }

    // Angezeigte Bahn um eins erhöhen
    aendereBahnenInDiv(clicked_schwimmer, 1);

    // Neuen Controller speichern
    const controller = new AbortController();
    fadeControllers.set(nummer, controller);

    try {
        await fadeOut(clicked_schwimmer);
        if (fadeControllers.has(nummer)) {
            fadeControllers.delete(nummer);
            console.log(`Aktion nach Fade von Div ${nummer} ausführen.`);
            // Hier deine eigentliche Klick-Aktion!
            const s_data = schwimmer.find(s => s.nummer == nummer);
            console.log("s_data", s_data);
            if (s_data) {
                console.log("Schwimmer: Bahnen erhöhen und Prio auf 0 setzen", s_data);
                if (!s_data.aufBahn || !verwaltete_bahnen.includes(s_data.aufBahn)) {
                    console.log(`Bahn des Schwimmers ${nummer} auf ${verwaltete_bahnen[0]} gesetzt`);
                    s_data.aufBahn = verwaltete_bahnen[0];
                }
                if (fade_to_endOfList) s_data.prio = 0;
                
                //Evtl. genauere Daten in alleSchwimmer
                s_data.bahnen = Math.max(s_data.bahnen, alleSchwimmer[nummer] ? alleSchwimmer[nummer].bahnanzahl : 0);
                s_data.bahnen += 1;

                clicked_schwimmer.style.opacity = '';
                render();
                actions.push({
                    kommando: "ADD",
                    parameter: [nummer, 1, s_data.aufBahn],
                    timestamp: new Date().toISOString(),
                    transmitted: false
                });
                updateFormIsDirty(true);

            }
        }
    } catch (e) {
        console.log(e);
    }
});

// Kontextmenü bei Rechtsklick auf Schwimmer div
container.addEventListener('contextmenu', function (event) {
    const clicked_schwimmer = event.target.closest('.schwimmer');
    console.log("RechtsKlick in Container", clicked_schwimmer);

    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) {
        return; // Klick war außerhalb eines Box-Elements
    }

    event.preventDefault(); // Standard-Rechtsklick unterdrücken
    clickedDiv = clicked_schwimmer;

    // Menü an Mausposition anzeigen
    showSchwimmerContextMenu(event.pageX, event.pageY);
});

// Kontextmenü ausblenden bei Klick außerhalb
document.addEventListener("click", function (e) {
    if (!contextMenu.contains(e.target)) {
        contextMenu.style.display = "none";
    }
});
document.addEventListener("contextmenu", function (e) {
    const clicked_schwimmer = e.target.closest('.schwimmer');
    console.log("RechtsKlick in Container", clicked_schwimmer);

    if (!clicked_schwimmer || !container.contains(clicked_schwimmer)) {
        contextMenu.style.display = "none";
    }
});

function showSchwimmerContextMenu(x, y) {
    // Optionalanzeige "Fremdbahnen entfernen" nur einblenden, wenn Fremdschwimmer da sind
    const nurEigene = document.getElementById("nurEigene");
    if (schwimmer.some(s => !verwaltete_bahnen.includes(s.aufBahn))) {
        nurEigene.style.display = "block";
    } else {
        nurEigene.style.display = "none";
    }
    // Bahn abziehen nur Anzeigen, wenn Anzahl größer 0
    const s_data = schwimmer.find(s => s.nummer == parseInt(clickedDiv.dataset.nummer));
    const bahnAbziehen = document.getElementById("rundeAbziehenOption");
    if (!s_data || s_data.bahnen <= 0) {
        bahnAbziehen.style.display = "none";
    } else {
        bahnAbziehen.style.display = "block";
    }

    // Erst anzeigen, damit offsetWidth/Height korrekt bestimmt werden können
    // dann so platzieren das das Menü nicht über den Rand hinaus ragt.
    contextMenu.style.display = "block";
    contextMenu.style.top = "0px";
    contextMenu.style.left = "0px"; // Temporär platzieren

    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Berechnete Position korrigieren, falls über den Rand
    const posX = (x + menuWidth > viewportWidth) ? viewportWidth - menuWidth - 5 : x;
    const posY = (y + menuHeight > viewportHeight) ? viewportHeight - menuHeight - 5 : y;

    contextMenu.style.left = `${Math.max(posX, 0)}px`;
    contextMenu.style.top = `${Math.max(posY, 0)}px`;

}

function addSwipeHandler(div) {
    let startX = 0;
    let currentX = 0;
    let swipedleft = false;
    let swipedright = false;

    const threshold = div.offsetWidth / 4; // Funktioniert nur, wenn das div schon gerendert ist
    //const threshold = div.getBoundingClientRect().width; //Alternative
    //console.log("Threshold: ",threshold);
    const maxmovedist = 1.5 * threshold;

    div.addEventListener('touchstart', e => {
        longPressTimer = setTimeout(() => {
            showSchwimmerContextMenu(e.touches[0].clientX, e.touches[0].clientY);
        }, 600); // Dauer in mx
        if (fadeControllers.has(div.dataset.nummer)) {
            return;             // bricht die weitere Verarbeitung ab, wenn das Objekt gerade fadet
        }

        //e.preventDefault(); /* dann geht kein Klicken mehr */
        div.dataset.swiping = "true";
        startX = e.touches[0].clientX;
        div.style.zIndex = '1000';
        div.style.transition = 'none'; // Bewegung ohne Übergang - folgt dem Finger sofort
    }, { passive: false });

    div.addEventListener('touchmove', e => {
        clearTimeout(longPressTimer);
        e.preventDefault();
        if (div.dataset.swiping != "true") {
            return;             // bricht die weitere Verarbeitung ab wenn touchstart schon abgebrochen wurde
        }

        currentX = e.touches[0].clientX;
        const deltaX = Math.max(-maxmovedist, Math.min(maxmovedist, currentX - startX));

        div.style.transform = `translateX(${deltaX}px)`;

        // Wenn mehr als die Hälfte verschoben → Farbe ändern
        if (deltaX > threshold) {
            div.style.backgroundColor = 'lightgreen';
            div.style.transform = `translate(${deltaX}px,${3 * (deltaX - threshold)}px)`;
            swipedright = true;
        } else if (deltaX < -threshold) {
            div.style.backgroundColor = 'red';
            div.style.transform = `translateX(${2 * deltaX + threshold}px) scale(${(deltaX + 1.2 * maxmovedist) / (1.2 * maxmovedist - threshold)})`;
            swipedleft = true;
        } else {
            div.style.backgroundColor = '';
            swipedleft = false;
            swipedright = false;
        }
    }, { passive: false }); // wichtig ?!

    div.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (div.dataset.swiping != "true") {
            return;             // bricht die weitere Verarbeitung ab, wenn touchstart wg. Fading schon unterbunden wurde
        }
        delete div.dataset.swiping;
        if (swipedleft) {
            swipedleft = false;
            removeSchwimmerDiv(div);
        } else if (swipedright) {
            // Schiebe das Element ans Ende der Liste
            schwimmer.forEach(s => { if (s.nummer === parseInt(div.dataset.nummer)) s.prio = 0; });
            // zurücksetzen
            swipedright = false;
            div.style.transform = 'translateX(0)';
            div.style.backgroundColor = '';
            div.style.zIndex = '';
            render();
        } else {
            div.style.transition = 'transform 0.2s ease'; //Springt zurück
            // zurücksetzen
            div.style.transform = 'translateX(0)';
            div.style.backgroundColor = '';
            div.style.zIndex = '';
        }
    });
}

function removeSchwimmerDiv(div, setinactive = true, dorender = true) {
    // Abgleich der Daten in alleSchwimmer mit den Daten des Schwimmers der entfernt wird.
    // entferne das Element (du hast das bereits implementiert)
    div.style.opacity = 0;
    const index = schwimmer.findIndex(s => parseInt(s.nummer) == parseInt(div.dataset.nummer));
    if (index !== -1) {
        let entfernterSchwimmer = schwimmer[index];
        schwimmer.splice(index, 1); //lösche einen Eintrag an Stelle index
        // Aktualisiere die Daten in alleSchwimmer - Bahnen reicht
        // console.log(`entfernter Schwimmer ${entfernterSchwimmer.nummer} hat bisher ${alleSchwimmer[entfernterSchwimmer.nummer].bahnanzahl} Bahnen`);
        alleSchwimmer[entfernterSchwimmer.nummer].bahnanzahl = Math.max(alleSchwimmer[entfernterSchwimmer.nummer].bahnanzahl, entfernterSchwimmer.bahnen);
        if (setinactive) {
            alleSchwimmer[entfernterSchwimmer.nummer].aktiv = 0;
            actions.push({
                kommando: "ACT",
                parameter: [entfernterSchwimmer.nummer, 0],
                timestamp: new Date().toISOString(),
                transmitted: false
            });
        }
    }
    //div.remove();
    if (dorender) render();
}

function render() {
    const container = document.getElementById("container");

    // 1. Aktuelle Positionen merken (First)
    const firstRects = new Map();
    // 2. Vorhandene Schwimmernummern sammeln
    const existingDivs = new Map();
    container.querySelectorAll(".schwimmer").forEach(div => {
        firstRects.set(div.dataset.nummer, div.getBoundingClientRect());
        existingDivs.set(Number(div.dataset.nummer), div);
    });

    const sortedSchwimmer = [...schwimmer].sort((a, b) => a.prio - b.prio); //umgekehrt sortiert
    const aktuelleSNummern = new Set(sortedSchwimmer.map(s => s.nummer));

    // Divs ausblenden, die nicht mehr in aktuelle Nummern vorhanden sind
    existingDivs.forEach((div, nummer) => {
        if (!aktuelleSNummern.has(nummer)) {
            div.classList.add("fade-out");
            div.style.transition = "opacity 300ms, transform 300ms";
            div.style.opacity = 0;
            div.style.transform = "scale(0.9)";
            setTimeout(() => div.remove(), 300); // Entfernen nach Animation
        }
    });

    // Divs nach priorität sortiert in den Container setzen
    sortedSchwimmer.forEach((s) => {
        let div = existingDivs.get(s.nummer);

        if (!div) {
            div = document.createElement("div");
            div.className = "schwimmer";
            div.dataset.nummer = s.nummer;
            container.appendChild(div); //Notwendig, da sonst der Swipe-Handler nicht gesetzt werden kann
            addSwipeHandler(div);
        }

        div.dataset.prio = s.prio ?? 0;
        if (!fadeControllers.has(div.dataset.nummer) && div.dataset.swiping !== "true") {
            const snummer = schwimmerNrLength > 0 ? String(s.nummer).padStart(schwimmerNrLength, '0') : s.nummer;

            div.innerHTML = `
                <div class="nummer">${snummer} <span class="bahnen">(${s.bahnen})</span></div>
                <div class="name">${s.vorname}  ${DEBUG ? `<span class="prio">Prio: ${s.prio}</span>` : ""}</div>
            `;
            if (!verwaltete_bahnen.includes(s.aufBahn)) {
                div.style.backgroundColor = "lightgreen";
            } else {
                div.style.removeProperty("background-color");
            }
        }

        //container.appendChild(div); // wird ans Ende gesetzt (neu sortiert)
        container.insertBefore(div, container.firstChild); //Umgekehrte Sortierung um Sprung beim Entfernen von DIVS zu vermeiden
    });

    // 3. Nach dem Umordnen: neue Positionen messen (Last) + bewegung dorthin Animate
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
                ], {
                    duration: 300,
                    easing: 'ease'
                });
            }
        }
    });
}



// Sekündliches auffrischen der darstellung
const interval = 1000; // Auffrischung in ms
setInterval(() => {
    schwimmer.forEach((s) => (s.prio += interval / 1000)); // Prio um 1 erhöhen
    render();
}, interval);



// ----------------------------------------------------------
//  ENDE  Behandlung und Verarbeitung der DIV-Darstellung
// ----------------------------------------------------------

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
        console.log("transmit Action");
        isFetching = true;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 Sekunden Timeout

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
            //console.log(resp);
            if (resp["updates"]) parseUpdates(resp);
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
        //console.log("Color:",formIsDirty ? 'yellow' : 'green');
        statusspan.innerHTML = `
            <span style="height: 10px; width: 10px; background-color: ${formIsDirty ? 'yellow' : 'green'}; border-radius: 50%; display: inline-block; margin-right: 5px">
            </span> Verbunden
            `;

    } else {
        statusspan.innerHTML = `
            <span style="height: 10px; width: 10px; background-color: red; border-radius: 50%; display: inline-block; margin-right: 5px">
            </span> Nicht Verbunden
            `;
    }
}

function updateServerStatus(neu) {
    //console.log("updateServerStatus - alt", server_verbunden, "neu", neu, "ungespeicherte Daten: ", formIsDirty);
    if (server_verbunden != neu) { //Server status hat sich geändert
        server_verbunden = neu;
        logMessage(neu ? "Server wieder verbunden" : "Serververbindung verloren", neu);
        showStatusMessage(neu ? "Server wieder verbunden" : "Serververbindung verloren", neu);
        redrawStatusBar();
    }
}

function updateFormIsDirty(neu) {
    //console.log("updateFormIsDirty - alt", formIsDirty, "neu", neu, "Serverstatus: ", server_verbunden);
    if (formIsDirty != neu) { //FormIdDirty- status hat sich geändert
        formIsDirty = neu;
        redrawStatusBar();
    }
}

/**
 * Holt die Daten der auf dem Server gespeicherten Schwimmer und legt sie in 
 * alleSchwimmer ab
 * 
 * @param {number} [id=-1] // id des zu holenden Schwimmers -1 gleich alle
 * @returns {void}
 */
async function fetchSchwimmer(id = -1) {
    try {
        console.log("Schwimmer holen");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 Sekunden Timeout
        const parameters = (id == -1) ? [] : [id];

        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "GET", 'parameter': parameters, 'timestamp': new Date().toISOString() }]),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const resp = await response.json();
            console.log(resp);
            if (resp["updates"]) parseUpdates(resp);
            //console.log(alleSchwimmer);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log(`Error on fetchSchwimmer mit ID ${id} (-1 steht für alle)`, error);
        updateServerStatus(false);
    } finally {
    }
}

/**
 * Holt die Daten der auf dem Server gespeicherten Schwimmer auf den verwalteten
 * Bahnen
 * 
 * @returns {void}
 */
async function fetchSchwimmerVonBahnen() {
    try {
        console.log(`Schwimmer von Bahnen ${verwaltete_bahnen} holen`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 Sekunden Timeout

        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "GETB", 'parameter': verwaltete_bahnen, 'timestamp': new Date().toISOString() }]),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const resp = await response.json();
            console.log("In FetchSchwimmerVonBahnen response:", resp);
            if (resp["updates"]) parseUpdates(resp);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log(`Error on fetchSchwimmerVonBahnen (${verwaltete_bahnen}):`, error);
        updateServerStatus(false);
    } finally {
    }
}


function parseUpdates(resp) {
    if (resp["updates"] && Array.isArray(resp["updates"])) {
        resp["updates"].forEach((eintrag) => {
            alleSchwimmer[parseInt(eintrag["nummer"])] = { ...eintrag };
            debugLog(`Schwimmer Nummer ${eintrag["nummer"]} aktualisiert`);
        });
    }
}

// ----------------------------------------------------------
//  ENDE DATENAUSTAUSCH mit dem Server
// ----------------------------------------------------------

function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

// Option: Ans Ende der Liste aus dem Kontextmenü des Schwimmers
document.getElementById("swimmerToEnd").addEventListener("click", function () {
    if (clickedDiv) {
        const nummer = parseInt(clickedDiv.dataset.nummer);
        const s_data = schwimmer.find(s => s.nummer == nummer);
        s_data.prio=0;
        render();
    }
    clickedDiv = null;
    contextMenu.style.display = "none";
});

// Option: Runde abziehen - aus dem Kontextmenü des Schwimmers
document.getElementById("rundeAbziehenOption").addEventListener("click", function () {
    if (clickedDiv) {
        const nummer = parseInt(clickedDiv.dataset.nummer);
        if (confirm(`Eine Bahn bei Schwimmer ${nummer} abziehen?`)) {
            const s_data = schwimmer.find(s => s.nummer == nummer);
            console.log("s_data", s_data);
            if (s_data) {
                console.log("Schwimmer: Bahn abziehen", s_data);
                s_data.bahnen -= 1;
                render();
                actions.push({
                    kommando: "ADD",
                    parameter: [nummer, -1, s_data.aufBahn],
                    timestamp: new Date().toISOString(),
                    transmitted: false
                });
                updateFormIsDirty(true);
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

// Event Listener für Fremdbahnen entfernen
document.getElementById("nurEigene").addEventListener("click", function () {
    let index = schwimmer.findIndex(s => !verwaltete_bahnen.includes(s.aufBahn));
    while (index !== -1) {
        //lösche das DIV
        const div = document.querySelector(`div[data-nummer="${schwimmer[index].nummer}"]`);
        removeSchwimmerDiv(div, false, false); // auf Inaktiv sezten - false, render - false - erst wenn alle weg sind 
        index = schwimmer.findIndex(s => !verwaltete_bahnen.includes(s.aufBahn));
    }
    render(); //hier wird gerendert.
    contextMenu.style.display = "none";
});

document.getElementById("toggleInfoBar").addEventListener("click", toggleInfoBar);
document.getElementById("bahnen").addEventListener("input", checkBahnenInput);
document.getElementById("bahnen").addEventListener("blur", (event) => { parseBahnenInput(); });
document.getElementById("bahnen").addEventListener("keydown", (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        parseBahnenInput();
    }
});



debugLog("Initial commands - Grundlagen einrichten");
//alle Dreißig Sekunden die Daten zum Server schicken
setInterval(transmitActions, 30000);

// zu Beginn Daten vom Server holen
fetchSchwimmer().then(() => {
    // und  nach erhalt die der verwalteten Bahnen eintragen
    fillSchwimmerAusMeinenBahnen();
    // und einmal zeichnen
    render();
});

