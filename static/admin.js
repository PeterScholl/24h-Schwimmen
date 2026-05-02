import { showStatusMessage } from './mymodals.js'
import { initCSVImport, initJSONImport } from './csvImport.js'

// Globale Variablen für die Schwimmer und User Tabelle
let swimmerData = [];
let userData = [];
let tableCurrentPage = 1;
let tableRowsPerPage = 10;

const adminButton = document.getElementById("adminAktionen");
const adminMenu = document.getElementById("adminMenu");

adminButton.addEventListener("click", (e) => {
    adminMenu.style.left = e.pageX + "px";
    adminMenu.style.top = e.pageY + "px";
    adminMenu.style.display = "block";
});

document.addEventListener("click", (e) => {
    //console.log("click auf Target", e.target);
    if (e.target !== adminButton) {
        adminMenu.style.display = "none";
    }
});

document.getElementById("downloadBackupBtn")
    .addEventListener("click", () => window.open('/backupsql'));

document.getElementById("new_password_form").addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    fetch("/admin", {
        method: "POST",
        body: formData
    })
        .then(response => {
            return response.text().then(text => {
                showStatusMessage(text, response.ok);
            });
        })
        .catch(err => {
            showStatusMessage("NETZWERKFEHLER: " + err.message, false);
        });
});

function initNav() {
    //initialisiert die Naviagtionsleiste
    const navbar = document.getElementById('navbar');
    let button = document.createElement('button');
    button.innerText = "Benutzer";
    button.addEventListener('click', () => showUserTable());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "Clients";
    button.addEventListener('click', () => showClientTable());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "Schwimmer";
    button.addEventListener('click', () => showSwimmerTable());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "Aktionen";
    button.addEventListener('click', () => showActionsTable());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "Checks";
    button.addEventListener('click', () => showChecksSection());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "View";
    button.addEventListener('click', () => showViewSection());
    navbar.appendChild(button);
    button = document.createElement('button');
    button.innerText = "SchwimmerLog";
    button.addEventListener('click', () => showSchwimmerLog());
    navbar.appendChild(button);
}

function initAdminMenu() {
    const adminMenuUL = document.getElementById('adminMenu').querySelector('ul');
    let li = document.createElement('li');
    li.innerText = "Benutzer anlegen";
    li.addEventListener('click', () => showSection('adduser'));
    adminMenuUL.appendChild(li);
    li = document.createElement('li');
    li.innerText = "Schwimmer verwalten";
    li.addEventListener('click', () => showSection('swimmer'));
    adminMenuUL.appendChild(li);
    li = document.createElement('li');
    li.innerText = "Aktionen ansehen";
    li.addEventListener('click', () => showSection('actions'));
    adminMenuUL.appendChild(li);
    li = document.createElement('li');
    li.innerText = "QR - Code";
    li.addEventListener('click', () => showQRSection());
    adminMenuUL.appendChild(li);
}

function showSection(id) {
    document
        .querySelectorAll(".admin-section")
        .forEach((s) => (s.style.display = "none"));
    document.getElementById(id).style.display = "block";
}

// ************ Render User Table *****************
function showUserTable() {
    showSection('user');
    // Initiales Laden
    fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'get_table_benutzer' })
    })
        .then(response => response.json())
        .then(data => {
            userData = data;
            console.log("Userdaten gelesen", data);
            const section = document.querySelector('#user');
            section.innerHTML = '';
            const heading = document.createElement('h2');
            heading.textContent = `Benutzer (${data.length})`;
            heading.style.display = "inline-block";
            section.appendChild(heading);
            // Button um CSV herunterzuladen
            const csvbutton = document.createElement('Button');
            csvbutton.textContent = "CSV";
            csvbutton.style.margin = "0px 20px";
            csvbutton.addEventListener("click", () => downloadCSV(userData));
            section.appendChild(csvbutton);
            // Seitendarstellungskontrolle
            // Alle alten Divs paginationcontrol löschen - sollte maximal eins sein
            document.querySelectorAll('div#paginationControls').forEach(el => el.remove());
            const controls = document.createElement('div');
            controls.id = 'paginationControls';
            section.appendChild(controls);
            // Tabelle für die Daten
            const stable = document.createElement('table');
            stable.id = 'userTable';
            section.appendChild(stable);
            // Bereich für den Datenimport
            section.appendChild(document.createElement('hr'));
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'csvInput';
            section.appendChild(input);
            const div = document.createElement('div');
            div.id = 'csvPreviewContainer';
            section.appendChild(div);
            const button = document.createElement('button');
            button.id = "csvSend";
            button.innerText = 'Importieren';
            section.appendChild(button);
            initCSVImport('#csvInput', '#csvPreviewContainer', '#csvSend', { url: '/admin' });
            renderTable(userData, 'userTable', ['id', 'name', 'benutzername', 'admin'], { 'Del': delUser, 'Edit': editUser });
        })
        .catch(error => {
            console.error('Fehler beim Abrufen der Schwimmer-Daten:', error);
        });
}

