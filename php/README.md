# 24h-Schwimmen – PHP/MySQL Backend

Dieses Verzeichnis enthält eine vollständige PHP/MySQL-Portierung des 24h-Schwimmen-Projekts. Beide Backends (Python und PHP) sind **vollständig unabhängig** und teilen keine Daten.

---

## Projektstruktur (Gesamtüberblick)

```
24h-Schwimmen/
│
├── server.py              ← Python/Flask-Backend (Original)
├── db.py                  ← SQLite-Datenbankschicht (Python)
├── config.json            ← Gemeinsame Konfiguration (beide Backends lesen diese)
├── data.sqlite            ← SQLite-Datenbank (nur Python)
│
├── flask_templates/       ← Jinja2-Templates (Python UND PHP nutzen diese)
│   ├── main.js            ← wird von beiden Backends als Template gerendert
│   ├── main_v2.js
│   ├── view.js
│   ├── view2.js
│   ├── index.html         ← (nur Python rendet diese direkt)
│   ├── index_v2.html
│   ├── admin.html
│   ├── login.html
│   └── qr.html
│
├── static/                ← Statische Assets (beide Backends liefern diese aus)
│   ├── view.html
│   ├── view2.html
│   ├── main.css
│   ├── admin.js
│   ├── all.min.css
│   └── ...
│
└── php/                   ← PHP/MySQL-Backend (dieses Verzeichnis = Web-Root)
    ├── .htaccess          ← Apache RewriteRules
    ├── index.php          ← Router + alle Route-Handler
    ├── config.php         ← Konfiguration laden
    ├── db.php             ← MySQL PDO Datenbankschicht
    └── templates/         ← PHP-Templates (Ersatz für Jinja2-HTML-Templates)
        ├── login.php
        ├── index_v1.php
        ├── index_v2.php
        ├── admin.php
        └── qr.php
```

> **Hinweis zu `flask_templates/`:** Die JS-Dateien (`main.js`, `view.js` etc.) werden vom PHP-Backend direkt aus diesem Verzeichnis gelesen. Die Jinja2-`{{ variable }}`-Syntax wird dabei via PHP `str_replace` ersetzt. Die HTML-Templates werden **nicht** von PHP genutzt – dafür gibt es die eigenen PHP-Templates in `php/templates/`.

---

## Unterschiede zwischen den Implementierungen

| Aspekt | Python/Flask | PHP/MySQL |
|---|---|---|
| **Sprache/Framework** | Python 3 + Flask | PHP 8+ (kein Framework) |
| **Datenbank** | SQLite (Datei `data.sqlite`) | MySQL/MariaDB |
| **Passwort-Hashing** | werkzeug `pbkdf2:sha256:...` | PHP `password_hash()` (bcrypt) |
| **Sessions** | Flask signierte Cookies | PHP native Server-Sessions |
| **Routing** | Flask-Dekoratoren | `index.php` + Apache RewriteRules |
| **Templates** | Jinja2 (`{{ var }}`, `{% if %}`) | PHP (`<?= $var ?>`, `<?php if(): ?>`) |
| **SQL-Dump (`/backupsql`)** | SQLite `iterdump()` | PHP generiert INSERT-Statements |
| **Start** | `python server.py` | Apache/PHP-FPM (läuft immer) |
| **Port** | 8080 (konfigurierbar) | 80/443 (Apache) |

### Warum sind Passwort-Hashes inkompatibel?

Das Python-Backend verwendet werkzeug's PBKDF2-Format (`pbkdf2:sha256:260000$...`), PHP verwendet bcrypt. Da beide Backends **komplett getrennte Datenbanken** haben, spielt das keine Rolle – Benutzer werden in jeder Instanz frisch angelegt.

### Welche Routen/URLs gibt es?

Beide Backends bieten exakt dieselben URLs:

| URL | Beschreibung |
|---|---|
| `/` | Redirect → `/v2` |
| `/login` | Login-Seite |
| `/logout` | Abmelden |
| `/v1` | Hauptansicht (Version 1) |
| `/v2` | Hauptansicht (Version 2, Standard) |
| `/admin` | Admin-Bereich (nur für Admins) |
| `/backupsql` | SQL-Dump herunterladen (nur Admins) |
| `/action` | API-Endpunkt (POST, JSON) |
| `/api/ips` | Server-IP-Adressen |
| `/show_qr` | QR-Code-Seite |
| `/view` | Anzeigebildschirm (React, ohne Login) |
| `/view2` | Anzeigebildschirm Slideshow |
| `/main.js`, `/view.js`, … | Dynamisch gerenderte JS-Dateien |

---

## Lokaler Test ohne Apache

Für lokale Entwicklung und Tests reicht PHPs eingebauter Entwicklungsserver — kein Apache nötig. Die `.htaccess` wird dabei ignoriert, funktioniert aber trotzdem korrekt, weil `index.php` als direkter Router angegeben wird (s.u. bei Server starten) und alle Anfragen selbst verarbeitet (inklusive statischer Dateien aus `../static/`).

### Voraussetzungen lokal

- PHP 8.1+ mit `pdo_mysql` (`php -m | grep pdo_mysql`)
- MariaDB oder MySQL läuft lokal (`systemctl status mariadb`)

### Einmalig: Datenbank anlegen

```bash
sudo mysql -u root
```

```sql
CREATE DATABASE 24h_schwimmen CHARACTER SET utf8mb4;
CREATE USER 'schwimmen'@'localhost' IDENTIFIED BY 'swim_lokal';
GRANT ALL PRIVILEGES ON 24h_schwimmen.* TO 'schwimmen'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### `config.json` ergänzen

Im Projektwurzelverzeichnis (nicht in `php/`) die DB-Verbindung eintragen:

```json
"db_host": "localhost",
"db_name": "24h_schwimmen",
"db_user": "schwimmen",
"db_pass": "swim_lokal"
```

### Server starten

```bash
cd /pfad/zum/projekt/php
php -S localhost:8080 index.php
```

Dann im Browser: **`http://localhost:8080`**

Login: `admin` / Passwort aus `config.json` → `default_admin_pass` (Standard: `swim24`)

Beim ersten Aufruf legt PHP automatisch alle Tabellen und den Admin-Benutzer an.

> **Hinweis:** Der PHP-Entwicklungsserver ist nur für lokale Tests gedacht, nicht für den produktiven Betrieb.

---

## Installation auf einem Webserver

### Voraussetzungen

- Apache 2.4+ mit `mod_rewrite`
- PHP 8.1+ mit den Extensions: `pdo`, `pdo_mysql`
- MySQL 8.0+ oder MariaDB 10.6+

### Schritt 1: Dateien auf den Server kopieren

Das gesamte Projektverzeichnis (nicht nur `php/`) auf den Server übertragen, z. B. nach `/var/www/24hschwimmen/`:

```bash
# Beispiel mit rsync
rsync -av /pfad/zum/projekt/ benutzer@server:/var/www/24hschwimmen/
```

Die Verzeichnisstruktur auf dem Server muss so aussehen:
```
/var/www/24hschwimmen/
├── config.json
├── flask_templates/        ← wird vom PHP-Backend gebraucht!
├── static/                 ← wird vom PHP-Backend gebraucht!
└── php/                    ← das ist der Web-Root
```

### Schritt 2: MySQL-Datenbank anlegen

```sql
CREATE DATABASE 24h_schwimmen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'schwimmen'@'localhost' IDENTIFIED BY 'sicheres_passwort';
GRANT ALL PRIVILEGES ON 24h_schwimmen.* TO 'schwimmen'@'localhost';
FLUSH PRIVILEGES;
```

### Schritt 3: `config.json` anpassen

