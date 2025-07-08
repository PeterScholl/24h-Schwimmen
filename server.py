import os, sys
import re #Regular Expressions
import json
import db
from datetime import datetime
import logging
from flask import g, Flask, Response, request, jsonify, send_from_directory, redirect, url_for, session, render_template_string, render_template
from logging_config import configure_logging
from utils import generiere_passwort, get_all_ips
from werkzeug.security import check_password_hash


# Konfiguration des Loggings
configure_logging()

# Logger verwenden
logger = logging.getLogger()

# Konfiguration laden
if getattr(sys, 'frozen', False):  # Ausgeführt als .exe (gefrorener Zustand)
    base_path = os.path.dirname(sys.executable)
else:   # Ausgeführt als .py
    base_path = os.path.dirname(os.path.abspath(__file__))

config_path = os.path.join(base_path, 'config.json')
try:
    with open(config_path, encoding="utf-8") as f:
        config =json.load(f)
        logger.info("Konfiguration geladen")
except json.JSONDecodeError as e:
    print(f"Fehler beim JSON-Decode der Konfiguration: {e}")
    logger.error(f"Fehler beim JSON-Decode der Konfiguration: {e}")
    sys.exit(0)
except Exception as e:
    print("Fehler beim lesen der Konfiguration")
    logger.error("allgemeiner Fehler beim lesen der Konfiguration")
    sys.exit(0)


app = Flask(__name__, static_folder="static", template_folder="flask_templates")
app.secret_key = config["flask_secret_key"]  # nötig für Sessions
if not app.secret_key:
    print("Fehler: 'flask_secret_key' fehlt in der config.json.")
    logger.error("Fehler: 'flask secret_key' fehlt in der config.json.")
    sys.exit(1)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['DEBUG'] = True

def get_db():
    if 'db' not in g:
        g.db = db.Database()
    return g.db

# Benutzer admin prüfen
with app.app_context():
    db.db = get_db()
    if not db.finde_benutzer_by_username("admin"):
        passwort = config["default_admin_pass"]
        db.init_db()
        if not passwort:
            passwort = generiere_passwort()

        print(f"Benutzer 'admin' wird angelegt mit passwort: {passwort}")
        db.erstelle_benutzer("Administrator", "admin", passwort, admin=True)



# Dateien sicherstellen
os.makedirs("data", exist_ok=True)

#Datenbankverbindung nach request schliessen
@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# Immer prüfen, ob der Benutzer angemeldet ist
# bzw. zur Login-Seite durchlassen
@app.before_request
def before_request():
    # Überprüfen, ob der Benutzer authentifiziert ist
    if 'user' not in session and request.endpoint != 'login':
        return redirect(url_for('login'))  # Wenn der Benutzer nicht eingeloggt ist, zur Login-Seite weiterleiten

@app.route('/login', methods=['GET', 'POST'])
def login():
    db.db = get_db()
    if request.method == 'POST':
        benutzername = request.form.get('benutzername', '').lower()
        passwort = request.form['passwort']

        # Benutzerdaten aus der Datenbank holen
        benutzer = db.finde_benutzer_by_username(benutzername)
        
        if benutzer and check_password_hash(benutzer['passwort'], passwort):  # Passwort prüfen (angenommen, es ist gehasht)
            # Erfolgreich eingeloggt, Benutzer zur Hauptseite weiterleiten
            session['user'] = benutzername  # Benutzername in der Session speichern
            session['realname'] = benutzer['name']
            session['clientID'] = db.erstelle_client(request.remote_addr,benutzer['id']) #Speichere die ClientID in der Session
            if benutzer['admin']:
                logging.info(f"Admin-Benutzer {benutzername} angemeldet")
                session['user_role']='admin'
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error=True)  # Login-Seite anzeigen
            #return 'Falscher Benutzername oder Passwort', 401  # Fehler bei der Anmeldung

    return render_template('login.html')  # Login-Seite anzeigen