function editUser(nummer) { //TODO
    alert(`Bearbeite Nutzer: ${nummer}`); // Placeholder
}

function delUser(nummer) {
    if (confirm(`Benutzer ${nummer} wirklich löschen?`)) {
        fetch('/admin', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "delete_user",
                nummer: nummer
            }),
        })
            .then(response => response.text().then(text => {
                if (response.ok) {
                    showStatusMessage(`Benutzer ${nummer} gelöscht`, true);
                    showUserTable();
                } else {
                    showStatusMessage(`Fehler beim Löschen:\n${text}`, false);
                }
            }))
            .catch(error => {
                showStatusMessage(`Netzwerkfehler: ${error}`, false);
                console.error('Netzwerkfehler:', error);
            });
    }
}



// ***************** Render Client Table ***************************
function showClientTable() {
    fetchAndFillTable('client', 'clientTable', 'get_table_clients', 'Clients');
}

// ************ Render Swimmer Table *****************
function showSwimmerTable() {
    showSection('swimmer');
    // Initiales Laden
    fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'get_table_swimmer' })
    })
        .then(response => response.json())
        .then(data => {
            swimmerData = data;
            console.log("Schwimmerdaten gelesen", data);
            const section = document.querySelector('#swimmer');
            section.innerHTML = '';
            const heading = document.createElement('h2');
            heading.textContent = `Schwimmer (${data.length})`;
            heading.style.display = "inline-block";
            section.appendChild(heading);
            // Button um CSV herunterzuladen
            const csvbutton = document.createElement('Button');
            csvbutton.textContent = "CSV";
            csvbutton.style.margin = "0px 20px";
            csvbutton.addEventListener("click", () => downloadCSV(swimmerData, ["nummer", "vorname", "nachname", "istKind", "gruppe", "bahnanzahl"]));
            section.appendChild(csvbutton);
            // Filter
            const filterWrap = document.createElement('div');
            filterWrap.style.margin = '8px 0';
            const filterLabel = document.createElement('label');
            filterLabel.textContent = 'Filter: ';
            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.id = 'swimmerFilter';
            filterInput.placeholder = 'Vorname, Nachname oder Gruppe…';
            filterInput.style.width = '220px';
            filterWrap.appendChild(filterLabel);
            filterWrap.appendChild(filterInput);
            section.appendChild(filterWrap);

            // Seitendarstellungskontrolle
            // Alle alten Divs paginationcontrol löschen - sollte maximal eins sein
            document.querySelectorAll('div#paginationControls').forEach(el => el.remove());
            const controls = document.createElement('div');
            controls.id = 'paginationControls';
            section.appendChild(controls);
            // Tabelle für die Daten
            const stable = document.createElement('table');
            stable.id = 'swimmerTable';
            section.appendChild(stable);
            // Bereich für den Datenimport
            section.appendChild(document.createElement('hr'));
            const importInfo = document.createElement('p');
            importInfo.style.cssText = 'font-size:0.9rem;color:#555;margin:6px 0 10px;';
            importInfo.innerHTML =
                '<strong>CSV-Import:</strong> Spalten der Datei werden im nächsten Schritt den Datenbankfeldern zugeordnet. ' +
                'Pflichtfeld ist <em>nummer</em>. ' +
                'Felder ohne Zuordnung (Ignorieren) bleiben unverändert.<br>' +
                'Existiert ein Schwimmer mit der Nummer bereits, werden nur Name, Gruppe und Kind-Flag aktualisiert — ' +
                'geschwommene Bahnen und der Aktiv-Status bleiben erhalten.';
            section.appendChild(importInfo);
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'csvInput';
            section.appendChild(input);
            const div = document.createElement('div');
            div.id = 'csvPreviewContainer';
            section.appendChild(div);
            const button = document.createElement('button');
            button.id = "csvSend";
            button.innerText = 'Importieren';
            section.appendChild(button);
            initCSVImport('#csvInput', '#csvPreviewContainer', '#csvSend', { url: '/admin',
                knownHeaders: ['', 'nummer', 'vorname', 'nachname', 'istKind', 'istErw', 'gruppe']
             });

            const swimmerHeader = ['nummer', 'vorname', 'nachname', 'istKind', 'gruppe', 'bahnanzahl', 'auf_bahn', 'aktiv'];
            const swimmerAktionen = { 'Del': deleteSwimmer, 'Edit': editSwimmer };

            function applySwimmerFilter() {
                const term = filterInput.value.trim().toLowerCase();
                const filtered = term
                    ? swimmerData.filter(s =>
                        ['vorname', 'nachname', 'gruppe'].some(f => (s[f] ?? '').toLowerCase().includes(term)))
                    : swimmerData;
                tableCurrentPage = 1;
                renderTable(filtered, 'swimmerTable', swimmerHeader, swimmerAktionen);
            }

            filterInput.addEventListener('input', applySwimmerFilter);
            renderTable(swimmerData, 'swimmerTable', swimmerHeader, swimmerAktionen);
        })
        .catch(error => {
            console.error('Fehler beim Abrufen der Schwimmer-Daten:', error);
        });
}

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