Die `config.json` im Projektwurzelverzeichnis um MySQL-Verbindungsdaten ergänzen:

```json
{
    "flask_secret_key": "Lang&Umständlich",
    "default_admin_pass": "swim24",
    "laenge_schwimmerNr_digits": 3,
    "laenge_bahn_m": 100,
    "fade_time_s": 600,
    "mobile_cards_col": 2,
    "view2_page_interval_s": 10,
    "startzeit": "2025-06-21T08:00:00Z",
    "swimmer_list_update_interval_s": 600,

    "db_host": "localhost",
    "db_name": "24h_schwimmen",
    "db_user": "schwimmen",
    "db_pass": "sicheres_passwort"
}
```

### Schritt 4: Apache VirtualHost konfigurieren

Beispiel für `24schwimmen.unterrichtsportal.org` mit dem Web-Root auf `php/`:

```apache
<VirtualHost *:80>
    ServerName 24schwimmen.unterrichtsportal.org

    DocumentRoot /var/www/24hschwimmen/php
    DirectoryIndex index.php

    <Directory /var/www/24hschwimmen/php>
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog  ${APACHE_LOG_DIR}/24schwimmen_error.log
    CustomLog ${APACHE_LOG_DIR}/24schwimmen_access.log combined
</VirtualHost>
```

Speichern als `/etc/apache2/sites-available/24schwimmen.conf`, dann aktivieren:

```bash
a2ensite 24schwimmen
a2enmod rewrite
systemctl reload apache2
```

### Schritt 5: HTTPS (empfohlen)

Mit Certbot/Let's Encrypt:

```bash
certbot --apache -d 24schwimmen.unterrichtsportal.org
```

### Schritt 6: Dateiberechtigungen prüfen

PHP (der Apache-User `www-data`) braucht Lesezugriff auf:
- `/var/www/24hschwimmen/config.json`
- `/var/www/24hschwimmen/flask_templates/` (JS-Templates)
- `/var/www/24hschwimmen/static/` (statische Assets)
- `/var/www/24hschwimmen/php/` (PHP-Dateien)

```bash
chown -R www-data:www-data /var/www/24hschwimmen/
chmod -R 755 /var/www/24hschwimmen/
```

### Schritt 7: Erster Aufruf

Beim ersten Aufruf von `https://24schwimmen.unterrichtsportal.org/` erstellt PHP automatisch:
- alle Datenbanktabellen (via `CREATE TABLE IF NOT EXISTS`)
- den Benutzer `admin` mit dem Passwort aus `config.json` → `default_admin_pass`

---

## Konfigurationsreferenz (`config.json`)

| Schlüssel | Typ | Beschreibung |
|---|---|---|
| `default_admin_pass` | String | Initiales Passwort für den `admin`-Benutzer |
| `laenge_schwimmerNr_digits` | Integer | Stellen der Schwimmernummer (z. B. `3` → `007`) |
| `laenge_bahn_m` | Integer | Bahnlänge in Metern (für Streckenberechnung) |
| `fade_time_s` | Integer | Sekunden bis Schwimmer-Karte verblasst (0 = aus) |
| `mobile_cards_col` | Integer | Spaltenanzahl auf Mobilgeräten |
| `view2_page_interval_s` | Integer | Seitenumblätterintervall bei View 2 |
| `startzeit` | ISO 8601 | Wettkampfbeginn (für Zeitberechnungen in der View) |
| `swimmer_list_update_interval_s` | Integer | Aktualisierungsintervall der Schwimmerliste (View) |
| `db_host` | String | **PHP only** – MySQL-Host |
| `db_name` | String | **PHP only** – MySQL-Datenbankname |
| `db_user` | String | **PHP only** – MySQL-Benutzer |
| `db_pass` | String | **PHP only** – MySQL-Passwort |
| `flask_secret_key` | String | **Python only** – Schlüssel für Flask-Sessions |

---

## Logging

