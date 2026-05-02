# 24h-Schwimmen

Erfassung von geleisteten Bahnen bei einem 24 Stunden schwimmen

## Szenario

Bei einem 24 Stundenschwimmen sollen digital die geleisteten Bahnen verschiedener Schwimmer innerhalb dieser 24 Stunden auf digitalen Endgeräten erfasst und auf einem zentralen Rechner gesammelt werden.
Dabei soll die Bedienung möglichst intuitiv sein und die Datensicherheit besonders hoch, so dass selbst bei einem Ausfall des Servers oder eines Endgerätes die Informationen auf mehreren Stellen verteilt gespeichert sind.
Die Erfassung soll auf möglichst vielen verschiedenen Endgeräten möglich sein (verschiedene Bildschirmgrößen, responsive Design)

## Quick-Start

### Windows

* Release als ZIP-Datei auf einem Windows-System herunterladen, entpacken und die Exe-Datei ausführen
* Im Gui-Menu die Admin-Webseite starten (einloggen mit ``admin`` und ``swim24``)
* Auf der Schwimmer-Seite einige Schwimmer aus dem Ordner testfiles importieren
* Benutzer anlegen
* Zur *normalen* Webseite wechseln und ausprobieren

### Linux bzw. Source

* Repository clonen.
* Dann mit ``pip install -r requirements.txt`` die benötigten Pakete installieren und
* die Datei ``server.py`` ausführen.
* Dies startet einen Web-Server auf dem Port 8080, der in der Regel unter ``http://localhost:8080`` mit dem Browser zu erreichen ist.

Eine Basisdatenbank mit dem Benutzer ``admin`` und dem Passwort ``swim24`` wird automatisch angelegt.

## Wichtiges für den Live-Betrieb

* Der Rechner auf dem der Server läuft, sollte angepasste Energiesparmodi haben, d.h. nicht in den Standby-Wechseln und auch die Festplatte soll nicht abgeschaltet werden. Dazu z.B. unter Windows ``Energiesparplaneinstellungen ändern`` -> ``Erweiterte Einstellungen ändern`` und dort enstprechende Einstellungen vornehmen
* Um in Excel die CSV-Daten zu importieren, erstellt man eine leere Tabelle, wechselt dann in das Menü Daten und dort gibt es einen Reiter Text/CSV-Importieren. Hier kann man auch die Codierung einstellen. In der Regel arbeitet der Server nur mit UTF-8 Daten

## Konfiguration (config.json)

Die Datei `config.json` im Projektverzeichnis enthält alle serverseitigen Einstellungen:

| Schlüssel | Beispielwert | Beschreibung |
| --- | --- | --- |
| `flask_secret_key` | `"Lang&Umständlich"` | Geheimer Schlüssel für Flask-Sessions – vor dem Live-Betrieb ändern |
| `default_admin_pass` | `"swim24"` | Initiales Passwort für den Admin-Benutzer |
| `laenge_schwimmerNr` | `3` | Anzahl Stellen der Schwimmernummer (z. B. 3 → 001–999) |
| `laenge_bahn_m` | `100` | Länge einer Bahn in Metern (für Streckenberechnung) |
| `fade_time` | `600` | **Nur v2-Oberfläche** (`/v2`): Sekunden seit dem letzten Klick, nach denen eine Schwimmerkarte blass dargestellt wird. Beim nächsten Betätigen von „Senden" wird der Schwimmer automatisch von der Bahn entfernt. `0` oder `-1` deaktiviert das Feature. |
| `mobile_cards` | `2` | **Nur v2-Oberfläche**: Anzahl Schwimmerkarten pro Zeile auf kleinen Bildschirmen (≤ 600 px Breite). |
| `view2_page_interval` | `5` | **View2-Seite** (`/view2`): Sekunden pro Seite bei aktiviertem Auto-Weiterblättern (Shift-Lock-Modus). |
| `startzeit` | `"2025-06-14T08:00:00Z"` | **View- und View2-Seite**: Startzeitpunkt des Schwimmens als UTC-ISO-Timestamp. Legt den Beginn der Spezialzeiten (Tag1, Geisterstunde, Gute Nacht, Frühaufsteher, Tag2) fest. |