function renderTable(data, table_id, header = ['nummer', 'name', 'bahnanzahl', 'auf_bahn', 'aktiv'], aktionen = {}) {
    const table = document.getElementById(table_id);
    table.innerHTML = ''; // Erst mal löschen
    table.style.margin = '5px auto';

    console.log(`Aktionen: ${aktionen}`);

    // Tabellen-Header erzeugen
    const headerRow = document.createElement('tr');
    header.concat((Object.keys(aktionen).length > 0 ? ['Aktionen'] : [])).forEach(key => {
        const th = document.createElement('th');
        th.textContent = capitalizeFirstLetter(key);
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Daten sortieren
    const sorted = [...data].sort((a, b) => parseInt(a.nummer) - parseInt(b.nummer));

    // Seitenanzahl
    const totalPages = tableRowsPerPage === 0 ? 1 : Math.ceil(data.length / tableRowsPerPage);
    tableCurrentPage = Math.min(tableCurrentPage, totalPages)
    const start = (tableCurrentPage - 1) * tableRowsPerPage;
    const pageData = tableRowsPerPage === 0 ? sorted : sorted.slice(start, start + tableRowsPerPage);

    pageData.forEach(entry => {
        //console.log("Entry",entry);
        const row = document.createElement('tr');
        // Zellen erstellen
        header.forEach(key => {
            const td = document.createElement('td');
            const val = entry[key] ? entry[key] : (entry[key] == 0 ? '0' : '');
            td.style.whiteSpace = 'nowrap';
            if (table_id === 'swimmerTable' && key === 'nummer') {
                const link = document.createElement('a');
                link.textContent = schwimmerNrLen > 0 ? String(val).padStart(schwimmerNrLen, '0') : val;
                link.href = '#';
                link.style.cssText = 'cursor:pointer;color:#0066cc;';
                link.addEventListener('click', e => { e.preventDefault(); showSchwimmerLog(val); });
                td.appendChild(link);
            } else {
                td.textContent = val;
            }
            row.appendChild(td);
        });

        // Aktionen
        if (Object.keys(aktionen).length > 0) {
            console.log("Creating Aktion TD");
            const actionTd = document.createElement('td');
            actionTd.style.whiteSpace = 'nowrap';
            for (const [key, value] of Object.entries(aktionen)) {
                const delBtn = document.createElement('button');
                delBtn.textContent = key;
                delBtn.onclick = () => value(entry[header[0].toLowerCase()]);
                actionTd.appendChild(delBtn);
            }
            row.appendChild(actionTd);
        }

        table.appendChild(row);
    });

    renderPaginationControls(data, table_id, header, aktionen);
}


function renderPaginationControls(data, table_id, header, aktionen = {}) {
    const controls = document.getElementById('paginationControls');
    controls.innerHTML = '';
    const totalPages = tableRowsPerPage === 0 ? 1 : Math.ceil(data.length / tableRowsPerPage);

    const back = document.createElement('button');
    back.textContent = 'Zurück';
    back.disabled = tableCurrentPage === 1;
    back.onclick = () => { tableCurrentPage--; renderTable(data, table_id, header, aktionen); };

    const next = document.createElement('button');
    next.textContent = 'Weiter';
    next.disabled = tableCurrentPage === totalPages;
    next.onclick = () => { tableCurrentPage++; renderTable(data, table_id, header, aktionen); };

    const label = document.createElement('span');
    label.innerText = 'Einträge pro Seite:';
    label.style.marginLeft = '20px';

    const select = document.createElement('select');
    select.style.margin = '0px 20px 0px 0px';
    [10, 20, 50, 0].forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size === 0 ? 'Alle' : size;
        if (tableRowsPerPage === size) option.selected = true;
        select.appendChild(option);
    });
    select.onchange = (e) => {
        tableRowsPerPage = parseInt(e.target.value);
        tableCurrentPage = 1;
        renderTable(data, table_id, header, aktionen);
    };

    controls.appendChild(back);
    controls.appendChild(label);
    controls.appendChild(select);
    controls.appendChild(next);
}

