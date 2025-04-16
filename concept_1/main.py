import socket
import os
import json
from datetime import datetime

hostname = socket.gethostname()
HOST = socket.gethostbyname(hostname)
PORT = 8080

if not os.path.exists("verlauf.json"):
    with open("verlauf.json", "w", encoding="utf-8") as f:
        f.write("[]")
        
if not os.path.exists("data.json"):
    with open("data.json", "w", encoding="utf-8") as f:
        f.write("[]")

def addVersion(new, dateipfad="verlauf.json"):
    daten = []

    if os.path.exists(dateipfad):
        with open(dateipfad, "r", encoding="utf-8") as f:
            try:
                daten = json.load(f)
                if not isinstance(daten, list):
                    daten = []
            except json.JSONDecodeError:
                daten = []

    # Zeit hinzufügen
    new_data = {
        "Zeit": datetime.now().strftime("%H:%M:%S"),
        "Data": new
    }

    daten.append(new_data)

    with open(dateipfad, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=4)


def load_html_file(filename):
    if not os.path.exists(filename):
        return "HTTP/1.1 404 Not Found\n\n<h1>404 - Datei nicht gefunden</h1>"

    with open(filename, 'r', encoding='utf-8') as file:
        html = file.read()
    
    return f"HTTP/1.1 200 OK\nContent-Type: text/html\n\n{html}"

