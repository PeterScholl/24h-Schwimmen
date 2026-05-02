import { showStatusMessage } from "./mymodals.js";

// const knownHeaders = ['', 'Nummer', 'Name', 'Bahnanzahl', 'auf_bahn', 'aktiv', 'Aktionen'];

/**
 * Initialisiert den CSV-Import 
 * 
 * @param {String} fileInputSelector  // id des zu holenden Schwimmers -1 gleich alle
 * @param {String} previewContainerSelector
 * @param {String} sendButtonSelector
 * @param {String} options // Dictionary z.B. {url: '/admin', knownHeaders: ['','Nummer']}
 * @returns {void}
 */
export function initCSVImport(fileInputSelector, previewContainerSelector, sendButtonSelector, options = {}) {
    const fileInput = document.querySelector(fileInputSelector);
    const previewContainer = document.querySelector(previewContainerSelector);
    const sendButton = document.querySelector(sendButtonSelector);

    let parsedData = [];

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        // Welcher Separator ist häufiger
        const sepCounts = { ',': (text.match(/,/g) || []).length, ';': (text.match(/;/g) || []).length };
        const separator = sepCounts[','] > sepCounts[';'] ? ',' : ';';

        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        const headers = lines[0].split(separator).map(h => h.trim());
        if (options.knownHeaders) {
            showHeaderMappingModal(headers, mapping => {
                parsedData = lines.slice(1).map(line => {
                    const values = line.split(separator).map(v => 
                        v.trim().replace(/^"(.*)"$/, '$1')
                    );
                    const entry = {};
                    mapping.forEach((key, i) => {
                        if (key) entry[key] = values[i];
                    });
                    return entry;
                });
                renderPreview(Object.values(mapping).filter(k => k), parsedData, previewContainer);
            }, options.knownHeaders, () => { fileInput.value = ''; previewContainer.innerHTML = ''; parsedData = []; });
        } else {

            parsedData = lines.slice(1).map(line => {
                const values = line.split(separator).map(v => 
                    v.trim().replace(/^"(.*)"$/, '$1')
                );
                return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
            });

            renderPreview(headers, parsedData, previewContainer);
        }
    });

    sendButton.addEventListener('click', async () => {
        if (parsedData.length === 0) return;
        try {
            const url = options.url || '/admin';
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: options.action || 'import_schwimmer',
                    data: parsedData
                })
            });
            const result = await response.json();
            const label = options.importLabel || 'Einträge';
            const detail = (result['neu'] != null)
                ? `${result['neu']} neu, ${result['aktualisiert']} aktualisiert`
                : `${result['importiert']} importiert bzw. aktualisiert`;
            showStatusMessage(`${label}: ${detail}`);
        } catch (error) {
            showStatusMessage(`Fehler beim Import`, false);
        }
    });
}

/**
 * Initialisiert den JSON-Import 
 * 
 * @param {String} fileInputSelector  
 * @param {String} previewContainerSelector
 * @param {String} sendButtonSelector
 * @param {String} options // Dictionary z.B. {url: '/admin', knownHeaders: ['','Nummer']}
 * @returns {void}
 */
export function initJSONImport(fileInputSelector, previewContainerSelector, sendButtonSelector, options = {}) {
    const fileInput = document.querySelector(fileInputSelector);
    const previewContainer = document.querySelector(previewContainerSelector);
    const sendButton = document.querySelector(sendButtonSelector);

    let parsedJSON = {};

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            parsedJSON = JSON.parse(text);

            // Optionales Preview: Anzahl anzeigen
            previewContainer.innerHTML = `
                <div>Schwimmer: ${parsedJSON.schwimmer?.length || 0}</div>
                <div>Alle Schwimmer: ${Object.keys(parsedJSON.alleSchwimmer || {}).length}</div>
                <div>Actions: ${parsedJSON.actions?.length || 0}</div>
            `;
        } catch (err) {
            previewContainer.innerHTML = '<div>Fehler beim Einlesen der JSON-Datei.</div>';
            parsedJSON = {};
        }
    });

    sendButton.addEventListener('click', async () => {
        if (Object.keys(parsedJSON).length === 0) return;

        try {
            const url = options.url || '/admin';
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedJSON.actions)
            });
            const result = await response.json();
            showStatusMessage(`Import abgeschlossen: ${JSON.stringify(result)}`);
        } catch (err) {
            showStatusMessage('Fehler beim JSON-Import.',false);
        }
    });
}