function editSwimmer(nummer) {
    const s = swimmerData.find(s => parseInt(s.nummer) === parseInt(nummer));
    if (!s) return;

    // Dialog einmalig anlegen oder wiederverwenden
    let dlg = document.getElementById('editSwimmerDialog');
    if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'editSwimmerDialog';
        dlg.style.cssText = 'padding:1.5rem; min-width:280px; border-radius:6px;';
        document.body.appendChild(dlg);
    }

    dlg.innerHTML = `
        <h3 style="margin-top:0">Schwimmer ${String(s.nummer).padStart(schwimmerNrLen, '0')} bearbeiten</h3>
        <label style="display:block;margin-bottom:6px">Vorname<br>
            <input id="esVorname" type="text" value="${s.vorname ?? ''}" style="width:100%;box-sizing:border-box">
        </label>
        <label style="display:block;margin-bottom:6px">Nachname<br>
            <input id="esNachname" type="text" value="${s.nachname ?? ''}" style="width:100%;box-sizing:border-box">
        </label>
        <label style="display:block;margin-bottom:6px">Gruppe<br>
            <input id="esGruppe" type="text" value="${s.gruppe ?? ''}" style="width:100%;box-sizing:border-box">
        </label>
        <label style="display:block;margin-bottom:12px">
            <input id="esIstKind" type="checkbox" ${s.istKind ? 'checked' : ''}> Kind
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="esSave">Speichern</button>
            <button id="esCancel">Abbrechen</button>
        </div>
    `;

    dlg.querySelector('#esCancel').onclick = () => dlg.close();
    dlg.querySelector('#esSave').onclick = () => {
        const payload = {
            action: 'edit_swimmer',
            nummer: nummer,
            vorname:  dlg.querySelector('#esVorname').value.trim(),
            nachname: dlg.querySelector('#esNachname').value.trim(),
            gruppe:   dlg.querySelector('#esGruppe').value.trim(),
            istKind:  dlg.querySelector('#esIstKind').checked ? 1 : 0,
        };
        fetch('/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(r => r.text().then(text => {
            if (r.ok) {
                // Lokale Daten aktualisieren
                Object.assign(s, { vorname: payload.vorname, nachname: payload.nachname,
                                   gruppe: payload.gruppe, istKind: payload.istKind });
                showStatusMessage(`Schwimmer ${nummer} gespeichert`, true);
                dlg.close();
                // Tabelle neu rendern mit aktuellem Filter
                const filterInput = document.getElementById('swimmerFilter');
                const term = filterInput ? filterInput.value.trim().toLowerCase() : '';
                const filtered = term
                    ? swimmerData.filter(s => ['vorname','nachname','gruppe'].some(f => (s[f]??'').toLowerCase().includes(term)))
                    : swimmerData;
                renderTable(filtered, 'swimmerTable',
                    ['nummer','vorname','nachname','istKind','gruppe','bahnanzahl','auf_bahn','aktiv'],
                    { 'Del': deleteSwimmer, 'Edit': editSwimmer });
            } else {
                showStatusMessage(`Fehler: ${text}`, false);
            }
        }));
    };

    dlg.showModal();
}

function deleteSwimmer(nummer) {
    if (confirm(`Schwimmer ${nummer} wirklich löschen?`)) {
        fetch('/admin', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "delete_swimmer",
                nummer: nummer
            }),
        })
            .then(response => response.text().then(text => {
                if (response.ok) {
                    showStatusMessage(`Benutzer ${nummer} gelöscht`, true);
                    showSwimmerTable();
                } else {
                    showStatusMessage(`Fehler beim Löschen:\n${text}`, false);
                }
            }))
            .catch(error => {
                showStatusMessage(`Netzwerkfehler: ${error}`, false);
                console.error('Netzwerkfehler:', error);
            });
    }
}

// *****************Ende Swimmer-Tabelle **************

// --- Paginierter State für die Actions-Tabelle ---
let actionsPage  = 1;
let actionsLimit = 50; // Einträge pro Seite

function showActionsTable() {
    actionsPage = 1; // beim Öffnen immer auf Seite 1 (= neueste Einträge)
    showSection('actions');
    fetchActionsPage();
}