def build_response(status, body, content_type="text/html"):
    return f"HTTP/1.1 {status}\nContent-Type: {content_type}\n\n{body}"

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen(1)
    print(f"Server läuft auf http://{HOST}:{PORT}")

    while True:
        conn, addr = s.accept()
        with conn:
            request = conn.recv(1024).decode()
            print("Anfrage erhalten:")
            print(request)
            
            if not request:
                continue

            # Methode und Pfad analysieren
            lines = request.splitlines()

            method, path, *_ = lines[0].split()

            # Nur GET-Anfragen verarbeiten (ganz simpel)
            if "GET / " in request or "GET /index.html" in request:
                response = """HTTP/1.1 200 OK\nContent-Type: text/html

<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <meta http-equiv='X-UA-Compatible' content='IE=edge'>
    <title>Bahnenschwimmen</title>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <link rel='stylesheet' type='text/css' media='screen' href='main.css'>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

    <style>
        body {
            font-family: sans-serif; /* Standard Schriftart */
            margin: 0; /* Entfernt Standard-Margin */
            background-color: #f0f5f9; /* Heller Hintergrund */
            color: #333; /* Dunkler Text für guten Kontrast */
        }

        /* Header */
        header {
            background-color: #2962ff; /* Primärblau */
            color: #ffffff;
            padding: 20px 0;
            text-align: center;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
            margin: 0;
            font-size: 28px;
            letter-spacing: 2px;
        }

        header h1 {
            margin: 0; /* Entfernt Standard-Margin */
            font-size: 28px;
            letter-spacing: 2px;
        }

        /* Navigation */
        nav {
            background-color: #448aff; /* Etwas helleres Blau */
            padding: 0.5rem 0;
        }

        nav ul {
            list-style: none; /* Entfernt Aufzählungszeichen */
            margin: 0;
            padding: 0;
            text-align: center;
        }

        nav li {
            display: inline; /* Elemente nebeneinander */
            margin: 0 1rem;
        }

        nav a {
            text-decoration: none; /* Entfernt Unterstreichung */
            color: #fff;
            font-weight: bold;
        }

        table {
            border-collapse: collapse;
            width: 20%;
            margin: auto;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }

        /* Hauptinhalt */
        main {
        padding: 2rem;
        }

        section {
            margin-bottom: 2rem;
        }

        h2 {
            color: #2962ff; /* Überschriften in Primärblau */
        }

        /* Buttons */
        button {
            background-color: #2962ff;
            color: #fff;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            cursor: pointer; /* Mauszeiger ändert sich beim Hovern */
        }

        button:hover {
            background-color: #0d47a1; /* Dunkleres Blau beim Hovern */
        }

        /* Footer */
        footer {
            background-color: #448aff;
            color: #fff;
            text-align: center;
            padding: 1rem 0;
            position: fixed; /* Footer fixieren */
            bottom: 0;
            width: 100%;
        }

        .abwesend {
            background-color: #f66;
            color: white;
        }

        /* Custom Kontextmenü */
        #contextMenu {
            display: none;
            position: absolute;
            background-color: white;
            border: 1px solid #aaa;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
        }

        #contextMenu ul {
            list-style: none;
            margin: 0;
            padding: 5px 0;
        }

        #contextMenu li {
            padding: 8px 16px;
            cursor: pointer;
        }

        #contextMenu li:hover {
            background-color: #eee;
        }

        /* Responsives Design */
        @media (max-width: 768px) {
            nav ul {
            text-align: left; /* Navigationslinks linksbündig auf kleineren Bildschirmen */
            }

            nav li {
                display: block; /* Navigationslinks untereinander */
                margin: 0.5rem 0;
            }
        }
    </style>
</head>
<body>
    <header>
        <button id="schwimmerHinzufuegen" style="position: fixed; top: 20px; left: 20px; font-size: 30px; cursor: pointer; color: white;">+</button>
        <button id="downloadJsonBtn" style="position: fixed; top: 20px; right: 20px; font-size: 30px; cursor: pointer; color: white;"><i class="fa-solid fa-download"></i></button>
        <h1>24h Schwimmen</h1>
        <input type="number" id="schwimmerNum"><br>
    </header>
    <table id="schwimmer">
        <tr>
            <th>Schwimmer*innen Startnummer</th>
            <th>Geschwommene Bahnen</th>
        </tr>
    </table> 

    <!-- Kontextmenü -->
    <div id="contextMenu">
        <ul>
            <li id="abwesendOption">Abwesenheit wechseln</li>
            <li id="rundeAbziehenOption">Runde abziehen</li>
            <li id="deleteSwimmer">Schwimmer*innen entfernen</li>
            <li id="bahnHinzufuegenOption" style="display: none;">Bahn hinzufügen</li>
        </ul>
    </div>

    <script>
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

            const headers = Array.from(rows[0].querySelectorAll("th")).map(th => th.textContent.trim());
            const jsonData = [];

            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll("td");
                const rowData = {};

                cells.forEach((cell, index) => {
                    const header = headers[index];
                    rowData[header] = cell.textContent.trim();
                });

                if (Object.keys(rowData).length > 0) {
                    jsonData.push(rowData);
                }
            }

            return jsonData;
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

        const table = document.getElementById("schwimmer");
        const contextMenu = document.getElementById("contextMenu");
        let clickedRow = null;

        // Bahn hinzufügen bei Linksklick auf Nummer
        table.addEventListener("click", function (event) {
            if (event.target.classList.contains("nummer")) {
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
                    "Content-Type": "text/plain"
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

                    // Neue Zeilen einfügen
                    daten.forEach(schwimmer => {
                        const tr = document.createElement("tr");

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

        document.getElementById("schwimmerNum").addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                if (search(document.getElementById("schwimmerNum").value)) {
                    const eingabe = document.getElementById("schwimmerNum").value.trim();

                    const zelle = Array.from(document.querySelectorAll(".nummer")).find(nr =>
                        nr.textContent.trim() === eingabe
                    );
                    if (zelle) {
                        console.log(zelle.closest("tr"))
                        clickedRow = zelle.closest("tr");

                        // Menü mittig im Viewport platzieren
                        const menuWidth = 200; // Breite ungefähr
                        const menuHeight = 120; // Höhe ungefähr

                        contextMenu.style.top = (window.innerHeight / 2 - menuHeight / 2) + "px";
                        contextMenu.style.left = (window.innerWidth / 2 - menuWidth / 2) + "px";
                        contextMenu.style.display = "block";

                        document.getElementById("bahnHinzufuegenOption").style.display = "block";
                    }
                }
            }
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
        
        setInterval(send, 300000);
        send()
    </script>
</body>
</html>
"""
            elif method == "GET" and path == "/daten":
                try:
                    with open("data.json", "r", encoding="utf-8") as f:
                        daten = f.read()
                    response = build_response("200 OK", daten, "application/json")
                except FileNotFoundError:
                    response = build_response("200 OK", "[]", "application/json")

            elif method == "POST" and path == "/senden":
                body = request.split("\r\n\r\n", 1)[1]
                print("Gesendet vom Client:", body)
                antwort = f"Server hat bekommen: {body}"
                response = build_response("200 OK", antwort, "text/plain")
                # bestehende Daten laden
                try:
                    with open("data.json", "r", encoding="utf-8") as f:
                        bestehende_daten = json.load(f)
                except FileNotFoundError:
                    bestehende_daten = []
                
                neue_daten = json.loads(body)
                # neue daten verarbeiten
                for neuer in neue_daten:
                    nummer = neuer["Nummer"]
                    bahnen = int(neuer["Bahnen"])

                    gefunden = False
                    for bestehender in bestehende_daten:
                        if bestehender["Nummer"] == nummer:
                            bestehender["Bahnen"] = bahnen
                            gefunden = True
                            break

                    if not gefunden:
                        bestehende_daten.append(neuer)

                # daten speichern
                with open("data.json", "w", encoding="utf-8") as f:
                    json.dump(bestehende_daten, f, ensure_ascii=False, indent=4)
                
                addVersion(bestehende_daten)
            else:
                response = "HTTP/1.1 404 Not Found\n\n<h1>404 - Nicht gefunden</h1>"

            conn.sendall(response.encode())
