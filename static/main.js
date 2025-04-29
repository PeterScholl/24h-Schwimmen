let formIsDirty = true; // Flag, das anzeigt, ob Daten geändert wurden
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
let schwimmer = [
    { nummer: 1, name: "Anna", bahnen: 5, aufBahn: 1, aktiv: true, prio: 10 },
    { nummer: 2, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 3, name: "Charly", bahnen: 5, prio: 10 },
    { nummer: 4, name: "Doris", bahnen: 3, prio: 15 },
    { nummer: 5, name: "Emil", bahnen: 5, prio: 10 },
    { nummer: 6, name: "Fritz", bahnen: 3, prio: 15 },
    { nummer: 7, name: "Günter", bahnen: 5, prio: 10 },
/*    { nummer: 8, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 9, name: "Anna", bahnen: 5, prio: 10 },
    { nummer: 10, name: "Anna", bahnen: 5, prio: 10 },
    { nummer: 11, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 12, name: "Anna", bahnen: 5, prio: 10 },
    { nummer: 13, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 14, name: "Anna", bahnen: 5, prio: 10 },
    { nummer: 15, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 16, name: "Ben", bahnen: 3, prio: 15 },
    { nummer: 17, name: "Clara", bahnen: 7, prio: 5 },*/
];
let actions = [];
let alleSchwimmer = []; // Beinhaltet die Schwimmer in der Datenbank

document.getElementById('schwimmerHinzufuegen').addEventListener('click', schwimmerHinzufuegen);
document.getElementById('downloadJsonBtn').addEventListener('click', downloadJSON);

function search(number) {
    const zelle = Array.from(document.querySelectorAll(".nummer")).find(nr =>
        nr.textContent.trim() === number
    );

    if (zelle) {
        console.log("Gefunden:", zelle);
        return true;
    } else {
        console.log("Nicht gefunden");
        return false;
    }
}

function schwimmerHinzufuegen() {
    var nummer = prompt("Nummer:");

    if (!(nummer !== null && nummer.trim() !== "" && !isNaN(nummer))) {
        return;
    }

    if (search(nummer)) {
        alert("Schwimmer*in existiert bereits!");
        return;
    }

    // Neue Zeile erstellen
    var neueZeile = document.createElement('tr');

    // Zellen in der neuen Zeile erstellen
    var nummerZelle = document.createElement('td');
    nummerZelle.className = 'nummer';

    var bahnenZelle = document.createElement('td');
    bahnenZelle.className = 'bahnen';

    // Text in die Zellen einfügen
    nummerZelle.innerText = nummer;
    bahnenZelle.innerText = 0;

    // Zellen zur neuen Zeile hinzufügen
    neueZeile.appendChild(nummerZelle);
    neueZeile.appendChild(bahnenZelle);

    // Die neue Zeile in die Tabelle einfügen
    var tabelle = document.getElementById('schwimmer');
    tabelle.appendChild(neueZeile);
}


function tableToJSON(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll("tr");

    const headers = Array.from(rows[0].querySelectorAll("th")).map(th =>
        th.getAttribute("data-key")
    );

    const jsonData = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.querySelectorAll("td");
        const rowData = {};

        cells.forEach((cell, index) => {
            const key = headers[index];
            rowData[key] = cell.textContent.trim();
        });

        // HIER die Abwesenheit ergänzen
        rowData["Abwesend"] = row.classList.contains("abwesend");

        if (Object.keys(rowData).length > 0) {
            jsonData.push(rowData);
        }
    }

    return jsonData;
}

function showStatusMessage(text, isSuccess = true, duration = 3000) {
    const msg = document.getElementById("statusMessage");
    msg.textContent = text;
    msg.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
    msg.style.display = "block";

    setTimeout(() => {
        msg.style.display = "none";
    }, duration);
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
    // Tabelle in JSON umwandeln
    const data = tableToJSON("schwimmer");

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
    return /^(\d+(,\d+)*)?$/.test(value.trim());
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
        const zahlen = input.value.split(",").map(s => parseInt(s.trim(), 10));
        console.log("Gültige Bahnnummern:", zahlen);
        verwaltete_bahnen = zahlen;
        showStatusMessage("Bahnen geändert", true, 1000);
    } else { //Fehlerhafte Bahnnummern
        showStatusMessage("Ungültiges Format! Bitte nur Zahlen, getrennt durch Kommas.", false);
        input.value = verwaltete_bahnen.join(',');
        checkBahnenInput(); //Farbe wieder richtig setzen
    }
}

const table = document.getElementById("schwimmer");
const contextMenu = document.getElementById("contextMenu");
let clickedRow = null;

// **********************************************************
//   Behandlung und Verarbeitung der DIV-Darstellung
// **********************************************************
const container = document.getElementById('container');