function fetchActionsPage() {
    fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'get_table_actions_paged',
            page:   actionsPage,
            limit:  actionsLimit
        })
    })
    .then(r => r.json())
    .then(resp => renderActionsTable(resp))
    .catch(err => console.error('Fehler beim Laden der Actions:', err));
}

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function formatZeitstempel(isoString) {
    try {
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const tag = WOCHENTAGE[d.getDay()];
        const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${tag} ${zeit}`;
    } catch {
        return isoString ?? '';
    }
}

function renderActionsTable({ data, total, page, limit }) {
    const section = document.getElementById('actions');
    section.innerHTML = '';

    // Überschrift mit Gesamtanzahl
    const heading = document.createElement('h2');
    const totalPages = Math.ceil(total / limit);
    heading.textContent = `Aktionen (${total} gesamt) – Seite ${page} / ${totalPages}`;
    section.appendChild(heading);

    // Steuerleiste: Einträge pro Seite + Navigation
    const controls = document.createElement('div');
    controls.style.margin = '8px 0';

    const selectLabel = document.createElement('span');
    selectLabel.textContent = 'Einträge pro Seite: ';
    controls.appendChild(selectLabel);

    const select = document.createElement('select');
    select.style.marginRight = '16px';
    [25, 50, 100, 250].forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        if (n === actionsLimit) opt.selected = true;
        select.appendChild(opt);
    });
    select.onchange = e => {
        actionsLimit = parseInt(e.target.value);
        actionsPage  = 1;
        fetchActionsPage();
    };
    controls.appendChild(select);

    const btnPrev = document.createElement('button');
    btnPrev.textContent = '← Neuer';
    btnPrev.disabled = page <= 1;
    btnPrev.onclick = () => { actionsPage--; fetchActionsPage(); };
    controls.appendChild(btnPrev);

    const pageInfo = document.createElement('span');
    pageInfo.textContent = ` Seite ${page} / ${totalPages} `;
    pageInfo.style.margin = '0 8px';
    controls.appendChild(pageInfo);

    const btnNext = document.createElement('button');
    btnNext.textContent = 'Älter →';
    btnNext.disabled = page >= totalPages;
    btnNext.onclick = () => { actionsPage++; fetchActionsPage(); };
    controls.appendChild(btnNext);

    const jumpLabel = document.createElement('span');
    jumpLabel.textContent = '  Seite: ';
    jumpLabel.style.marginLeft = '16px';
    controls.appendChild(jumpLabel);

    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = 1;
    jumpInput.max = totalPages;
    jumpInput.value = page;
    jumpInput.style.cssText = 'width: 60px; margin-right: 4px;';
    jumpInput.onkeydown = e => {
        if (e.key === 'Enter') {
            const target = parseInt(jumpInput.value);
            if (target >= 1 && target <= totalPages) {
                actionsPage = target;
                fetchActionsPage();
            }
        }
    };
    controls.appendChild(jumpInput);

    const btnJump = document.createElement('button');
    btnJump.textContent = 'Gehe zu';
    btnJump.onclick = () => {
        const target = parseInt(jumpInput.value);
        if (target >= 1 && target <= totalPages) {
            actionsPage = target;
            fetchActionsPage();
        }
    };
    controls.appendChild(btnJump);

    section.appendChild(controls);

    // Tabelle
    const table = document.createElement('table');
    table.style.margin = '5px auto';
    if (data.length === 0) {
        table.innerHTML = '<tr><th>Keine Einträge</th></tr>';
    } else {
        const headerRow = document.createElement('tr');
        Object.keys(data[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        data.forEach(entry => {
            const row = document.createElement('tr');
            Object.entries(entry).forEach(([key, value]) => {
                const td = document.createElement('td');
                td.classList.add('truncated');
                td.textContent = key === 'zeitstempel' ? formatZeitstempel(value) : (value ?? '');
                row.appendChild(td);
            });
            table.appendChild(row);
        });
    }
    section.appendChild(table);
}

function showChecksSection() {
    showSection('checks');
    const checkSection = document.getElementById('checks');
    checkSection.innerHTML = ''; // erst leeren 
    let button = document.createElement('button');
    button.innerText = "Anzahlen Prüfen";
    button.addEventListener('click', (e) => fetchAndFillTable(null, 'checkAnzahlenTable', 'get_checkAnzahlTable', 'Anzahlen'));
    checkSection.appendChild(button);
    const info = document.createElement('span');
    info.innerText = "Gibt Schwimmer aus, bei denen die Anzahlen in Actions nicht denen in der Schwimmer-Tabelle entspricht"
    checkSection.appendChild(info);
    let table = document.createElement('table');
    table.id = "checkAnzahlenTable";
    checkSection.appendChild(table);
    let heading = document.createElement('h2');
    heading.innerText = "ACTIONS importieren (JSON)";
    checkSection.appendChild(heading);
    // Bereich für die ImportDaten
    const adiv = document.createElement('div');
    adiv.id = 'actionsDiv';
    checkSection.appendChild(adiv);
    // Bereich für den Datenimport
    checkSection.appendChild(document.createElement('hr'));
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'jsonInput';
    checkSection.appendChild(input);
    const div = document.createElement('div');
    div.id = 'jsonPreviewContainer';
    checkSection.appendChild(div);
    button = document.createElement('button');
    button.id = "jsonSend";
    button.innerText = 'Importieren';
    checkSection.appendChild(button);
    initJSONImport('#jsonInput', '#jsonPreviewContainer', '#jsonSend', { url: '/action'});

}

function showViewSection() {
    showSection('view');
    const section = document.getElementById('view');
    section.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'View-Seite';
    section.appendChild(heading);

    // Buttons: View / View2 in neuem Fenster öffnen
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px;';
    const openBtn = document.createElement('button');
    openBtn.textContent = 'View2 in neuem Fenster öffnen';
    openBtn.style.cssText = 'font-size: 1rem; padding: 8px 16px; cursor: pointer;';
    openBtn.addEventListener('click', () => window.open('/view2', '_blank'));
    const openBtn2 = document.createElement('button');
    openBtn2.textContent = 'View (alt) in neuem Fenster öffnen';
    openBtn2.style.cssText = 'font-size: 1rem; padding: 8px 16px; cursor: pointer;';
    openBtn2.addEventListener('click', () => window.open('/view', '_blank'));
    btnRow.appendChild(openBtn);
    btnRow.appendChild(openBtn2);
    section.appendChild(btnRow);

    // Tastenkombinationen – aufgeteilt auf zwei Tabellen nebeneinander
    const shortcuts = [
        ['Shift + D', 'CSV-Datei herunterladen'],
        ['Shift + B', 'JSON-Backup der Actions herunterladen'],
        ['Shift + Z', 'Ein-/zweispaltige Darstellung wechseln'],
        ['Shift + G', 'Gruppentabelle ein-/ausblenden'],
        ['Shift + N', 'Nachnamen ein-/ausblenden'],
        ['Shift + U', 'Anzeige Bahnen ↔ Strecke (Meter)'],
        ['Shift + F', 'Footer ein-/ausblenden'],
        ['Shift + P', 'Platzierung ausblenden / Nummer fett (nur View2)'],
        ['Shift + 1', 'Auto-Intervall –1 Sekunde (nur View2)'],
        ['Shift + 2', 'Auto-Intervall +1 Sekunde (nur View2)'],
        ['Shift + 3', 'Letzte Bahnen: –1 Zeile (nur View2)'],
        ['Shift + 4', 'Letzte Bahnen: +1 Zeile (nur View2)'],
        ['Shift + L', 'Shift-Lock (Kürzel ohne Shift-Taste)'],
        ['Strg + +', 'Schriftgröße vergrößern'],
        ['Strg + −', 'Schriftgröße verkleinern'],
    ];

    const cellStyle = 'padding: 5px 10px; border: 1px solid #bbb;';
    const thStyle   = cellStyle + 'background: #e8eaf0; font-weight: bold; white-space: nowrap;';
    const keyStyle  = cellStyle + 'font-family: monospace; white-space: nowrap;';

    function buildTable(rows) {
        const t = document.createElement('table');
        t.style.cssText = 'border-collapse: collapse; margin: 8px;';
        const hr = document.createElement('tr');
        ['Tastenkombination', 'Funktion'].forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            th.style.cssText = thStyle;
            hr.appendChild(th);
        });
        t.appendChild(hr);
        rows.forEach(([key, desc]) => {
            const row = document.createElement('tr');
            const tdKey = document.createElement('td');
            tdKey.textContent = key;
            tdKey.style.cssText = keyStyle;
            const tdDesc = document.createElement('td');
            tdDesc.textContent = desc;
            tdDesc.style.cssText = cellStyle;
            row.appendChild(tdKey);
            row.appendChild(tdDesc);
            t.appendChild(row);
        });
        return t;
    }

    const half = Math.ceil(shortcuts.length / 2);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px;';
    wrapper.appendChild(buildTable(shortcuts.slice(0, half)));
    wrapper.appendChild(buildTable(shortcuts.slice(half)));
    section.appendChild(wrapper);
}

function showQRSection() {
    showSection('qr');
    const section = document.getElementById('qr');
    section.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'QR-Code';
    section.appendChild(heading);

    // Checkbox + Zahlenfeld für size-Parameter
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'qrSizeCheck';

    const label = document.createElement('label');
    label.htmlFor = 'qrSizeCheck';
    label.textContent = 'size-Parameter setzen:';

    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'qrSizeInput';
    input.value = '5';
    input.min = '1';
    input.max = '20';
    input.style.cssText = 'width: 4em; padding: 4px;';
    input.disabled = true;

    checkbox.addEventListener('change', () => { input.disabled = !checkbox.checked; });

    row.appendChild(checkbox);
    row.appendChild(label);
    row.appendChild(input);
    section.appendChild(row);

    const btn = document.createElement('button');
    btn.textContent = 'QR-Code öffnen';
    btn.style.cssText = 'font-size: 1rem; padding: 8px 16px; cursor: pointer;';
    btn.addEventListener('click', () => {
        const base = window.location.origin;
        let url;
        if (checkbox.checked && input.value) {
            url = base + '/v2?size=' + encodeURIComponent(input.value);
        } else {
            url = base;
        }
        window.open('/show_qr?ip=' + encodeURIComponent(url), '_blank');
    });
    section.appendChild(btn);
}

function fetchAndFillTable(sectionId, tableId, actionName, titleName) {
    if (sectionId) showSection(sectionId);
    fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: actionName })
    })
        .then(response => response.json())
        .then(data => {
            console.log(`${titleName}-Table füllen, data.length`, data.length);

            if (sectionId) {
                const sectionTitle = document.querySelector(`#${sectionId} h2`);
                sectionTitle.textContent = `${titleName} (${data.length})`;
            }
            const table = document.getElementById(tableId);
            table.innerHTML = '';

            if (data.length > 0) {
                const headerRow = document.createElement('tr');
                Object.keys(data[0]).forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key.charAt(0).toUpperCase() + key.slice(1);
                    headerRow.appendChild(th);
                });
                table.appendChild(headerRow);

                data.forEach(entry => {
                    const row = document.createElement('tr');
                    Object.values(entry).forEach(value => {
                        const td = document.createElement('td');
                        td.classList.add('truncated');
                        td.textContent = value;
                        row.appendChild(td);
                    });
                    table.appendChild(row);
                });
            } else { //Data length == 0 - leere Rückgabe
                const headerRow = document.createElement('tr');
                const th = document.createElement('th');
                th.textContent = "Leere Tabelle"
                headerRow.appendChild(th);
                table.appendChild(headerRow);
            }
        })
        .catch(error => {
            console.error(`Fehler beim Abrufen der ${titleName}-Daten:`, error);
        });
}