Änderungen an `config.json` werden erst nach einem Neustart des Servers wirksam.

## Schwimmer-Import (CSV)

Im Admin-Bereich unter **Schwimmer** können Schwimmerdaten per CSV-Datei importiert werden.

### Vorgehensweise

1. CSV-Datei auswählen — die erste Zeile muss Spaltenüberschriften enthalten.
2. Im Dialog wird jede **CSV-Spalte** (fett) einem **Datenbankfeld** zugeordnet. Nicht benötigte Spalten auf *Ignorieren* lassen.
3. Pflichtfeld ist `nummer`. Alle anderen Felder sind optional.
4. Klick auf **Importieren** überträgt die Daten.

### Unterstützte Felder

| Datenbankfeld | Bedeutung |
| --- | --- |
| `nummer` | Schwimmernummer (Pflicht, eindeutiger Schlüssel) |
| `vorname` | Vorname |
| `nachname` | Nachname |
| `gruppe` | Gruppe / Team |
| `istKind` | `1` = Kind, `0` = Erwachsener |
| `istErw` | Alternative zu `istKind`: `0` = kein Erwachsener → wird intern als Kind (`istKind = 1`) gespeichert |

### Verhalten bei bereits vorhandenen Schwimmern (Duplikate)

Existiert ein Schwimmer mit der importierten Nummer bereits in der Datenbank, wird er **aktualisiert**, nicht doppelt angelegt:

- **Aktualisiert:** `vorname`, `nachname`, `gruppe`, `istKind`
- **Unverändert bleiben:** `bahnanzahl` (geschwommene Bahnen), `aktiv`-Status, Bahneinteilung

So können Stammdaten (z. B. nach einer Namenskorrektur) gefahrlos neu importiert werden, ohne Bahndaten zu verlieren.

## Benutzer-Import (CSV)

Im Admin-Bereich unter **Benutzer** können Zugangsdaten per CSV-Datei importiert werden.

### Vorgehensweise

1. CSV-Datei auswählen — die erste Zeile muss Spaltenüberschriften enthalten.
2. Im Dialog wird jede **CSV-Spalte** einem **Datenbankfeld** zugeordnet. Nicht benötigte Spalten auf *Ignorieren* lassen.
3. Pflichtfeld ist `benutzername`. Alle anderen Felder sind optional.
4. Klick auf **Importieren** überträgt die Daten.

### Unterstützte Felder

| Datenbankfeld | Bedeutung |
| --- | --- |
| `benutzername` | Anmeldename (Pflicht, eindeutiger Schlüssel; wird automatisch kleingeschrieben) |
| `name` | Anzeigename / vollständiger Name |
| `passwort` | Passwort im Klartext (wird serverseitig gehasht gespeichert) |
| `admin` | `1` = Admin-Rechte, `0` = normaler Benutzer |

### Verhalten bei bereits vorhandenen Benutzern (Duplikate)

Existiert ein Benutzer mit dem importierten `benutzername` bereits, wird er **aktualisiert**, nicht doppelt angelegt:

- **Aktualisiert:** `name`, `admin`-Status
- **Passwort:** wird nur geändert, wenn in der CSV-Datei angegeben; sonst unverändert
- **Neu angelegte Benutzer ohne Passwort** erhalten ein zufällig generiertes Passwort — dieses sollte nach dem Import manuell geändert werden

## Datenexport am Ende des Wettkampfes

Es gibt vier Möglichkeiten, die erfassten Daten zu exportieren. Für die Auswertung nach dem Wettkampf empfiehlt sich der CSV-Export.

### CSV-Export der Schwimmerdaten (empfohlen)

**Wo:** View-Seite (`/view`) oder View2-Seite (`/view2`)  
**Auslöser:** Tastenkombination `Shift+D` (wie Download)