// Map für laufende Fade-Operationen - soll auf ein DIV nach einem Klick angewandt werden
const fadeControllers = new Map();

// Fading-Funktion blendet ein Div langsam aus
async function fadeOut(div, duration = 3000) {
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
    clicked_schwimmer.style.backgroundColor="aqua";
    console.log(`Schwimmer ${nummer} wurde geklickt.`);
    // Falls schon ein Fade läuft: abbrechen
    if (fadeControllers.has(nummer)) {
        fadeControllers.get(nummer).abort();
        fadeControllers.delete(nummer);
        clicked_schwimmer.style.opacity = 1; // sofort wieder sichtbar
        //Angezeigte Bahn wieder um eins Verringern
        aendereBahnenInDiv(clicked_schwimmer, -1);
        clicked_schwimmer.style.backgroundColor="";
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
                console.log("Schwimmer: Bahnene erhöhen und Prio auf 0 setzen", s_data);
                s_data.prio = 0;
                s_data.bahnen += 1;
                //das Div löschen - wird beim rendern wieder hinten angehangen
                clicked_schwimmer.remove();
                render();
                actions.push({
                    kommando: "ADD",
                    parameter: [nummer, 1],
                    timestamp: new Date().toISOString(),
                    transmitted: false
                });
                
            }
        }
    } catch (e) {
        console.log(e);
    }


});

function render() {
    const container = document.getElementById("container");

    // Aktuelle Divs nach Nummer erfassen
    const existingDivs = new Map();
    container.querySelectorAll(".schwimmer").forEach(div => {
        existingDivs.set(Number(div.dataset.nummer), div);
    });

    // Schwimmer nach Prio sortieren
    const sortedSchwimmer = [...schwimmer].sort((a, b) => b.prio - a.prio);

    // Divs neu anordnen
    sortedSchwimmer.forEach((s) => {
        let div = existingDivs.get(s.nummer);

        if (!div) {
            // Div existiert noch nicht → neu erstellen
            div = document.createElement("div");
            div.className = "schwimmer";
            div.dataset.nummer = s.nummer;
            container.appendChild(div);
        }

        // Inhalt (fast) immer aktualisieren
        div.dataset.prio = s.prio ?? 0;
        if (!fadeControllers.has(div.dataset.nummer)) {
            div.innerHTML = `
                <div class="nummer">${s.nummer} <span class="bahnen">(${s.bahnen})</span></div>
                <div class="name">${s.name}  <span class="prio">Prio: ${s.prio}</span></div>
            `;
        } else {
            console.log("Hier wird gefadet", s.nummer);
        }

        // Div richtig platzieren
        container.appendChild(div); // appendChild verschiebt div, wenn es schon existiert
    });
}


// Sekündliches auffrischen der darstellung
const interval = 1000; // Auffrischung in ms
setInterval(() => {
    schwimmer.forEach((s) => (s.prio += interval / 1000)); // Prio um 1 erhöhen
    render();
}, interval);

// zu Beginn einmal zeichnen
render();

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
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log("Error on transmit",error);
        updateServerStatus(false);
    } finally {
        isFetching = false;
    }
}

function updateServerStatus(neu) {
    console.log("updateServerStatus - alt", server_verbunden, "neu", neu);
    if (server_verbunden != neu) { //Server status hat sich geändert
        server_verbunden = neu;
        const statusspan = document.getElementById('serverStatus');
        if (server_verbunden) {
            statusspan.innerHTML=`
            <span style="height: 10px; width: 10px; background-color: green; border-radius: 50%; display: inline-block; margin-right: 5px">
            </span> Verbunden
            `;
            showStatusMessage("Server wieder verbunden", true);
        } else {
            statusspan.innerHTML=`
            <span style="height: 10px; width: 10px; background-color: red; border-radius: 50%; display: inline-block; margin-right: 5px">
            </span> Nicht Verbunden
            `;
            showStatusMessage("Serververbindung verloren", false);
        }

    }
}

/**
 * Holt die Daten aller auf dem Server gespeicherten Schwimmer und legt sie in 
 * alleSchwimmer ab
 * 
 * @returns {void}
 */
async function fetchAlleSchwimmer() {
    try {
        console.log("Schwimmer holen");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 Sekunden Timeout

        const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{'kommando': "GET", 'parameter':[], 'timestamp': new Date().toISOString()}]),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            alleSchwimmer = await response.json();
            console.log(alleSchwimmer);
            updateServerStatus(true);
        } else {
            updateServerStatus(false);
        }
    } catch (error) {
        console.log("Error on fetchAlleSchwimmer",error);
        updateServerStatus(false);
    } finally {
    }
}