function downloadCSV(data, customHeaders = null) {
    if (!data.length) return;

    const headers = customHeaders || Object.keys(data[0]);
    const csvRows = [
        headers.join(','), // Kopfzeile
        ...data.map(obj =>
            headers.map(header => `"${(obj[header] ?? '').toString().replace(/"/g, '""')}"`).join(',')
        )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "schwimmerdaten.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function createUser(event) {
    event.preventDefault();

    const realname = document.getElementById("realname").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const isAdmin = document.getElementById("admin").checked;

    console.log("Benuzter anlegen", realname, username, isAdmin);
    const nameValid = /^[A-Za-zÄÖÜäöüß\s]+$/.test(realname);
    const usernameValid = /^[A-Za-z0-9]+$/.test(username);
    const passwordValid = password.length >= 3; // einfache Mindestlänge

    if (!nameValid || !usernameValid || !passwordValid) {
        alert("Bitte gültige Eingaben machen:\n- Name: nur Buchstaben/Leerzeichen\n- Benutzername: nur Buchstaben/Zahlen\n- Passwort: min. 6 Zeichen");
        return;
    }

    fetch("/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "create_user",
            realname,
            username,
            password,
            admin: isAdmin
        }),
    })
        .then((res) => res.text())
        .then((msg) => alert(msg));
}