Erzeugt die Datei `schwimmerdaten.csv` mit einer Zeile pro Schwimmer. Die Werte in den Spalten sind Meter (Bahnanzahl × Bahnlänge).

| Spalte | Inhalt |
| --- | --- |
| `nummer` | Schwimmernummer |
| `vorname` | Vorname |
| `nachname` | Nachname |
| `gruppe` | Gruppe / Team |
| `bahnanzahl` | Gesamtstrecke in Metern |
| `Tag1` | Strecke (m) im ersten Zeitabschnitt |
| `Geisterstunde` | Strecke (m) in der Geisterstunde |
| `Gute Nacht` | Strecke (m) im Nacht-Abschnitt |
| `Frühaufsteher` | Strecke (m) im Frühaufsteher-Abschnitt |
| `Tag2` | Strecke (m) im zweiten Tag-Abschnitt |

Die Zeitgrenzen der Spezialzeiten werden relativ zur konfigurierten `startzeit` berechnet (siehe Konfiguration).

### Aktions-Backup als JSON

**Wo:** View-Seite (`/view`) oder View2-Seite (`/view2`)  
**Auslöser:** Tastenkombination `Shift+B`

Erzeugt die Datei `view_backup.json` mit allen bisher empfangenen Aktionen und dem aktuellen Schwimmerstand. Diese Datei kann im Admin-Bereich unter **Aktionen → JSON-Import** wieder eingespielt werden, um Daten von einem ausgefallenen Endgerät nachzuladen.

### Lokaler JSON-Download (Erfassungsgerät)

**Wo:** Haupt-Erfassungsseite (`/`)  
**Auslöser:** Schaltfläche „Download JSON"

Speichert den lokalen Zustand des Erfassungsgeräts (aktive Schwimmer, zwischengespeicherte Aktionen, Statusmeldungen) als `24hschwimmen.json`. Nützlich zur Fehlerdiagnose oder als Sicherungskopie, falls Aktionen noch nicht übertragen wurden.

### SQL-Datenbank-Backup

**Wo:** Admin-Bereich  
**Auslöser:** Schaltfläche „Backup SQL"

Lädt die vollständige SQLite-Datenbank als `backup.sql` herunter (nur für Admin-Benutzer). Enthält alle Schwimmer, Aktionen und Clients. Geeignet als Vollsicherung vor dem Abschalten des Servers.

## Logging

Die Logging-Konfiguration befindet sich in `logging_config.py`.

**Logdatei:** `data/serverlog.log` (relativ zum Projektverzeichnis, wird automatisch angelegt)

Es gibt zwei Handler mit unabhängigen Leveln:

| Handler | Standard-Level | Beschreibung |
| --- | --- | --- |
| `file_handler` | `DEBUG` | Schreibt alle Meldungen in die Logdatei |
| `console_handler` | `INFO` | Gibt Meldungen auf der Konsole aus (sichtbar im Gunicorn-Log) |

Um den Gunicorn-Output zu reduzieren, `console_handler.setLevel(logging.WARNING)` setzen. Einzelne häufige Meldungen können im Code von `logging.info(...)` auf `logging.debug(...)` umgestellt werden — sie erscheinen dann nur noch in der Datei, nicht mehr in der Konsole.

## Windows-Firewall

Gegebenenfalls muss die Windows-Firewall angepasst werden. Windows-Defender-Firewall -> Erweiterete Einstellungen -> Eingehende Regel -> Neue Regel anlegen -> Port 8080 freigeben

## Spezialfunktionen

Im view kann man:

* mit ``Shift+D`` (Download) eine CSV-Datei herunterladen
* mit ``Shift+G`` die Gruppentabelle ein und ausblenden
* mit ``Shift+Z`` zwischen ein- und zweispaltiger Darstellung wechseln
* mit ``Shift+N`` die Nachnamen ein- oder ausblenden
* mit ``Shift+U`` die Anzeige zwischen Bahnen / Strecke wechseln
* mit ``Shift+B`` ein Backup der Actions machen, welches man im Admin-Fenster wieder importieren könnte