let currentPage = 0;
let csvHeaders = [];
let csvData = [];

function renderPreview(headers, data, container) {
    // Bei erstem Aufruf: Initialisiere Daten und baue Steuerelemente
    if (headers && data) {
        csvHeaders = headers;
        csvData = data;
        currentPage = 0;

        container.innerHTML = `
      <div>
        Zeige 
        <input type="number" id="previewSize" value="20" min="1" style="width: 4ch;"> Einträge pro Seite
      </div>
      <div id="csvTableContainer"></div>
      <div>
        <button id="prevPage">Zurück</button>
        <span id="pageInfo"></span>
        <button id="nextPage">Weiter</button>
      </div>
    `;

        document.getElementById("previewSize").addEventListener("input", () => {
            currentPage = 0;
            renderPreview(); // Nur Tabelle neu
        });

        document.getElementById("prevPage").addEventListener("click", () => {
            if (currentPage > 0) {
                currentPage--;
                renderPreview();
            }
        });

        document.getElementById("nextPage").addEventListener("click", () => {
            const previewSize = parseInt(document.getElementById("previewSize").value, 10) || 20;
            if ((currentPage + 1) * previewSize < csvData.length) {
                currentPage++;
                renderPreview();
            }
        });
    }

    // Tabelle neu rendern
    const tableContainer = document.getElementById("csvTableContainer");
    const previewSize = parseInt(document.getElementById("previewSize").value, 10) || 20;
    const start = currentPage * previewSize;
    const end = start + previewSize;
    const pageRows = csvData.slice(start, end);

    const table = document.createElement("table");
    table.innerHTML = `<thead><tr>${csvHeaders.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;

    const tbody = document.createElement("tbody");
    for (const row of pageRows) {
        const tr = document.createElement("tr");
        tr.innerHTML = csvHeaders.map(h => `<td>${row[h] ?? ""}</td>`).join("");
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);

    // Seiteninfo aktualisieren
    const totalPages = Math.ceil(csvData.length / previewSize);
    document.getElementById("pageInfo").textContent = `Seite ${currentPage + 1} / ${totalPages}`;
}

function showHeaderMappingModal(headers, onConfirm, knownHeaders, onCancel) {
    const modal = document.createElement('div');
    console.log("in showHeaderMappingModal");
    modal.innerHTML = `
        <div class="modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; border: 1px solid #ccc; padding: 1em; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 1000; width: 380px; max-width: 95%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-top:0;">Spalten zuordnen</h3>
            <p style="font-size:0.85rem;color:#555;margin:0 0 0.8em;">
                Jede <strong>Spalte der CSV-Datei</strong> (fett) wird einer Datenbankspalte zugeordnet.
                Nicht benötigte Spalten auf <em>Ignorieren</em> lassen.
            </p>
            <form id="headerMappingForm">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #ccc;font-size:0.85rem;color:#555;">CSV-Spalte</th>
                            <th style="text-align:left;padding:4px 6px;border-bottom:1px solid #ccc;font-size:0.85rem;color:#555;">→ Datenbankfeld</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${headers.map((h, i) => `
                            <tr>
                                <td style="padding:4px 6px;"><strong>${h}</strong></td>
                                <td style="padding:4px 6px;">
                                    <select data-index="${i}" style="width:100%;">
                                        ${knownHeaders.map(opt => `<option value="${opt}">${opt || 'Ignorieren'}</option>`).join('')}
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="display:flex;gap:8px;margin-top:1em;">
                    <button type="submit">Importieren</button>
                    <button type="button" id="headerMappingCancel">Abbrechen</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('headerMappingForm').onsubmit = e => {
        e.preventDefault();
        const mapping = Array.from(modal.querySelectorAll('select')).map(sel => sel.value);
        modal.remove();
        onConfirm(mapping);
    };

    document.getElementById('headerMappingCancel').onclick = () => { modal.remove(); if (onCancel) onCancel(); };
}
