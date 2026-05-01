import sqlite3
import atexit
import random
from datetime import datetime
import logging
from logging_config import configure_logging
from werkzeug.security import generate_password_hash, check_password_hash


# Konfiguration des Loggings
configure_logging()

# Logger verwenden
logger = logging.getLogger()

DB_NAME = "data.sqlite"

class Database:
    def __init__(self, db_name=DB_NAME):
        """
        Initialisiert die Datenbankverbindung. 
        Wird einmalig beim Start der Anwendung aufgerufen.
        """
        self.begin = False
        self.db_name = db_name
        self.conn = None
        self.cursor = None
        self.connect()  # Verbindung herstellen

    def setBegin(self, value = True):
        if (self.begin != value):
            self.begin = value
            if (value):
                self.conn.execute("BEGIN")
            else:
                self.conn.commit()

    def connect(self):
        """
        Stellt die Verbindung zur SQLite-Datenbank her.
        """
        try:
            #TODO: Darüber nachdenken, wie man same thread-Problematik dauerhaft löst
            self.conn = sqlite3.connect(self.db_name, check_same_thread=True)
            self.conn.row_factory = sqlite3.Row  # Für dict-ähnliche Zeilen
            self.cursor = self.conn.cursor()
            self.begin = False
            logging.debug("Database.connect - Datenbankverbindung hergestellt.")
        except sqlite3.DatabaseError as e:
            logging.error(f"Database.connect - Fehler beim Verbinden zur Datenbank: {e}")
            self.conn = None
            self.cursor = None

    def execute(self, query, params=None):
        """
        Führt eine SQL-Abfrage aus und behandelt Verbindungsfehler.
        """
        if self.conn is None:
            logging.error("Database execute: Keine Datenbankverbindung. Versuche Wiederverbindung.")
            logging.debug(f"Query: {query}, params:{params}")
            self.connect()  # Versuche erneut, die Verbindung herzustellen
            
            if self.conn is None:
                logging.error("Datenbankverbindung konnte nicht wiederhergestellt werden.")
                return None
        
        try:
            if params is None:
                params = []
            self.cursor.execute(query, params)
            if (not self.begin): self.conn.commit()
            return self.cursor
        except sqlite3.OperationalError as e:
            logging.error(f"OperationalError: {e}")
            logging.debug(f"execute - query: {query}, params: {params}")
        except sqlite3.IntegrityError as e:
            logging.error(f"Integritätsfehler: {e}")    
            logging.debug(f"execute - query: {query}, params: {params}")
        except sqlite3.DatabaseError as e:
            logging.error(f"Fehler bei der SQL-Abfrage: {e}")
            logging.debug(f"execute - query: {query}, params: {params}")
            self.conn = None
            self.cursor = None  # Setze den Cursor auf None, damit bei der nächsten Abfrage ein Fehler festgestellt wird
        except Exception as e:
            logging.error(f"Fehler beim query {e}")
            return None
        
        logging.debug("db.execute gibt None zurück")
        return None

    def fetchall(self, query, params=None):
        """
        Holt alle Ergebnisse einer SELECT-Abfrage und behandelt Verbindungsfehler.
        """
        if self.conn is None:
            logging.error("Keine Datenbankverbindung. Versuche Wiederverbindung.")
            logging.debug(f"fetchall - query: {query}, params: {params}")
            self.connect()  # Versuche erneut, die Verbindung herzustellen
            
            if self.conn is None:
                logging.error("Datenbankverbindung konnte nicht wiederhergestellt werden.")
                return []
        
        try:
            if params is None:
                params = []
            self.cursor.execute(query, params)
            return self.cursor.fetchall()
        except sqlite3.DatabaseError as e:
            logging.error(f"Fehler bei der SQL-Abfrage: {e}")
            logging.debug(f"fetchall - query: {query}, params: {params}")
            self.conn = None
            self.cursor = None
            return []

    def fetchone(self, query, params=None):
        """
        Holt ein einzelnes Ergebnis einer SELECT-Abfrage und behandelt Verbindungsfehler.
        """
        if self.conn is None:
            logging.error("Keine Datenbankverbindung. Versuche Wiederverbindung.")
            logging.debug(f"fetchone - query: {query}, params: {params}")
            self.connect()  # Versuche erneut, die Verbindung herzustellen
            
            if self.conn is None:
                logging.error("Datenbankverbindung konnte nicht wiederhergestellt werden.")
                return None
        
        try:
            if params is None:
                params = []
            self.cursor.execute(query, params)
            return self.cursor.fetchone()
        except sqlite3.DatabaseError as e:
            logging.error(f"Fehler bei der SQL-Abfrage: {e}")
            self.conn = None
            self.cursor = None
            return None

    def close(self):
        """
        Schließt die Datenbankverbindung.
        """
        if self.conn:
            self.conn.close()
            logging.debug("Datenbankverbindung geschlossen.")