// ----------------------------------------------------------
//  ENDE DATENAUSTAUSCH mit dem Server
// ----------------------------------------------------------


// Bahn hinzufügen bei Linksklick auf Nummer
table.addEventListener("click", function (event) {
    if (event.target.classList.contains("nummer")) {
        const schwimmer_nr = event.target.innerText;
        console.log("schwimmer_nr", schwimmer_nr);
        const row = event.target.parentElement;
        const bahnenCell = row.querySelector(".bahnen");

        if (!row.classList.contains("abwesend")) {
            let current = parseInt(bahnenCell.textContent);
            bahnenCell.textContent = current + 1;
        }
    }
});

// Kontextmenü bei Rechtsklick auf Nummer
table.addEventListener("contextmenu", function (event) {
    if (event.target.classList.contains("nummer")) {
        event.preventDefault(); // Standard-Rechtsklick unterdrücken

        clickedRow = event.target.parentElement;

        // Menü an Mausposition anzeigen
        contextMenu.style.top = event.pageY + "px";
        contextMenu.style.left = event.pageX + "px";
        contextMenu.style.display = "block";
        document.getElementById("bahnHinzufuegenOption").style.display = "none";
    }
});

// Kontextmenü ausblenden bei Klick außerhalb
document.addEventListener("click", function (e) {
    if (!contextMenu.contains(e.target)) {
        contextMenu.style.display = "none";
    }
});

function send() {
    const jsonDaten = tableToJSON("schwimmer");
    const msg = JSON.stringify(jsonDaten);

    fetch("/senden", {
        method: "POST",
        body: msg,
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(response => response.text())
        .then(text => {
            document.getElementById("antwort").innerText = text;
        });

    fetch("/daten")
        .then(res => res.json())
        .then(daten => {
            const table = document.getElementById("schwimmer");
            // Alte Zeilen löschen (außer Header)
            const rows = table.querySelectorAll("tr:not(:first-child)");
            rows.forEach(row => row.remove());

            daten.sort((a, b) => {
                return (a.Abwesend === b.Abwesend) ? 0 : a.Abwesend ? 1 : -1;
            });

            // Neue Zeilen einfügen
            daten.forEach(schwimmer => {
                const tr = document.createElement("tr");

                if (schwimmer.Abwesend) {
                    tr.classList.add("abwesend");
                    table.appendChild(tr);
                }
                const tdNummer = document.createElement("td");
                tdNummer.className = "nummer";
                tdNummer.textContent = schwimmer.Nummer;

                const tdBahnen = document.createElement("td");
                tdBahnen.className = "bahnen";
                tdBahnen.textContent = schwimmer.Bahnen;

                tr.appendChild(tdNummer);
                tr.appendChild(tdBahnen);

                table.appendChild(tr);
            });
        });
}

document.getElementById("abwesendOption").addEventListener("click", function () {
    if (clickedRow) {
        clickedRow.classList.toggle("abwesend");

        const tabelle = clickedRow.parentNode;

        if (clickedRow.classList.contains("abwesend")) {
            tabelle.appendChild(clickedRow); // Nach unten
        } else {
            // Suche erste echte Datenzeile (also: erste <tr>, die NICHT die header-Zeile ist)
            const zeilen = tabelle.querySelectorAll("tr");
            let ziel = null;

            for (let i = 0; i < zeilen.length; i++) {
                if (zeilen[i] !== clickedRow && !zeilen[i].querySelector("th")) {
                    ziel = zeilen[i];
                    break;
                }
            }

            // Vor erster Datenzeile einfügen
            if (ziel) {
                tabelle.insertBefore(clickedRow, ziel);
            }
        }
    }

    contextMenu.style.display = "none";
});

// Option: Runde abziehen
document.getElementById("rundeAbziehenOption").addEventListener("click", function () {
    if (clickedRow) {
        const bahnenCell = clickedRow.querySelector(".bahnen");
        let current = parseInt(bahnenCell.textContent);
        bahnenCell.textContent = Math.max(0, current - 1);
    }
    contextMenu.style.display = "none";
});

document.getElementById("bahnHinzufuegenOption").addEventListener("click", function () {
    if (clickedRow) {
        const bahnenCell = clickedRow.querySelector(".bahnen");

        if (!clickedRow.classList.contains("abwesend")) {
            let current = parseInt(bahnenCell.textContent);
            bahnenCell.textContent = current + 1;
        }
    }
    contextMenu.style.display = "none";
});

document.getElementById("deleteSwimmer").addEventListener("click", function () {
    if (clickedRow) {
        if (confirm("Soll diese Nummer entfernt werden?")) {
            clickedRow.remove();
        }
    }
    contextMenu.style.display = "none";
});

//setInterval(send, 50000);
setInterval(transmitActions,10000);
send()