Das PHP-Backend verwendet dasselbe Logging-Konzept wie die Python-Version: zwei Ausgabekanäle, drei Schweregrade.

### Ausgabekanäle

| Kanal | Wo | Was |
|---|---|---|
| **Datei** | `data/serverlog_php.log` | alle Meldungen ab DEBUG |
| **Konsole / Terminal** | stderr (sichtbar im Terminal bei `php -S`, im Apache-Error-Log auf dem Server) | INFO und ERROR |

### Schweregrade

| Level | Bedeutung | Beispiele |
|---|---|---|
| `DEBUG` | Detailinfos für Entwicklung | „ADD ist ausgeführt", „Aktion eingetragen: NEW" |
| `INFO` | Normaler Betrieb | Login, ADD/ACT-Kommandos, Admin-Aktionen, Importe |
| `ERROR` | Fehler | DB-Fehler, ungültige Parametern, Rollback |

### Log-Format

Identisch zur Python-Version:

```text
2026-06-21 17:08:09 - INFO - ADD wird ausgeführt: Schwimmer 222, Anzahl 1, BahnNr 1
2026-06-21 17:08:09 - DEBUG - ADD ist ausgeführt
2026-06-21 17:08:12 - ERROR - DB-Fehler: SQLSTATE[42000]: ...
```

### Einstellungen anpassen

Die Konfiguration steht am Anfang der Klasse in `php/logger.php`:

```php
private static int $fileLevel    = self::DEBUG;  // ab hier in Datei schreiben
private static int $consoleLevel = self::INFO;   // ab hier ins Terminal/Apache-Log
```

**Mögliche Kombinationen:**

| Ziel | `$fileLevel` | `$consoleLevel` |
|---|---|---|
| Alles überall (Maximum) | `self::DEBUG` | `self::DEBUG` |
| Standard (wie Python) | `self::DEBUG` | `self::INFO` |
| Nur Fehler im Terminal | `self::DEBUG` | `self::ERROR` |
| Nur Fehler, keine Datei | `self::ERROR` | `self::ERROR` |

### Log-Datei ansehen

```bash
# Live mitlesen
tail -f data/serverlog_php.log

# Nur Fehler
grep ERROR data/serverlog_php.log

# Nur heutige Einträge
grep "$(date +%Y-%m-%d)" data/serverlog_php.log
```

Auf dem Webserver landet die Konsolen-Ausgabe (INFO+) im Apache-Error-Log — es gibt also zwei aktive Log-Orte gleichzeitig:

```bash
# Anwendungs-Log (DEBUG+, alle Meldungen)
tail -f /var/www/24hschwimmen/data/serverlog_php.log

# Apache-Error-Log (INFO+, via error_log())
tail -f /var/log/apache2/24schwimmen_error.log
```

Wer auf dem Server nur einen Log-Ort möchte, setzt in `php/logger.php` `$consoleLevel = self::ERROR` — dann erscheinen im Apache-Log nur noch Fehler, alles andere landet ausschließlich in der Datei.

---

## Häufige Probleme

**„RewriteEngine not allowed here" / `.htaccess` wird ignoriert**
→ `AllowOverride All` in der Apache-Konfiguration fehlt, oder `mod_rewrite` ist nicht aktiv.

**„SQLSTATE[HY000] [1049] Unknown database"**
→ Datenbank wurde noch nicht angelegt (Schritt 2).

**Weiße Seite / PHP-Fehler**
→ PHP-Error-Log prüfen: `tail -f /var/log/apache2/24schwimmen_error.log`

**Statische Assets (CSS, Icons) laden nicht**
→ Prüfen, ob `static/` auf dem Server vorhanden ist und ob Apache Lesezugriff hat.

**JS-Dateien (main.js etc.) geben 500 zurück**
→ Prüfen, ob `flask_templates/` auf dem Server vorhanden ist — PHP liest die Original-JS-Dateien von dort.