# ===================================================
# DATENBANK-INITIALISIERUNG UND ALLGEMEINE METHODEN
# ===================================================
"""
Initialisiert die SQLite-Datenbank mit den Tabellen:
- Benutzer
- Clients
- Actions
- Schwimmer

liste_tabelle
dict_from_row-Methode
"""

def init_db():
    """
    Initialisiert die Datenbank und erstellt alle notwendigen Tabellen, falls sie noch nicht existieren.
    """
    # Tabellen erstellen
    query_benutzer = '''
        CREATE TABLE IF NOT EXISTS benutzer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            benutzername TEXT UNIQUE NOT NULL,
            passwort TEXT NOT NULL,
            admin BOOLEAN NOT NULL DEFAULT 0
        )
    '''
    db.execute(query_benutzer)

    query_clients = '''
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            benutzer_id INTEGER,
            zeitpunkt_letzte_aktion TEXT,
            FOREIGN KEY (benutzer_id) REFERENCES benutzer(id)
        )
    '''
    db.execute(query_clients)

    query_schwimmer = '''
        CREATE TABLE IF NOT EXISTS schwimmer (
            nummer INTEGER NOT NULL PRIMARY KEY,
            erstellt_von_client_id INTEGER,
            vorname TEXT,
            nachname TEXT,
            istKind INTEGER,
            gruppe TEXT,
            bahnanzahl INTEGER,
            strecke INTEGER,
            auf_bahn INTEGER,
            aktiv BOOLEAN,
            FOREIGN KEY (erstellt_von_client_id) REFERENCES clients(id)
        )
    '''
    db.execute(query_schwimmer)

    query_actions = '''
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            benutzer_id INTEGER,
            client_id INTEGER,
            zeitstempel TEXT,
            kommando TEXT,
            parameter TEXT,
            FOREIGN KEY (benutzer_id) REFERENCES benutzer(id),
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )
    '''
    db.execute(query_actions)

def dict_from_table_row(row, table_name):
    """
    Wandelt eine Datenbankzeile (Tupel) in ein Dictionary um.
    """
    if table_name == 'benutzer':
        columns = ['id', 'name', 'benutzername', 'passwort', 'admin']
    elif table_name == 'clients':
        columns = ['id', 'ip', 'benutzer_id', 'zeitpunkt_letzte_aktion']
    elif table_name == 'schwimmer':
        columns = ['nummer', 'erstellt_von_client_id', 'vorname', 'nachname', 'istKind', 'gruppe', 'bahnanzahl', 'strecke', 'auf_bahn', 'aktiv']
    elif table_name == 'actions':
        columns = ['id', 'benutzer_id', 'client_id', 'zeitstempel', 'kommando', 'parameter']
    else:
        return None
    return dict(zip(columns, row)) if (row != None) else {}

def dict_from_row(row, columns):
    """
    Wandelt eine Datenbankzeile (Tupel) in ein Dictionary um, basierend auf den Spaltennamen.
    """
    return dict(zip(columns, row)) if row is not None else {}