@app.route("/logout", methods=['GET', 'POST'])
def logout():
    #session.pop("user", None)
    session.clear() # alle infos löschen
    return redirect(url_for("login"))

#****************************
#  Admin-Angelegenheiten
#****************************

@app.route('/backupsql', methods=['GET', 'POST'])
def backupsql():
    db.db = get_db()
    if session.get('user_role') != 'admin':
        return "Zugriff verweigert", 403
    return Response(db.dump(), mimetype="text/plain", headers={"Content-Disposition": "attachment;filename=backup.sql"
                                                                       })
 

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if session.get('user_role') != 'admin':
        return "Zugriff verweigert", 403

    db.db = get_db()
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form
        action = data.get('action')
        logging.info(f"admin-POST-request mit Daten: {data}")

        if action == 'create_user':
            # Benutzer erstellen
            print(data)
            realname = data.get('realname', '').strip()
            username = data.get('username', '').strip()
            password = data.get('password', '')
            username = username.lower()

            if not re.fullmatch(r"[A-Za-zÄÖÜäöüß\s]+", realname):
                logging.error(f"Versuch Benutzer mit ungültigem Real-Namen anzulegen {realname}")
                return "Ungültiger Name", 400
            if not re.fullmatch(r"[A-Za-z0-9]+", username):
                return "Ungültiger Benutzername", 400
            if len(password) < 3:
                return "Passwort zu kurz", 400
            if db.finde_benutzer_by_username(username):
                return "Benutzer existiert bereits"

            db.erstelle_benutzer(realname, username, password, admin=data.get('admin',False))
            return "Benutzer erstellt"
        elif action == 'new_passwort':
            benutzername = request.form.get('benutzername')
            new_pass = request.form.get('new_pass')
            if (db.passwort_aendern(benutzername, new_pass)):
                return "Passwort, erfolgreich geändert", 200
            return "Fehler bei der Passwortänderung", 400
        elif action == 'delete_user':
            logging.info("Action delete_user")
            nummer = data.get('nummer')
            if nummer:
                if (not db.loesche_userID(nummer)):
                    return "DB - Fehler", 400
                return "Erfolg", 200
            else:
                return "Keine Nutzernummer angegeben", 400
        elif action == 'delete_swimmer':
            logging.info("Action delete_swimmer")
            nummer = data.get('nummer')
            if nummer:
                if (not db.loesche_schwimmer(nummer)):
                    return "DB - Fehler", 400
                return "Erfolg", 200
            else:
                return "Keine Schwimmernummer angegeben", 400
        elif action == 'get_table_benutzer':
            return jsonify(db.liste_tabelle('benutzer'))
        elif action == 'get_table_clients':
            logging.info("Tabelle clients wird abgerufen")
            #print(db.liste_tabelle('clients'))
            return jsonify(db.liste_tabelle('clients'))
        elif action == 'get_table_swimmer':
            logging.info("Tabelle swimmer wird abgerufen")
            #print(db.liste_tabelle('schwimmer'))
            return jsonify(db.liste_tabelle('schwimmer'))
        elif action == 'get_table_actions':
            logging.info("Tabelle actions wird abgerufen")
            return jsonify(db.liste_tabelle('actions')), 200
        elif action == 'get_checkAnzahlTable':
            logging.info("Tabelle checkAnzahlen wird abgerufen")
            return jsonify(db.checkBahnenAnzahlen()), 200
        elif action == 'import_schwimmer':
            schwimmer_liste = data.get("data", [])
            logging.info(f"Schwimmer werden importiert - Daten enthalten {len(schwimmer_liste)} Schwimmer")
            if not isinstance(schwimmer_liste, list):
                return jsonify({"error": "Datenformat ungültig"}), 400

            db.db.setBegin(True)
            # Beispiel: Daten durchgehen und validieren
            validierte = []
            for s in schwimmer_liste:
                nummer = s.get("nummer")
                vorname = s.get("vorname")
                if (vorname == 0 or vorname == '0'): vorname = None
                nachname = s.get("nachname", None)
                istKind = s.get("istKind")
                istErw = s.get("istErw")
                if (istKind and (istKind not in [0, '0'])):
                    istKind = 1
                if (istErw and istKind != 1 and (istErw==0 or istErw == '0')):
                    istKind = 1
                gruppe = s.get("gruppe",None)
                if (gruppe == 0 or gruppe == '0'): gruppe = None
                geschlecht = s.get("geschlecht", None)
                if not nummer or not vorname:
                    continue  # überspringen wenn Pflichtfelder fehlen
                args = {
                    "nummer": nummer,
                    "erstellt_von_client_id": session['clientID'],
                    "vorname": vorname,
                    "nachname": nachname,
                    "istKind": istKind,
                    "gruppe": gruppe
                }

                # Entferne alle mit None
                filtered_args = {k: v for k, v in args.items() if v is not None}

                if (db.insertOrUpdateSchwimmer(**filtered_args)):
                    validierte.append(filtered_args)

            logging.info(f"Importiert wurden {len(validierte)} Schwimmer")
            db.db.setBegin(False)

            print("Validierte", validierte)

            return jsonify({"status": "ok", "importiert": len(validierte)}), 200
        elif action:
            return f"Unknown Action {action}", 400

    params = {
        'user_role': session.get('user_role',""),
        'userrealname': session.get('realname',"Unbekannt"),
        'username': session.get('user',"unknown"),
        'clientID': session.get('clientID',"--")
    }
    return render_template('admin.html',**params)