Auf der **Erfassungsseite** (`/v2`) gibt es außerdem den URL-Parameter `size`, der die Breite der Schwimmerkarten steuert (Standardwert: `5`, entspricht ca. 200 px pro Karte). Ein kleinerer Wert ist auf Smartphones hilfreich, damit zwei Karten nebeneinander in eine Zeile passen:

```
http://<server>:8080/v2?size=3
```

Wenn man die URL mit ``?dbgfkt=true`` lädt, kann durch anklicken der Überschrift *24h-Schwimmen* eine automatisches Klicken der vorhandenen DIVs simuliert werden.

## grobe Planung

Ein Mini-Python-Webserver liefert eine HTML-Seite mit Javascript aus und registriert per send requests Bahnen der Schwimmer die auf einem Endgerät per klick erfasst werden. Ebenso liefert der Webserver Daten an die Webseite.

Die Gestaltung der Ansicht auf dem Endgerät ist in etwa wie folgt:

<img alt="ScreenshotOberfläche" src="./images/ScreenshotOberfl.png" width="400px"></img>

Dabei wird im oberen Bereich die Bahnnummer, für die das Gerät genutzt wird, angezeigt bzw. geändert. Der (+)-Button links ermöglicht es einen Schwimmer (der über seine Startnummer erfasst wird) hinzuzufügen.
In einzelnen Feldern werden die aktiv auf der Bahn schwimmenden Schwimmer angezeigt. Grün zeigt an, dass dieser Schwimmer nicht auf der eingestellten Bahn schwimmt.
Die Anzeige erfolgt möglichst so, dass die vermutlich als nächstes eintreffenden aktiven Schwimmer ganz oben zu Beginn in der Liste geführt werden. Das heißt, dass derjenige Schwimmer für den als letztes eine erfolgreich geschwommene Bahn registriert wurde ans Ende der Liste verschoben wird.
Nicht aktive Schwimmer werden nicht angezeigt und können über das Plus-Symbol wieder in die Liste eingefügt werden.

Durch einen Klick/Touch auf die Nummer wird eine geleistete Bahn registriert. Die Anzahl der Bahnen wird um eins erhöht und nach 3 Sekunden wird dieser Schwimmer an das Ende der Liste sortiert.
Innerhalb der drei Sekunden kann die Bahn noch zurückgenommen werden - während der Schwimmer ausgefadet wird. Der Schwimmer bleibt dann an der Stelle der Liste.

Durch einen Rechtsklick oder langen Touch auf den Schwimmer öffnet sich ein Kontextmenü in dem der Schwimmer z.B. geändert werden kann, bzw. von aktiv zu inaktiv gewechselt werden kann oder ähnliches.

Auf touch-basierten Endgeräten können die Schwimmer auch geswiped werden (links setzt den Schwimmer auf inaktiv - entfernt ihn von der Bahn, rechts setzt ihn ans Ende der Liste)

## Datenmodell

Die Daten werden auf dem Server in einer SQLite Datenbank gehalten (Absturzsicher, leicht zugreifbar) und auf den Clients jeweils regelmäßig als JSON-Datei gespeichert.

### Benutzer

```text
    name: String
    benutzername: String
    passwort: String (verschlüsselt)
    admin: Boolean
```

### Client

```text
    id: Integer (beginnt bei 1)
    ip: String
    benutzer: Verweis auf Benutzer
    letzteÜbermittelteAction: Verweis auf Action
```

### Schwimmer

```text
    nummer: Integer
    erstelltVonClientId: Verweis auf Client (0 ist admin/Server)
    name: String
    bahnen: Integer (Anzahl)
    strecke: Integer (Meter)
    aufBahn: Integer (letzte Aktive Bahn - sonst 0)
    aktiv: Boolean
```

### Action (alle Befehle/Transaktionen werden protokolliert)