def liste_tabelle(table_name):
    """
    Gibt eine Liste aller Einträge aus der angegebenen Tabelle zurück, mit Spaltennamen aus der DB.
    """
    try:
        cursor = db.execute(f"SELECT * FROM {table_name}")
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict_from_row(row, columns) for row in rows]
    except Exception as e:
        print(f"Fehler beim Zugriff auf Tabelle {table_name}: {e}")
        return []


def count_tabelle(table_name):
    """Gibt die Gesamtanzahl der Zeilen in der angegebenen Tabelle zurück."""
    try:
        cursor = db.execute(f"SELECT COUNT(*) FROM {table_name}")
        return cursor.fetchone()[0]
    except Exception as e:
        print(f"Fehler beim Zählen in Tabelle {table_name}: {e}")
        return 0

def liste_tabelle_paged(table_name, limit, offset):
    """
    Gibt einen Ausschnitt der Tabelle zurück, neueste Einträge zuerst (rowid DESC).
    limit:  Anzahl Zeilen pro Seite
    offset: Übersprungene Zeilen (= (Seite-1) * limit)
    """
    try:
        cursor = db.execute(
            f"SELECT * FROM {table_name} ORDER BY rowid DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict_from_row(row, columns) for row in rows]
    except Exception as e:
        print(f"Fehler beim paginierten Zugriff auf Tabelle {table_name}: {e}")
        return []


def dump():
    """
    gibt einen Dump der Datenbank zurück, der per Flask zum Download angeboten werden kann
    """
    dump = "\n".join(db.conn.iterdump())
    db.conn.commit()
    return dump;


# =======================================
# SCHWIMMER-VERWALTUNG
# =======================================
"""
Funktionen zur Verwaltung von Schwimmern:
- Schwimmer erstellen
- Schwimmer suchen
- Schwimmer aktualisieren
- Schwimmer Bahnanzahl ändern
- Schwimmer löschen
"""

# Sucht einen Schwimmer anhand seines Namens
def finde_schwimmer(name):
    """
    Sucht einen Schwimmer anhand seines Namens.
    """
    query = "SELECT * FROM schwimmer WHERE name = ?"
    params = (name,)
    return dict_from_table_row(db.fetchone(query, params),"schwimmer")


# Liest einen Schwimmer anhand seiner ID aus der Datenbank
def lies_schwimmer(schwimmer_id):
    """
    Liest einen Schwimmer anhand seiner ID aus der Datenbank.
    """
    query = "SELECT * FROM schwimmer WHERE nummer = ?"
    params = (schwimmer_id,)
    return dict_from_table_row(db.fetchone(query, params),"schwimmer")

# Liest alle Schwimmer von der Bahn
def lies_schwimmer_vonBahn(bahnnr):
    """
    Gibt eine Liste aller Schwimmer auf der angegebenen Bahn
    """
    try:
        
        cursor = db.execute(f"SELECT * FROM schwimmer WHERE auf_bahn == ?", [int(bahnnr)])
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict_from_row(row, columns) for row in rows]
    except Exception as e:
        print(f"Fehler beim Zugriff auf Tabelle schwimmer (auf Bahn {bahnnr}): {e}")
        return []

