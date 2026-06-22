// Hooks werden aus dem React Objekt geholt
// useState: Speichert und verwaltet veränderliche Daten, die beim Rendern die UI beeinflussen
//           (z.B. Schwimmerdaten, Filterzustand).
// useEffect: Führt Nebenwirkungen aus, z.B. Daten laden, Timer starten, oder Scroll-Intervalle
//            einrichten – also Code, der nicht direkt beim Rendern passiert.
// useRef: Hält veränderliche Werte oder DOM-Referenzen, die sich ändern können, ohne ein
//         erneutes Rendern auszulösen (z.B. Scroll-Position oder Zugriff auf das linke Container-Element).

const { useState, useEffect, useRef } = React;

let lastupdate = new Date("2000-01-01T00:00:00Z").toISOString();
const offsetInMinutes = new Date().getTimezoneOffset();
const offsetInMillis = -offsetInMinutes * 60 * 1000;

const bahnLaenge = parseInt("{{bahnlaenge}}");
const SWIMMER_LIST_INTERVAL_MS = {{swimmer_list_interval}} * 1000;

function gibNeueEintraege(neueListe, vorhandeneListe) {
    return neueListe.filter(neu =>
        !vorhandeneListe.some(alt =>
            alt.kommando === neu.kommando &&
            alt.parameter === neu.parameter &&
            alt.zeitstempel === neu.zeitstempel
        )
    );
}

const formatNummer = (nummer) =>
    nummer.toString().padStart(NUMMER_LAENGE, '0');

const NUMMER_LAENGE = 3;


