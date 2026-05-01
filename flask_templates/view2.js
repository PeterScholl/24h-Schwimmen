const { useState, useEffect, useRef } = React;

const pageIntervalMs = {{page_interval}} * 1000;
const bahnLaenge = parseInt("{{bahnlaenge}}");

let lastupdate = new Date("2000-01-01T00:00:00Z").toISOString();
const offsetInMinutes = new Date().getTimezoneOffset();
const offsetInMillis = -offsetInMinutes * 60 * 1000;
const NUMMER_LAENGE = 3;

function gibNeueEintraege(neueListe, vorhandeneListe) {
    return neueListe.filter(neu =>
        !vorhandeneListe.some(alt =>
            alt.kommando === neu.kommando &&
            alt.parameter === neu.parameter &&
            alt.zeitstempel === neu.zeitstempel
        )
    );
}

const formatNummer = (nummer) => nummer.toString().padStart(NUMMER_LAENGE, '0');

function App() {
    let curSwimmerMap = {};
    let curActions = [];
    const [swimmerMap, setSwimmerMap] = useState({});
    const [filterAuswahl, setFilterAuswahl] = useState("");
    const [shiftLockAktiv, setShiftLockAktiv] = useState(false);
    const [zweispaltigAktiv, setZweispaltigAktiv] = useState(true);
    const [gruppenAnzeigeAktiv, setGruppenAnzeigeAktiv] = useState(true);
    const [unitMeterAktiv, setUnitMeterAktiv] = useState(true);
    const [nachnameAnzeigenAktiv, setNachnameAnzeigenAktiv] = useState(false);
    const [footerAktiv, setFooterAktiv] = useState(true);
    const [ohneRangAktiv, setOhneRangAktiv] = useState(false);
    const [fontSize, setFontSize] = useState(16);
    const swimmerMapRef = useRef(swimmerMap);
    const [lapLog, setLapLog] = useState([]);
    const [filter, setFilter] = useState({ gruppe: null, nurKinder: false, sortierung: "bahnanzahl" });

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const totalPagesRef = useRef(1);

    // DOM-Ref für Höhenmessung
    const tableAreaRef = useRef();

    let spezialzeiten = [];

    function gibZeitZukunft(zeit, stunden, minuten) {
        const basis = new Date(zeit);
        basis.setHours(basis.getHours() + stunden);
        basis.setMinutes(basis.getMinutes() + minuten);
        return basis;
    }

    function initSpezialzeiten(startzeit = new Date()) {
        spezialzeiten = [
            { name: "Tag1",          start: startzeit,                        end: gibZeitZukunft(startzeit, 12, 0) },
            { name: "Geisterstunde", start: gibZeitZukunft(startzeit, 12, 0), end: gibZeitZukunft(startzeit, 13, 0) },
            { name: "Gute Nacht",    start: gibZeitZukunft(startzeit, 13, 0), end: gibZeitZukunft(startzeit, 17, 0) },
            { name: "Frühaufsteher", start: gibZeitZukunft(startzeit, 17, 0), end: gibZeitZukunft(startzeit, 18, 0) },
            { name: "Tag2",          start: gibZeitZukunft(startzeit, 18, 0), end: gibZeitZukunft(startzeit, 48, 0) }
        ];
    }

    function downloadCSV(headers = ["vorname", "nachname", "gruppe", "bahnanzahl"]) {
        const maxID = Math.max(...Object.keys(curSwimmerMap).map(s => parseInt(s)));
        const headersspezial = spezialzeiten.map((szeit) => szeit.name);
        headers = headers.concat(headersspezial);
        let csvRows = ["nummer," + headers.join(',')];
        for (let i = 0; i < maxID; i++) {
            if (curSwimmerMap[i + 1]) {
                csvRows.push(`${i + 1},` +
                    headers.map(header => {
                        let value = curSwimmerMap[i + 1][header] ?? '';
                        const isNumeric = typeof value === 'number' || !isNaN(value);
                        if (isNumeric) value *= bahnLaenge;
                        const stringValue = value.toString().replace(/"/g, '""');
                        return isNumeric ? stringValue : `"${stringValue}"`;
                    }).join(',')
                );
            } else {
                csvRows.push(`${i + 1},` + headers.map(() => `"0"`).join(','));
            }
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "schwimmerdaten.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function transformData(eintrag) {
        return { kommando: eintrag.kommando, parameter: JSON.parse(eintrag.parameter), timestamp: eintrag.zeitstempel, transmitted: false };
    }

    function downloadJSON() {
        const data = { "schwimmer": curSwimmerMap, "actions": curActions.map(transformData) };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "view_backup.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function updateBahnen(schwimmerID, anzahl = 1, zeit = new Date().toISOString()) {
        if (curSwimmerMap[schwimmerID]) {
            const s = { ...curSwimmerMap[schwimmerID] };
            s.bahnanzahl += anzahl;
            const zeitD = new Date(zeit);
            spezialzeiten.forEach((t) => {
                if (zeitD >= t.start && zeitD < t.end) {
                    s[t.name] = (s[t.name] ? s[t.name] + anzahl : 1);
                }
            });
            curSwimmerMap[schwimmerID] = s;
            setSwimmerMap({ ...curSwimmerMap });
            const lzeit = new Date((new Date(zeit)).getTime() + offsetInMillis);
            setLapLog((prev) => [{ schwimmer: schwimmerID, zeit: lzeit.toISOString(), laps: s.bahnanzahl, vorname: s.vorname }, ...prev.slice(0, 19)]);
        }
    }

    function holeNeueDaten(since) {
        fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "VIEW", 'parameter': (since ? [since] : []), 'timestamp': new Date().toISOString() }])
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.swimmerMap) {
                    data.swimmerMap.forEach(s => {
                        s.bahnanzahl = 0;
                        spezialzeiten.forEach(szeit => s[szeit.name] = 0);
                        curSwimmerMap[s.nummer] = s;
                    });
                    setSwimmerMap({ ...curSwimmerMap });
                }
                if (data.lapLog) setLapLog(data.lapLog);
                if (data.actions) {
                    let datasorted = data.actions.filter((x) => x.kommando == "ADD");
                    datasorted.sort((a, b) => a.zeitstempel.localeCompare(b.zeitstempel));
                    const neueElemente = gibNeueEintraege(datasorted, curActions);
                    neueElemente.forEach(element => {
                        curActions.push(element);
                        const parameter = JSON.parse(element.parameter);
                        if (curSwimmerMap[parameter[0]]) {
                            if (lastupdate < element.zeitstempel) lastupdate = element.zeitstempel;
                            updateBahnen(parseInt(parameter[0]), parseInt(parameter[1]), element.zeitstempel);
                        }
                    });
                }
                if (data.filter) setFilter(data.filter);
            })
            .catch((err) => console.error("Fehler beim Laden:", err));
    }

    useEffect(() => { swimmerMapRef.current = swimmerMap; }, [swimmerMap]);
    useEffect(() => { document.documentElement.style.setProperty('--font-size', fontSize + 'px'); }, [fontSize]);

    // Tastaturkürzel
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.shiftKey && e.key === "L") {
                setShiftLockAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "D") {
                downloadCSV();
            } else if (e.shiftKey && e.key === "Z") {
                setZweispaltigAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "G") {
                setGruppenAnzeigeAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "N") {
                setNachnameAnzeigenAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "U") {
                setUnitMeterAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "B") {
                downloadJSON();
            } else if (e.ctrlKey && e.key === '+') {
                setFontSize(size => Math.min(size + 1, 40));
                e.preventDefault();
            } else if (e.ctrlKey && e.key === '-') {
                setFontSize(size => Math.max(size - 1, 8));
                e.preventDefault();
            } else if (e.shiftKey && e.key === "F") {
                setFooterAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "P") {
                setOhneRangAktiv((prev) => !prev);
            } else if (e.key === "ArrowRight") {
                setCurrentPage(p => Math.min(p + 1, totalPagesRef.current - 1));
            } else if (e.key === "ArrowLeft") {
                setCurrentPage(p => Math.max(p - 1, 0));
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Initialer Datenladeaufruf
    useEffect(() => {
        holeNeueDaten();
        initSpezialzeiten(new Date("2025-06-14T08:00:00Z"));
    }, []);

    // Periodische Aktualisierung
    useEffect(() => {
        const interval10 = setInterval(() => {
            const date = new Date(lastupdate);
            date.setHours(date.getHours() - 1);
            holeNeueDaten(date);
        }, 10000);
        return () => clearInterval(interval10);
    }, []);

    // Automatischer Seitenwechsel bei aktivem Shift-Lock
    useEffect(() => {
        if (!shiftLockAktiv) return;
        const timer = setInterval(() => {
            setCurrentPage(p => (p + 1) % Math.max(1, totalPagesRef.current));
        }, pageIntervalMs);
        return () => clearInterval(timer);
    }, [shiftLockAktiv]);

    // Höhenmessung → itemsPerPage berechnen
    useEffect(() => {
        function measure() {
            if (!tableAreaRef.current) return;

            // Probe-Zeile einfügen, Höhe messen, sofort entfernen
            const probeTable = document.createElement('table');
            probeTable.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font-size:' + fontSize + 'px';
            const probeRow = document.createElement('tr');
            ['#', 'Name', 'Gruppe', 'Wert'].forEach(t => {
                const td = document.createElement('td');
                td.textContent = t;
                td.style.padding = '4px';
                probeRow.appendChild(td);
            });
            probeTable.appendChild(probeRow);
            tableAreaRef.current.appendChild(probeTable);
            const rowH = probeRow.getBoundingClientRect().height;
            tableAreaRef.current.removeChild(probeTable);

            if (rowH > 0) {
                // 1 Thead-Zeile abziehen; rest durch Zeilenhöhe ergibt Anzahl Datenzeilen
                const available = tableAreaRef.current.clientHeight - rowH;
                // In zweispaltiger Darstellung passen doppelt so viele Einträge
                const cols = zweispaltigAktiv ? 2 : 1;
                const neu = Math.max(1, Math.floor(available / rowH) * cols);
                setItemsPerPage(neu);
            }
        }
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [fontSize, zweispaltigAktiv]);

    // Seite zurücksetzen wenn Filter oder itemsPerPage sich ändern
    useEffect(() => { setCurrentPage(0); }, [filterAuswahl, itemsPerPage]);

    // ── Daten für aktuelle Seite ──────────────────────────────────────────────

    let gefiltert = Object.values(swimmerMap);
    if (filterAuswahl === "nurKinder") {
        gefiltert = gefiltert.filter((s) => s.istKind);
    } else if (filterAuswahl.startsWith("gruppe-")) {
        gefiltert = gefiltert.filter((s) => s.gruppe === filterAuswahl.split("-")[1]);
    }
    gefiltert.sort((a, b) => b.bahnanzahl - a.bahnanzahl);

    const totalPages = Math.max(1, Math.ceil(gefiltert.length / itemsPerPage));
    totalPagesRef.current = totalPages;
    const safeCurrentPage = Math.min(currentPage, totalPages - 1);
    const pageOffset = safeCurrentPage * itemsPerPage;
    const pageSchwimmer = gefiltert.slice(pageOffset, pageOffset + itemsPerPage);

    // Zweispaltige Aufteilung nur für die aktuelle Seite
    const pageHalf = Math.ceil(pageSchwimmer.length / 2);
    const pageErsteHaelfte = pageSchwimmer.slice(0, pageHalf);
    const pageZweiteHaelfte = pageSchwimmer.slice(pageHalf);

    // Gruppenranking (aus allen Schwimmern, nicht nur der aktuellen Seite)
    const gruppenRanking = {};
    if (gruppenAnzeigeAktiv) {
        Object.values(swimmerMap).forEach(s => {
            const gruppe = s.gruppe || '–';
            gruppenRanking[gruppe] = (gruppenRanking[gruppe] || 0) + (s.bahnanzahl || 0);
        });
    }
    delete gruppenRanking['–'];
    const gruppenArray = Object.entries(gruppenRanking).sort((a, b) => b[1] - a[1]);

    // ── Hilfsfunktion: Tabellenzeile rendern ─────────────────────────────────

    function renderRow(s, rang) {
        const nameInhalt = ohneRangAktiv
            ? React.createElement('td', { className: 'col-name' },
                React.createElement('strong', null, formatNummer(s.nummer)),
                ` ${s.vorname}${nachnameAnzeigenAktiv ? ' ' + s.nachname : ''}`)
            : React.createElement('td', { className: 'col-name' },
                `(${formatNummer(s.nummer)}) ${s.vorname}${nachnameAnzeigenAktiv ? ' ' + s.nachname : ''}`);
        return React.createElement('tr', { key: s.nummer },
            ohneRangAktiv ? null : React.createElement('td', { className: 'col-rang' }, rang),
            nameInhalt,
            React.createElement('td', { className: 'col-gruppe' }, s.gruppe),
            React.createElement('td', { className: 'col-wert' }, unitMeterAktiv ? s.bahnanzahl * bahnLaenge : s.bahnanzahl)
        );
    }

    function renderThead() {
        return React.createElement('thead', null,
            React.createElement('tr', null,
                ohneRangAktiv ? null : React.createElement('th', { className: 'col-rang' }, '#'),
                React.createElement('th', { className: 'col-name' }, 'Name'),
                React.createElement('th', { className: 'col-gruppe' }, 'Gruppe'),
                React.createElement('th', { className: 'col-wert' }, unitMeterAktiv ? 'Strecke(m)' : 'Bahnen')
            )
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return React.createElement('div', { id: 'root' },

        // Linke Spalte: Ranking mit Pagination
        React.createElement('div', { className: 'left' },

            // Paginierungsleiste
            React.createElement('div', { className: 'pagination-bar' },
                React.createElement('button', {
                    onClick: () => setCurrentPage(p => Math.max(0, p - 1)),
                    disabled: safeCurrentPage === 0
                }, '◀'),
                React.createElement('span', { className: 'page-info' },
                    `Seite ${safeCurrentPage + 1} / ${totalPages}`
                ),
                React.createElement('button', {
                    onClick: () => setCurrentPage(p => Math.min(totalPages - 1, p + 1)),
                    disabled: safeCurrentPage >= totalPages - 1
                }, '▶'),
                React.createElement('span', { className: 'auto-status' },
                    shiftLockAktiv ? '🔄 Auto: Ein' : '⏸ Auto: Aus'
                )
            ),

            // Überschrift + Filter
            React.createElement('div', {
                style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }
            },
                React.createElement('h2', { style: { margin: '0 0 4px' } }, 'Ranking'),
                React.createElement('select', {
                    value: filterAuswahl,
                    onChange: (e) => setFilterAuswahl(e.target.value)
                },
                    React.createElement('option', { value: '' }, 'Alle anzeigen'),
                    React.createElement('option', { value: 'nurKinder' }, 'Nur Kinder')
                )
            ),

            // Tabelle(n)
            React.createElement('div', { className: 'table-area', ref: tableAreaRef },
                zweispaltigAktiv
                    ? React.createElement('div', { style: { display: 'flex', gap: '1rem' } },
                        [pageErsteHaelfte, pageZweiteHaelfte].map((liste, spaltenIndex) =>
                            React.createElement('div', { key: spaltenIndex, style: { flex: 1, minWidth: 0 } },
                                React.createElement('table', null,
                                    renderThead(),
                                    React.createElement('tbody', null,
                                        liste.map((s, i) => renderRow(s, pageOffset + (spaltenIndex === 0 ? i : pageHalf + i) + 1))
                                    )
                                )
                            )
                        )
                    )
                    : React.createElement('table', null,
                        renderThead(),
                        React.createElement('tbody', null,
                            pageSchwimmer.map((s, i) => renderRow(s, pageOffset + i + 1))
                        )
                    )
            )
        ),

        // Rechte Spalte: Letzte Bahnen + Gruppen (unverändert)
        React.createElement('div', { className: 'right' },
            React.createElement('h2', null, 'Letzte Bahnen'),
            lapLog.map((l, i) =>
                React.createElement('div', { key: i },
                    `${l.zeit.split("T")[1].split(".")[0]} – ${l.vorname} (${l.schwimmer}) hat angeschlagen: ${l.laps} Bahnen`
                )
            ),
            gruppenAnzeigeAktiv
                ? React.createElement('div', null,
                    React.createElement('h3', null, 'Gruppenwertung'),
                    React.createElement('table', null,
                        React.createElement('thead', null,
                            React.createElement('tr', null,
                                React.createElement('th', null, '#'),
                                React.createElement('th', null, 'Gruppe'),
                                React.createElement('th', null, unitMeterAktiv ? 'Strecke(m)' : 'Bahnen')
                            )
                        ),
                        React.createElement('tbody', null,
                            gruppenArray.map(([gruppe, bahnen], i) =>
                                React.createElement('tr', { key: gruppe },
                                    React.createElement('td', null, i + 1),
                                    React.createElement('td', null, gruppe),
                                    React.createElement('td', null, unitMeterAktiv ? bahnen * bahnLaenge : bahnen)
                                )
                            )
                        )
                    )
                )
                : null
        ),

        footerAktiv
            ? React.createElement('div', { className: 'footer' }, 'Ein Projekt der Informatik-AG des Albert-Einstein-Gymnasiums')
            : null
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