// ── SchwimmerLog ──────────────────────────────────────────────────────────────

function showSchwimmerLog(nummer) {
    showSection('swimmerlog');
    const section = document.getElementById('swimmerlog');
    section.innerHTML = '';

    const heading = document.createElement('h2');
    heading.textContent = 'Schwimmer-Protokoll';
    section.appendChild(heading);

    const form = document.createElement('div');
    form.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 16px;';

    const label = document.createElement('label');
    label.textContent = 'Schwimmernummer:';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.style.cssText = 'width: 6em; padding: 4px;';
    input.placeholder = 'Nummer';
    if (nummer) input.value = nummer;

    const btn = document.createElement('button');
    btn.textContent = 'Protokoll laden';
    btn.style.cssText = 'padding: 4px 14px; cursor: pointer;';

    const resultDiv = document.createElement('div');
    resultDiv.id = 'swimmerLogResult';

    btn.addEventListener('click', () => loadSchwimmerLog(parseInt(input.value), resultDiv));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(btn);
    section.appendChild(form);
    section.appendChild(resultDiv);

    if (nummer) loadSchwimmerLog(parseInt(nummer), resultDiv);
}

function loadSchwimmerLog(nummer, resultDiv) {
    if (!nummer) return;
    resultDiv.innerHTML = '<em>Lade…</em>';
    fetch('/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_swimmer_log', nummer })
    })
        .then(r => r.json())
        .then(data => renderSchwimmerLog(data, resultDiv))
        .catch(() => { resultDiv.innerHTML = '<em>Fehler beim Laden.</em>'; });
}