```text
    id: Integer (Nr muss nur lokal eindeutig sein - auf Client oder Server)
    benutzer: Verweis auf auslösenden Benutzer
    client: Verweis auf auslösenden Client
    zeitstempel: ISO-Zeitstempel
    kommando: String (BAHN, ...)
    parameterliste: Array
```

mögliche Kommandos

```text
    ADD - parameter: <schwimmerNr> <Anzahl> <bahnnr>
    SUB - parameter: <schwimmerNr> <Anzahl> <bahnnr>
    GET - parameter: <schwimmerNr>
    GETB - parameter: <bahnnummer> <bahnnummer> ...
    ACT - parameter: <schwimmerNr> <0/1>
```

mit Beispielen

```text
    ADD [832,1,1]
    SUB [732,10,2]
    GET [123]
    GET [-1] - holt alle Schwimmer
    GETB [2,3] - holt die Schwimmer der Bahnen 2,3
    ACT [123, 0] - setzt den Schwimmer Nr. 123 auf inaktiv
```

### Zeiten

timestamps werden in UTC-Strings gespeichert, müssen also für die Darstellung entsprechend in die Lokale Zeit umgewandelt werden - das ist auch für die Konfiguration von Geisterstunde und ähnlichem wichtig.

## Projektverzeichnisstruktur

Hier ist eine Übersicht über die Verzeichnisstruktur des Projektes:

```text
24H-Schwimmen/ 
├── data/               Verzeichnis für LOG-Dateien
├── flask_templates/    Vorlagen für dynmaisch generierte Webseiten
│ └── admin.html        Administrationsseite
│ └── index.html        Standardseite
│ └── login.html        Anmeldeseite 
│ └── main.js           Javascript der Webseite
├── static/             Dateien, die statisch ausgeliefert werden sollen
│ └── admin.js          Javascript für die Administrationsseite 
│ └── favicon.ico        
│ └── main.css          Standard-Style
│ └── mymodals.js       Javascript um Modals einzublenden
├── testfiles           Unterordner mit Testdaten 
├── db.py               Alles was mit Datenbankzugriffen zu tun hat
├── logging_config.py   Konfiguration des Loggings
├── config.json         Konfigurationsdatei
├── server.py           Die Hauptdatei mit der Serverfunktionalität
├── utils.py            Kleine Funktionen (Hilfsfunktionen)
├── data.sqlite         Datenbank des Servers
├── README.md           dieser Text
└── requirements.txt    Für die Nutzung zu installierende Python-Module
```

## Git-Workflow

Neue Features / Änderungen werden in einem sinnvoll benannten Branch entwickelt.
Dabei jeweils kleinschrittig committed und schließlich per Pull Request in den Branch main gemerged.

## Git-Befehle (Beispiel)

```bash
## Neuen Branch erstellen und wechseln
git checkout -b feature/kurze-beschreibung

## Änderungen hinzufügen und committen (mehrfach und kleinschrittig)
git add .
git commit -m "Kurz und präzise beschreiben, was geändert wurde"

## Branch auf Remote pushen
git push -u origin feature/kurze-beschreibung
```

## Pull Request

Nach dem Push kann auf GitHub ein Pull Request zum Merge in main erstellt werden.
Dazu im Repository auf **"Pull requests" → "New pull request"** klicken, den eigenen Branch als *compare* und "main" als *base* auswählen, Titel & Beschreibung angeben und mit **"Create pull request"** bestätigen.

## Erzeugung von Releases

``requirements.txt`` erstellen/aktualisieren mit

```bash
pip install pipreqs
pipreqs --force /path/to/project
```

ggf. mit ``pip freeze`` die Liste der aktuell installierten Versionen anzeigen lassen.

Exe-Datei für Windows erzeugen

```bash
pip install pyinstaller
pyinstaller --onefile gui.py
```

bzw. noch besser, die Datei ``make_release.py`` anpassen (release-name) und (unter Windows) ausführen. Dadurch wird eine ZIP-Datei erstellt, die hochgeladen werden kann.

Auf github als Release veröffentlichen