# Aktualisiert die Felder eines Schwimmers anhand der ID oder legt diesen an
# Die zu aktualisierenden Felder werden dynamisch übergeben, z. B.:
# update_schwimmer(1, bahnanzahl=5, aktiv=0)
# Das funktioniert durch **kwargs, womit beliebige Schlüssel-Wert-Paare übergeben werden können.
def insertOrUpdateSchwimmer(nummer, **kwargs):
    logging.info(f"Schwimmer Nr {nummer} wird aktualisiert: {kwargs}")
    cursor = update_schwimmer(nummer, **kwargs)
    if ( not cursor) :
        #Schwimmer muss neu angelegt werden
        logging.info("  ... muss neu angelegt werden")
        erstellt_von_client_id = kwargs.get('erstellt_von_client_id', 0)
        vorname = kwargs.get('vorname', f"Schwimmer {nummer}")
        nachname = kwargs.get('nachname',"-")
        istKind = kwargs.get('istKind',0)
        gruppe = kwargs.get('gruppe','')
        bahnanzahl = kwargs.get('bahnanzahl',0)
        strecke = kwargs.get('strecke',0)
        auf_bahn = kwargs.get('auf_bahn', 0)
        aktiv = kwargs.get('aktiv',1) 

        return erstelle_schwimmer(nummer, erstellt_von_client_id, vorname, nachname, istKind, gruppe, bahnanzahl, strecke, auf_bahn, aktiv)
    return cursor
    

# Aktualisiert Felder eines Schwimmers anhand der ID
# Die zu aktualisierenden Felder werden dynamisch übergeben, z. B.:
# update_schwimmer(1, bahnanzahl=5, aktiv=0)
# Das funktioniert durch **kwargs, womit beliebige Schlüssel-Wert-Paare übergeben werden können.
def update_schwimmer(schwimmer_id, **kwargs):
    """
    Aktualisiert Felder eines Schwimmers anhand der ID.
    Die zu aktualisierenden Felder werden dynamisch übergeben, z. B.:
    update_schwimmer(1, bahnanzahl=5, aktiv=0)
    Das funktioniert durch **kwargs, womit beliebige Schlüssel-Wert-Paare übergeben werden können.
    """
    # Baut dynamisch das SET-Statement für SQL, z. B. "bahnanzahl=?, aktiv=?"
    keys = ', '.join([f"{k}=?" for k in kwargs])
    values = list(kwargs.values()) + [schwimmer_id]
    query = f"UPDATE schwimmer SET {keys} WHERE nummer = ?"
    cursor = db.execute(query, values)
    if (cursor and cursor.rowcount == 0): return None
    return cursor