#-------------------------------
#  ENDE Admin-Angelegenheiten
#-------------------------------


@app.route("/")
def index():
    #return send_from_directory("static", "index.html")
    params = {
        'user_role': session.get('user_role',""),
        'userrealname': session.get('realname',"Unbekannt"),
        'username': session.get('user',"unknown"),
        'clientID': session.get('clientID',"--"),
        'debugfunktion': request.args.get('dbgfkt') == 'true'
    }
    return render_template("index.html", **params)

@app.route("/main.js")
def send_mainjs():
    params = {
        'schwimmerNrLen': config["laenge_schwimmerNr"],
        'fade_timeout_ms': config["fade_timeout_ms"],
        'fade_to_endOfList': config["fade_to_endOfList"]
    }
    return render_template("main.js", **params), 200, {'Content-Type': 'application/javascript'}

@app.route("/view.js")
def send_viewjs():
    params = {
        'bahnlaenge': config["laenge_bahn_m"]
    }
    return render_template("view.js", **params), 200, {'Content-Type': 'application/javascript'}

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/view")
def view():
    return send_from_directory("static", "view.html")

@app.route("/show_qr")
def show_qr():
    '''Erzeugt eine Webseite mit dem QR-Code zu einer IP
    Zum Beispiel mit <button onclick="window.open('/show_qr?ip=' + encodeURIComponent('http://192.168.0.10:8080'), '_blank')">
                QR-Code anzeigen
        </button>
    '''
    myip = get_all_ips()[0]
    ip_url = request.args.get("ip", f"http://{myip}:8080")
    return render_template("qr.html", ip_url=ip_url)