function App() {
    let curSwimmerMap = {};
    let curActions = [];
    const [swimmerMap, setSwimmerMap] = useState({});
    // Referenz zum Zwischenspeichern des jeweils aktuellen swimmerMap-States
    const [filterAuswahl, setFilterAuswahl] = useState("");
    const [shiftLockAktiv, setShiftLockAktiv] = useState(false);
    const [zweispaltigAktiv, setZweispaltigAktiv] = useState(true);
    const [gruppenAnzeigeAktiv, setGruppenAnzeigeAktiv] = useState(true);
    const [unitMeterAktiv, setUnitMeterAktiv] = useState(true);
    const [nachnameAnzeigenAktiv, setNachnameAnzeigenAktiv] = useState(false);
    const [footerAktiv, setFooterAktiv] = useState(true);
    const [fontSize, setFontSize] = useState(16);
    const swimmerMapRef = useRef(swimmerMap);
    const [lapLog, setLapLog] = useState([]);
    const [filter, setFilter] = useState({ gruppe: null, nurKinder: false, sortierung: "bahnanzahl" });
    const leftRef = useRef();
    const scrollPosition = useRef(0);
    let spezialzeiten = [];

    function gibZeitZukunft(zeit, stunden, minuten) {
        const basis = new Date(zeit); // Kopie der gegebenen Zeit
        basis.setHours(basis.getHours() + stunden);
        basis.setMinutes(basis.getMinutes() + minuten);
        return basis;
    }

    function initSpezialzeiten(startzeit = new Date()) {
        spezialzeiten = [
            { name: "Tag1", start: startzeit, end: gibZeitZukunft(startzeit, 12, 0) },
            { name: "Geisterstunde", start: gibZeitZukunft(startzeit, 12, 0), end: gibZeitZukunft(startzeit, 13, 0) },
            { name: "Gute Nacht", start: gibZeitZukunft(startzeit, 13, 0), end: gibZeitZukunft(startzeit, 17, 0) },
            { name: "Frühaufsteher", start: gibZeitZukunft(startzeit, 17, 0), end: gibZeitZukunft(startzeit, 18, 0) },
            { name: "Tag2", start: gibZeitZukunft(startzeit, 18, 0), end: gibZeitZukunft(startzeit, 48, 0) }
        ];
        //console.log("Spezialzeiten", spezialzeiten);
    }

    function downloadCSV(headers = ["vorname", "nachname", "istKind", "gruppe", "bahnanzahl"]) {
        const maxID = Math.max(...Object.keys(curSwimmerMap).map(s => parseInt(s)));
        console.log("Maximum:", maxID);
        headersspezial = spezialzeiten.map((szeit) => szeit.name);
        console.log(`headersspezial: ${headersspezial}`);
        headers = headers.concat(headersspezial);
        console.log("curSwimmerMap", curSwimmerMap);
        const noScale = new Set(['istKind']);

        let csvRows = [
            "nummer," + headers.join(',') // Kopfzeile
        ];

        for (let i = 0; i < maxID; i++) {
            if (curSwimmerMap[i + 1]) {
                csvRows.push(`${i + 1},` +
                    headers.map(header => {
                        let value = curSwimmerMap[i + 1][header] ?? '';
                        const isNumeric = !noScale.has(header) && (typeof value === 'number' || !isNaN(value));
                        if (isNumeric) value *= bahnLaenge;
                        const stringValue = value.toString().replace(/"/g, '""');
                        return isNumeric ? stringValue : `"${stringValue}"`;
                    }).join(',')
                );
            } else {
                csvRows.push(`${i + 1},` +
                    headers.map(header => `"0"`).join(',')
                );
            }
        }

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

    function transformData(eintrag) {
        return {
            kommando: eintrag.kommando,
            parameter: JSON.parse(eintrag.parameter),
            timestamp: eintrag.zeitstempel,
            transmitted: false
        };
    }

    function downloadJSON() {
        // Daten für JSON-Umwandlung in ein Dictionary packen
        const data = { "schwimmer": curSwimmerMap, "actions": curActions.map(transformData) };

        // In JSON-Text umwandeln
        const jsonString = JSON.stringify(data, null, 2);

        // Blob erstellen (Dateiobjekt)
        const blob = new Blob([jsonString], { type: "application/json" });

        // Temporären Download-Link erstellen
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "view_backup.json";

        // Link klicken (Download starten)
        document.body.appendChild(link);
        link.click();

        // Aufräumen
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function updateBahnen(schwimmerID, anzahl = 1, zeit = new Date().toISOString()) {
        if (curSwimmerMap[schwimmerID]) {
            const s = { ...curSwimmerMap[schwimmerID] }
            s.bahnanzahl += anzahl;
            const zeitD = new Date(zeit);
            spezialzeiten.forEach((t) => {
                if (zeitD >= t.start && zeitD < t.end) {
                    //console.log(`${t.name} bei Schwimmer ${schwimmerID} - Zeit: ${zeit}`);
                    s[t.name] = (s[t.name] ? s[t.name] + anzahl : anzahl);
                }
            })
            curSwimmerMap[schwimmerID] = s;
            setSwimmerMap({ ...curSwimmerMap });
            const newlapcount = s.bahnanzahl
            const lzeit = new Date((new Date(zeit)).getTime() + offsetInMillis);
            setLapLog((prev) => [{
                schwimmer: schwimmerID,
                zeit: lzeit.toISOString(),
                laps: newlapcount,
                vorname: s.vorname
            }, ...prev.slice(0, 19)]);
        }
    }

    function holeNeueDaten(since, nurSchwimmer = false) {
        const parameter = nurSchwimmer ? ["update_swimmer"] : (since ? [since] : []);
        fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ 'kommando': "VIEW", 'parameter': parameter, 'timestamp': new Date().toISOString() }])
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.swimmerMap) {
                    const isInitialLoad = curActions.length === 0;
                    data.swimmerMap.forEach(s => {
                        if (isInitialLoad || !curSwimmerMap[s.nummer]) {
                            s.bahnanzahl = 0;
                            spezialzeiten.forEach(szeit => s[szeit.name] = 0);
                            curSwimmerMap[s.nummer] = s;
                        } else {
                            const existing = curSwimmerMap[s.nummer];
                            curSwimmerMap[s.nummer] = { ...existing, vorname: s.vorname, nachname: s.nachname, gruppe: s.gruppe, aktiv: s.aktiv, istKind: s.istKind };
                        }
                    });
                    setSwimmerMap({ ...curSwimmerMap });
                }
                if (data.lapLog) setLapLog(data.lapLog);
                if (data.actions) {
                    //console.log("data.actions", JSON.stringify(data.actions));
                    let datasorted = data.actions.filter((x) => x.kommando == "ADD")
                    datasorted.sort((a, b) => a.zeitstempel.localeCompare(b.zeitstempel));
                    const neueElemente = gibNeueEintraege(datasorted, curActions);
                    neueElemente.forEach(element => {
                        // Wenn noch nicht in curActions vorhanden, einfügen
                        curActions.push(element);
                        // Bahnanzahl aktualisieren; unbekannte Schwimmer als Platzhalter anlegen
                        const parameter = JSON.parse(element.parameter);
                        const nummer = parseInt(parameter[0]);
                        if (!curSwimmerMap[nummer]) {
                            //console.log(`Schwimmer ${nummer} unbekannt – Platzhalter angelegt`);
                            const placeholder = { nummer, vorname: `Schwimmer ${nummer}`, nachname: '', gruppe: '', bahnanzahl: 0, aktiv: 1 };
                            spezialzeiten.forEach(szeit => placeholder[szeit.name] = 0);
                            curSwimmerMap[nummer] = placeholder;
                        }
                        if (lastupdate < element.zeitstempel) lastupdate = element.zeitstempel;
                        //console.log(`Update ${nummer} - ${parameter[1]}, ${element.zeitstempel}`);
                        updateBahnen(nummer, parseInt(parameter[1]), element.zeitstempel);
                    });
                }
                if (data.filter) setFilter(data.filter);
            })
            .catch((err) => console.error("Fehler beim Laden:", err));
    }

    // Effekt: immer wenn swimmerMap sich ändert, aktualisiere die Ref
    useEffect(() => {
        swimmerMapRef.current = swimmerMap;
    }, [swimmerMap]);

    //Schriftgrößenänderung
    useEffect(() => {
        document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    }, [fontSize]);

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.shiftKey && e.key === "L") {
                setShiftLockAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "D") {
                console.log("Download gedrückt");
                downloadCSV();
            } else if (e.shiftKey && e.key === "Z") {
                console.log("Zweispaltig geändert");
                setZweispaltigAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "G") {
                console.log("Gruppenanzeige geändert");
                setGruppenAnzeigeAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "N") {
                console.log("Nachnamenanzeige geändert");
                setNachnameAnzeigenAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "U") {
                console.log("Einheiten geändert");
                setUnitMeterAktiv((prev) => !prev);
            } else if (e.shiftKey && e.key === "S") {
                holeNeueDaten(null, true);
            } else if (e.shiftKey && e.key === "B") {
                console.log("Download JSON-Backup");
                downloadJSON();
            } else if (e.ctrlKey && e.key === '+') {
                setFontSize(size => Math.min(size + 1, 40));
                e.preventDefault();
            } else if (e.ctrlKey && e.key === '-') {
                setFontSize(size => Math.max(size - 1, 8));
                e.preventDefault();
            } else if (e.shiftKey && e.key === "F") {
                console.log("Footer geändert");
                setFooterAktiv((prev) => !prev);
            } 
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        holeNeueDaten();
        initSpezialzeiten(new Date("{{startzeit}}"));
    }, []); // [] - sorgt dafür, dass dieser Effect (diese Funktion) nur ein einziges Mal ausgeführt wird

    // Der Timer für das holen neuer Daten
    useEffect(() => {
        const interval10 = setInterval(() => {
            const date = new Date(lastupdate);
            date.setHours(date.getHours() - 1); // Hole die Daten der letzten Stunde
            holeNeueDaten(date);
        }, 10000); // alle 5 Sekunden
        return () => clearInterval(interval10); // Aufräumen bei Komponentendemontage
    }, []);

    // Periodische Schwimmerlistenaktualisierung (neue Schwimmer integrieren)
    useEffect(() => {
        const intervalSwimmer = setInterval(() => {
            holeNeueDaten(null, true);
        }, SWIMMER_LIST_INTERVAL_MS);
        return () => clearInterval(intervalSwimmer);
    }, []);

    // Der Timer wird in Use-Effect gepackt, damit er erst nach dem ersten Rendern ausgeführt wird
    useEffect(() => {
        if (!shiftLockAktiv) return; // Nur aktivieren wenn Shift Lock aktiv

        const scrollInt = setInterval(() => {
            const container = leftRef.current;
            if (!container) return;
            scrollPosition.current += 8;
            if (scrollPosition.current >= 120+ container.scrollHeight - container.clientHeight) {
                scrollPosition.current = -120;
            }
            container.scrollTop = scrollPosition.current;
        }, 100);

        return () => clearInterval(scrollInt); // Aufräumen
    }, [shiftLockAktiv]); // Neu starten bei Änderung von shiftLockAktiv


    let gefiltert = Object.values(swimmerMap);
    if (filterAuswahl === "nurKinder") {
        gefiltert = gefiltert.filter((s) => s.istKind);
    } else if (filterAuswahl.startsWith("gruppe-")) {
        const gruppe = filterAuswahl.split("-")[1];
        gefiltert = gefiltert.filter((s) => s.gruppe === gruppe);
    }
    gefiltert.sort((a, b) => b.bahnanzahl - a.bahnanzahl);

    // Für zweispaltige Darstellung
    const halb = Math.ceil(gefiltert.length / 2);
    const ersteHaelfte = gefiltert.slice(0, halb);
    const zweiteHaelfte = gefiltert.slice(halb);

    // Für das Gruppenranking
    const gruppenRanking = {};
    if (gruppenAnzeigeAktiv) {
        Object.values(swimmerMap).forEach(s => {
            const gruppe = s.gruppe || '–';
            gruppenRanking[gruppe] = (gruppenRanking[gruppe] || 0) + (s.bahnanzahl || 0);
        });
    }

    // Gruppe "-" entfernen, wenn vorhanden
    delete gruppenRanking['–'];

    // In ein sortiertes Array umwandeln
    const gruppenArray = Object.entries(gruppenRanking)
        .sort((a, b) => b[1] - a[1]); // nach Bahnen absteigend sortieren

    return React.createElement('div', { id: 'root' },
        React.createElement('div', { className: 'left', ref: leftRef },
            React.createElement('div', { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
                React.createElement('h2', null, 'Ranking'),
                React.createElement('select', {
                    value: filterAuswahl,
                    onChange: (e) => setFilterAuswahl(e.target.value)
                },
                    React.createElement('option', { value: '' }, 'Alle anzeigen'),
                    React.createElement('option', { value: 'nurKinder' }, 'Nur Kinder')
                )
            ),
            zweispaltigAktiv
                ? React.createElement('div', { style: { display: 'flex', gap: '2rem' } },
                    [ersteHaelfte, zweiteHaelfte].map((liste, spaltenIndex) =>
                        React.createElement('table', { key: spaltenIndex },
                            React.createElement('thead', null,
                                React.createElement('tr', null,
                                    React.createElement('th', null, '#'),
                                    React.createElement('th', null, 'Name'),
                                    React.createElement('th', null, 'Gruppe'),
                                    React.createElement('th', null, (unitMeterAktiv ? 'Strecke(m)' : 'Bahnen'))
                                )
                            ),
                            React.createElement('tbody', null,
                                liste.map((s, i) =>
                                    React.createElement('tr', { key: s.nummer },
                                        React.createElement('td', null, (spaltenIndex === 0 ? i : i + halb) + 1),
                                        React.createElement('td', null, `(${formatNummer(s.nummer)}) ${s.vorname} ${nachnameAnzeigenAktiv ? s.nachname : ""}`),
                                        React.createElement('td', null, s.gruppe),
                                        React.createElement('td', null, (unitMeterAktiv ? s.bahnanzahl * bahnLaenge : s.bahnanzahl))
                                    )
                                )
                            )
                        )
                    )
                )
                : React.createElement('table', null,
                    React.createElement('thead', null,
                        React.createElement('tr', null,
                            React.createElement('th', null, '#'),
                            React.createElement('th', null, 'Name'),
                            React.createElement('th', null, 'Gruppe'),
                            React.createElement('th', null, (unitMeterAktiv ? 'Strecke(m)' : 'Bahnen'))
                        )
                    ),
                    React.createElement('tbody', null,
                        gefiltert.map((s, i) =>
                            React.createElement('tr', { key: s.nummer },
                                React.createElement('td', null, i + 1),
                                React.createElement('td', null, `(${formatNummer(s.nummer)}) ${s.vorname} ${nachnameAnzeigenAktiv ? s.nachname : ""}`),
                                React.createElement('td', null, s.gruppe),
                                React.createElement('td', null, (unitMeterAktiv ? s.bahnanzahl * bahnLaenge : s.bahnanzahl))
                            )
                        )
                    )
                )
        ),
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
                                React.createElement('th', null, (unitMeterAktiv ? 'Strecke(m)' : 'Bahnen'))
                            )
                        ),
                        React.createElement('tbody', null,
                            gruppenArray.map(([gruppe, bahnen], i) =>
                                React.createElement('tr', { key: gruppe },
                                    React.createElement('td', null, i + 1), // Rang
                                    React.createElement('td', null, gruppe),
                                    React.createElement('td', null, (unitMeterAktiv ? bahnen * bahnLaenge : bahnen))
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