# Legt einen neuen Schwimmer in der Datenbank an und gibt die neue ID zurück
def erstelle_schwimmer(nummer, erstellt_von_client_id, vorname, nachname, istKind, gruppe, bahnanzahl, strecke, auf_bahn, aktiv):
    """
    Legt einen neuen Schwimmer in der Datenbank an und gibt die neue ID zurück.
    """
    query = """
        INSERT INTO schwimmer (nummer, erstellt_von_client_id, vorname, nachname, istKind, gruppe, bahnanzahl, strecke, auf_bahn, aktiv)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    params = (nummer, erstellt_von_client_id, vorname, nachname, istKind, gruppe, bahnanzahl, strecke, auf_bahn, aktiv)
    return db.execute(query, params)

def get_bahnanzahl(nummer):
    result=db.fetchone("SELECT bahnanzahl FROM schwimmer WHERE nummer = ?", (nummer,))
    
    if result is None:
        return None  # Schwimmer existiert nicht
    return result[0]  # Bahnanzahl

def aendere_bahnanzahl_um(nummer, anzahl, client_id, bahnnr=0):
    """
    Ändert die Bahnanzahl eines Schwimmers. 
    Falls der Schwimmer nicht existiert, wird er mit Standardwerten angelegt.
    """
    bahnanzahl = get_bahnanzahl(int(nummer))
    logging.info(f"Schwimmer Ändern mit Nummer {nummer}")
    #print(schwimmer if (schwimmer) else f"Schwimmer {nummer} Nicht gefunden")
    
    if bahnanzahl is None:
        # Schwimmer existiert nicht → neu anlegen
        logging.info(f"Schwimmer {nummer} wird neu angelegt")
        if (not erstelle_schwimmer(
            nummer=nummer,
            erstellt_von_client_id=client_id,
            vorname=f"Schwimmer {nummer}",
            nachname="-",
            istKind = 0,
            gruppe = '',
            bahnanzahl=max(anzahl, 0),
            strecke=0,
            auf_bahn=bahnnr,
            aktiv=1
        )):
            logging.error(f"Schwimmer {nummer} konnte nicht erstellt werden")
            raise AttributeError('Schwimmer konnte nicht erstellt werden')
    else:
        # Schwimmer existiert → Bahnanzahl ändern
        neue_bahnanzahl = bahnanzahl + anzahl
        if neue_bahnanzahl < 0:
            neue_bahnanzahl = 0
        if (not update_schwimmer(int(nummer), bahnanzahl=neue_bahnanzahl, auf_bahn=bahnnr)):
            logging.error(f"Schwimmer {nummer} konnte nicht aktualisert werden - neue Bahnazahl {neue_bahnanzahl}")
            raise AttributeError('Schwimmer konnte nicht aktualisiert werden')

def loesche_schwimmer(schwimmerID):
    """
    Löscht einen Schwimmer anhand des Schwimmernr aus der Datenbank.
    gibt die Anzahl der betroffenen Zeilen (in der Regel 1 oder 0) zurück oder
    None im Fehlerfall.
    """
    logging.info(f"Schwimmer löschen: {schwimmerID}")
    query = '''
        DELETE FROM schwimmer
        WHERE nummer = ?
    '''
    params = (int(schwimmerID),)
    cursor =  db.execute(query, params)
    if (cursor):
        rows_affected = cursor.rowcount
        if rows_affected == 0:
            return None
        if rows_affected > 0:
            return rows_affected
    return cursor

#========================
#    Abschnitt: Clients
#======================== 

def erstelle_client(ip, benutzer_id=None):
    """
    Fügt einen neuen Client in die Datenbank ein.

    Parameter:
    - ip (str): IP-Adresse des Clients
    - benutzer_id (int, optional): ID des zugeordneten Benutzers, kann None sein
    """
    logger.debug(f"Client mit IP {ip} und benutzer_id {benutzer_id} wird erstellt")
    query = '''
        INSERT INTO clients (ip, benutzer_id, zeitpunkt_letzte_aktion)
        VALUES (?, ?, ?)
    '''
    params = (ip, benutzer_id, datetime.now().isoformat())
    db.execute(query, params)
    #print("LASTID:",db.cursor.lastrowid)
    return db.cursor.lastrowid

def finde_client(ip):
    """
    Sucht einen Client anhand seiner IP-Adresse.
    """
    query = 'SELECT * FROM clients WHERE ip = ?'
    params = (ip,)
    client = dict(db.fetchone(query, params))
    return client


def update_client_aktion(client_id):
    """
    Aktualisiert den Zeitstempel der letzten Aktion eines Clients.
    """
    query = 'UPDATE clients SET zeitpunkt_letzte_aktion = ? WHERE id = ?'
    params = (datetime.now().isoformat(), client_id)
    db.execute(query, params)

#========================
#    Abschnitt: Benutzer
#======================== 

def erstelle_benutzer(name, benutzername, passwort, admin=False):
    """
    Fügt einen neuen Benutzer zur Datenbank hinzu.
    Gibt die ID des neuen Benutzers zurück.
    """
    query = '''
        INSERT INTO benutzer (name, benutzername, passwort, admin)
        VALUES (?, ?, ?, ?)
    '''
    params = (name, benutzername, generate_password_hash(passwort), int(admin))
    return db.execute(query, params)


def passwort_aendern(benutzername, neues_passwort):
    """
    Ändert das Passwort eines Benutzers.
    """
    neues_gehashtes_passwort = generate_password_hash(neues_passwort)
    update_query = "UPDATE benutzer SET passwort = ? WHERE benutzername = ?"
    cursor = db.execute(update_query, (neues_gehashtes_passwort, benutzername))
    if (cursor):
        rows_affected = cursor.rowcount
        if rows_affected == 0:
            return None
    return cursor

def loesche_userID(userID):
    """
    Löscht einen Benutzer anhand der BenutzerID aus der Datenbank.
    gibt die Anzahl der betroffenen Zeilen (in der Regel 1 oder 0) zurück oder
    None im Fehlerfall.
    """
    logging.info(f"Benutzer löschen: {userID}")
    query = '''
        DELETE FROM benutzer
        WHERE id = ?
    '''
    params = (int(userID),)
    cursor =  db.execute(query, params)
    if (cursor):
        rows_affected = cursor.rowcount
        if rows_affected == 0:
            return None
        if rows_affected > 0:
            return rows_affected
    return cursor


def loesche_benutzername(benutzername):
    """
    Löscht einen Benutzer anhand des Benutzernamens aus der Datenbank.
    Gibt die Anzahl der betroffenen Zeilen zurück.
    """
    query = '''
        DELETE FROM benutzer
        WHERE benutzername = ?
    '''
    params = (benutzername,)
    return db.execute(query, params)


def finde_benutzer_by_username(benutzername):
    """
    Gibt einen Benutzer als Dictionary zurück, der dem Benutzernamen entspricht.
    """
    query = 'SELECT * FROM benutzer WHERE benutzername = ?'
    params = (benutzername,)
    row = db.fetchone(query, params)
    return dict_from_table_row(row,'benutzer') if row else None

#========================
#    Abschnitt: Actions
#======================== 

def erstelle_action(benutzer_id, client_id, zeitstempel, kommando, parameter):
    """
    Fügt eine NEUE Action zur Datenbank hinzu.
    Gibt die Anzahl der eingetragenen Zeilen zurück (also 0 oder 1) .
    """
    #Prüfen ob der Eintrag schon existiert
    query = '''
    SELECT 1 FROM actions
    WHERE zeitstempel = ? AND kommando = ? AND parameter = ?
    LIMIT 1
    '''
    params = (zeitstempel, kommando, parameter)
    cursor = db.execute(query, params)
    exists = cursor.fetchone() is not None
    if (exists): return 0 #Kein neuer Eintrag
    query = '''
        INSERT INTO actions (benutzer_id, client_id, zeitstempel, kommando, parameter)
        VALUES (?, ?, ?, ?, ?)
    '''
    params = (benutzer_id, client_id, zeitstempel, kommando, parameter)
    cursor = db.execute(query, params) 
    return (cursor.rowcount if cursor else 0)

def erstelle_actions(actionliste):
    """
    Fügt eine neue Action zur Datenbank hinzu.
    Gibt die ID der neuen Action zurück.
    """
    query = '''
        INSERT INTO actions (benutzer_id, client_id, zeitstempel, kommando, parameter)
        VALUES (?, ?, ?, ?, ?)
    '''
    db.cursor.executemany(query, actionliste)
    if (not db.begin): db.conn.commit()
    return db.cursor



def finde_actions_by_benutzer_id(benutzer_id):
    """
    Gibt eine Liste aller Actions zurück, die dem Benutzer mit der gegebenen ID entsprechen.
    """
    query = 'SELECT * FROM actions WHERE benutzer_id = ?'
    params = (benutzer_id,)
    rows = db.fetchall(query, params)
    return [dict_from_table_row(row, 'actions') for row in rows]

def finde_actions_by_client_id(client_id):
    """
    Gibt eine Liste aller Actions zurück, die dem Client mit der gegebenen ID entsprechen.
    """
    query = 'SELECT * FROM actions WHERE client_id = ?'
    params = (client_id,)
    rows = db.fetchall(query, params)
    return [dict_from_table_row(row, 'actions') for row in rows]

def finde_action_by_id(action_id):
    """
    Gibt die Action mit der gegebenen ID zurück.
    """
    query = 'SELECT * FROM actions WHERE id = ?'
    params = (action_id,)
    row = db.fetchone(query, params)
    return dict_from_table_row(row, 'actions') if row else None

def finde_actions_after_timestamp(timestamp):
    """
    Gibt alle Actions zurück, die nach dem angegebenen Zeitstempel stattgefunden haben.
    """
    query = 'SELECT * FROM actions WHERE zeitstempel > ?'
    params = (timestamp,)
    rows = db.fetchall(query, params)
    return [dict_from_table_row(row, 'actions') for row in rows]


#========================
#    Testabschnitt
#======================== 

def checkBahnenAnzahlen():
    """
    Prüft ob die Bahnanzahlen in der Actionstabelle mit denen in der Schwimmer DB
    übereinstimen und gibt die Unterschiede zurück
    """
    query = """select 
    a.schwimmerID,
    s.vorname,
    s.bahnanzahl as Anz,
    a.anzahl as ActionAnz,
    a.kommando
    FROM (
    SELECT
        kommando,
        CAST(json_extract(parameter, '$[0]') AS INTEGER) AS schwimmerID, 
        count(json_extract(parameter, '$[1]')) AS anzahl 
    FROM actions 
    WHERE kommando = "ADD" 
    GROUP BY schwimmerID 
    ) a
    JOIN schwimmer s ON s.nummer = a.schwimmerID 
    WHERE Anz <> ActionAnz
    ORDER BY schwimmerID ASC;
    """
    try:
        cursor = db.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [dict_from_row(row, columns) for row in rows]
    except Exception as e:
        print(f"Fehler beim Datenbank-CheckBahnenanzahl: {e}")
        return []


if __name__ == "__main__":
    # Globale Instanz der Database-Klasse
    db = Database()

    # Automatisch beim Programmende die Verbindung schließen
    atexit.register(db.close)
    
    init_db()

    #print(checkBahnenAnzahlen())

    # Setze den DB-Namen auf eine Testdatenbank
    DB_NAME = "testdata.sqlite"

    # Erstelle ein neues Database-Objekt mit der Test-Datenbank
    db = Database(DB_NAME)

    # Teste die Methoden
    print("Test der Methoden in der Testdatenbank:")
    
    # Initialisiere die Datenbank (wird Tabellen erstellen)
    init_db()

    # Beispiel: Benutzer hinzufügen und abfragen
    print("\nHinzufügen eines neuen Benutzers...")
    erstelle_benutzer("Test User", f"testuser{random.randint(10,99)}", "password123", admin=False)
    benutzer = liste_tabelle('benutzer')
    print(f"Benutzer in der Datenbank: {benutzer}")

    # Beispiel: Client hinzufügen und abfragen
    print("\nHinzufügen eines neuen Clients...")
    erstelle_client("192.168.1.1", 1)
    clients = finde_client("192.168.1.1")
    print(f"Clients in der Datenbank: {clients}")

    # Beispiel: Schwimmer hinzufügen und abfragen
    print("\nHinzufügen eines neuen Schwimmers...")
    erstelle_schwimmer(random.randint(50,800), random.randint(0,4), "Max", "Mustermann", 0, "DLRG", 3, 400, 1, True)
    aendere_bahnanzahl_um(123,1,7)
    update_schwimmer(123, vorname="Maxi")
    insertOrUpdateSchwimmer(random.randint(50,800), vorname="Hans", gruppe="THW")
    schwimmer = liste_tabelle('schwimmer')
    print(f"Schwimmer in der Datenbank: {schwimmer}")
    
    # Beispiel: Action hinzufügen und abfragen (falls du eine action-tabelle hast)
    print("\nHinzufügen einer neuen Action...")
    erstelle_action(1, 1,datetime.now().strftime('%Y-%m-%d %H:%M:%S'),  'login', 'param1')
    actions = liste_tabelle('actions')
    print(f"Actions in der Datenbank: {actions}")

    # Beispiel: Abfragen von Actions nach einem bestimmten Zeitstempel
    timestamp = '2025-04-21 00:00:00'
    print(f"\nAbfragen von Actions nach dem Zeitstempel {timestamp}...")
    actions_after_timestamp = finde_actions_after_timestamp(timestamp)
    print(f"Actions nach {timestamp}: {actions_after_timestamp}")