@app.route("/action", methods=["POST"])
def action():
    try:
        db.db = get_db()
        clientid = session.get("clientID",-1)
        user = session.get("user","unknown")
        actions = request.get_json()
        print("Empfangene Actions:", actions)

        results = []
        updates = []

        db.db.setBegin(True)

        for action in actions:
            kommando = action.get("kommando")
            parameter = action.get("parameter")
            timestamp = action.get("timestamp")

            
            if kommando == "ADD":
                # ADD - Action muss dokumentiert werden
                # Prrüfung, ob diese schon vorhanden war!!!
                anz = db.erstelle_action(user, client_id=clientid, zeitstempel=str(timestamp), kommando=str(kommando), parameter=json.dumps(parameter))
                logging.info(f"Aktion ist eingetragen: {"NEW" if anz>0 else "EXISTED"}")
                if (anz>0):
                    try:
                        nummer = int(parameter[0])
                        anzahl = int(parameter[1])
                        bahnnr = int(parameter[2]) if len(parameter) > 2 else 0
                        logging.info(f"ADD wird ausgeführt: Schwimmer {nummer}, Anzahl {anzahl}, BahnNr {bahnnr}")
                        db.aendere_bahnanzahl_um(nummer,anzahl,clientid,bahnnr=bahnnr)
                        logging.info("ADD ist ausgeführt")
                        results.append({"kommando": kommando, "status": "erfolgreich", "nummer": nummer, "anzahl": anzahl})
                        #updates.append(db.lies_schwimmer(nummer))
                    except (ValueError, IndexError) as e:
                        logging.info(f"Fehler bei ADD-Parametern: {e}")
                        results.append({"kommando": kommando, "status": f"ungültige Parameter: {str(e)}"})
                else:
                    results.append({"kommando": kommando, "parameter": parameter, "status": "existierte bereits"})
            elif kommando == "GETB":
                try:
                    logging.info(f"Schwimmer der Bahnen {parameter} werden von Nutzer:{user} und Client-ID: {clientid} abgerufen")
                    for bahnnr in parameter:
                        updates.extend(db.lies_schwimmer_vonBahn(bahnnr))
                    results.append({"kommando": kommando, "status": "erfolgreich", "bahnen": parameter})
                    
                except (ValueError, IndexError) as e:
                    logging.info(f"Fehler bei GETB-Parametern: {e}")
                    results.append({"kommando": kommando, "status": f"ungültige Parameter: {str(e)}"})
            elif kommando == "GET":
                logging.info(f"Tabelle schwimmer wird von Nutzer:{user} und Client-ID: {clientid} abgerufen")
                #print(db.liste_tabelle('schwimmer'))
                if parameter == []:
                    updates = db.liste_tabelle('schwimmer')
                else:
                    nummer = int(parameter[0])
                    updates = [db.lies_schwimmer(nummer)]
            elif kommando == "VIEW": # Update des Viewbildschirms angefordert
                if (len(parameter)>0): #nur begrenzter Zeitraum
                    sinceTimestamp = parameter[0]
                    data = {}
                    data['actions'] = db.finde_actions_after_timestamp(sinceTimestamp)
                    return jsonify(data), 200
                else: #Volständige übermittlung
                    data = {}
                    data['swimmerMap'] = db.liste_tabelle('schwimmer')
                    data['actions'] = db.liste_tabelle('actions')
                    return jsonify(data), 200
                pass
            elif kommando == "ACT": # Status Aktiv ändern
                try:
                    nummer = int(parameter[0])
                    value = int(parameter[1])
                    logging.info(f"ACT ausgeführt: Schwimmer {nummer} wird {value}")
                    if (db.update_schwimmer(nummer,aktiv = value)):
                        results.append({"kommando": kommando, "status": "erfolgreich", "nummer": nummer, "value": value})
                    else: 
                        results.append({"kommando": kommando, "status": "FEHLER", "nummer": nummer, "value": value})
                except (ValueError, IndexError) as e:
                    logging.info(f"Fehler bei ACT-Parametern: {e}")
                    results.append({"kommando": kommando, "status": f"ungültige Parameter: {str(e)}"})
            else:
                logging.debug(f"Unbekanntes Kommando: {kommando}")
                print(f"Unbekanntes Kommando: {kommando}")

        db.db.setBegin(False)
        return jsonify({"results": results, "updates": updates}), 200

    except Exception as e:
        print(f"Fehler beim Verarbeiten der Actions: {e}")
        return "Fehler", 400

def run_server(reloader = False):
    app.run(host="0.0.0.0", port=8080, threaded=False, use_reloader=reloader)
    #app.run(ssl_context=('cert.pem', 'key.pem'), debug=True)

if __name__ == "__main__":
    run_server(True) #Reloader aktivieren - lädt Flask bei Dateiänderungen neu - super für Testmodus
    