function renderSchwimmerLog(data, resultDiv) {
    resultDiv.innerHTML = '';
    const s = data.schwimmer;
    if (!s || !s.nummer) {
        resultDiv.innerHTML = '<em>Schwimmer nicht gefunden.</em>';
        return;
    }

    const numStr = String(s.nummer).padStart(schwimmerNrLen, '0');
    const info = document.createElement('div');
    info.style.cssText = 'background:#e8eaf0;padding:10px 14px;border-radius:6px;margin-bottom:14px;line-height:1.7;';
    info.innerHTML =
        `<strong>#${numStr} – ${s.vorname || ''} ${s.nachname || ''}</strong>` +
        ` &nbsp;|&nbsp; Gruppe: <strong>${s.gruppe || '–'}</strong>` +
        ` &nbsp;|&nbsp; ${s.istKind ? 'Kind' : 'Erwachsener'}` +
        ` &nbsp;|&nbsp; Bahnen gesamt: <strong>${s.bahnanzahl ?? 0}</strong>`;
    resultDiv.appendChild(info);

    const actions = data.actions || [];
    if (actions.length === 0) {
        resultDiv.appendChild(document.createTextNode('Keine Einträge vorhanden.'));
        return;
    }

    const thStyle = 'padding:5px 10px;border:1px solid #bbb;background:#e8eaf0;text-align:left;white-space:nowrap;';
    const tdStyle = 'padding:5px 10px;border:1px solid #ddd;white-space:nowrap;';
    const tdDeltaStyle = tdStyle + 'color:#555;font-style:italic;';
    const tdActStyle  = tdStyle + 'color:#c07000;';

    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    ['Zeit (lokal)', 'Kommando', 'Bahn-Nr', 'Wert / Aktion', 'Δt zum Vorherigen'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.style.cssText = thStyle;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let lastAddTime = null;

    actions.forEach((a, i) => {
        const row = document.createElement('tr');
        row.style.background = i % 2 === 0 ? '#fff' : '#f5f7ff';

        const ts = new Date(a.zeitstempel);
        const timeStr = ts.toLocaleString('de-DE', {
            weekday: 'short', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        let params = [];
        try { params = JSON.parse(a.parameter); } catch (_) {}

        let bahnNr = '';
        let wert = '';
        let isAct = false;

        if (a.kommando === 'ADD') {
            const n = params[1] ?? 1;
            bahnNr = params[2] ? String(params[2]) : '';
            wert = (n >= 0 ? `+${n}` : `${n}`) + ` Bahn${Math.abs(n) !== 1 ? 'en' : ''}`;
        } else if (a.kommando === 'ACT') {
            const aktiv = (params[1] === 1 || params[1] === '1');
            wert = `Aktiv: ${aktiv ? 'ja ✓' : 'nein ✗'}`;
            isAct = true;
        } else {
            wert = params.slice(1).join(', ');
        }

        let delta = '';
        if (a.kommando === 'ADD') {
            if (lastAddTime !== null) {
                const diffSec = Math.round((ts - lastAddTime) / 1000);
                const min = Math.floor(diffSec / 60);
                const sec = diffSec % 60;
                delta = min > 0 ? `${min} min ${sec} s` : `${sec} s`;
            }
            lastAddTime = ts;
        }

        [timeStr, a.kommando, bahnNr, wert, delta].forEach((val, ci) => {
            const td = document.createElement('td');
            td.textContent = val;
            if (ci === 4) td.style.cssText = tdDeltaStyle;
            else if (ci === 3 && isAct) td.style.cssText = tdActStyle;
            else td.style.cssText = tdStyle;
            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    resultDiv.appendChild(table);
}

//Navigationsleiste initialisieren
initNav();
// Admin-Menü (hambuger-Menü-links) initialisieren
initAdminMenu();
// Create User bekannt machen
window.createUser = createUser;

document.addEventListener("DOMContentLoaded", () => showSection("adduser"));
