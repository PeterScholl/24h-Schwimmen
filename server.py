import socket
import os
import json
from datetime import datetime

hostname = socket.gethostname()
HOST = socket.gethostbyname(hostname)
PORT = 8080

if not os.path.exists("data/verlauf.json"):
    with open("data/verlauf.json", "w", encoding="utf-8") as f:
        f.write("[]")
        
if not os.path.exists("data/data.json"):
    with open("data/data.json", "w", encoding="utf-8") as f:
        f.write("[]")

def addVersion(new, dateipfad="data/verlauf.json"):
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
                try:
                    with open("static/index.html", "r", encoding="utf-8") as f:
                        body = f.read()
                    response = build_response("200 OK", body)
                except FileNotFoundError:
                    response = build_response("404 Not Found", "<h1>Seite nicht gefunden</h1>")
            elif method == "GET" and path == "/daten":
                try:
                    with open("data/data.json", "r", encoding="utf-8") as f:
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
                    with open("data/data.json", "r", encoding="utf-8") as f:
                        bestehende_daten = json.load(f)
                except FileNotFoundError:
                    bestehende_daten = []
                
                neue_daten = json.loads(body)
                # neue daten verarbeiten
                for neuer in neue_daten:
                    nummer = neuer["Nummer"]
                    bahnen = int(neuer["Bahnen"])
                    abwesend = neuer.get("Abwesend", False)  # fallback auf False, falls nicht vorhanden

                    gefunden = False
                    for bestehender in bestehende_daten:
                        if bestehender["Nummer"] == nummer:
                            bestehender["Bahnen"] = bahnen
                            bestehender["Abwesend"] = abwesend
                            gefunden = True
                            break

                    if not gefunden:
                        bestehende_daten.append({
                            "Nummer": nummer,
                            "Bahnen": bahnen,
                            "Abwesend": abwesend
                        })

                # daten speichern
                with open("data/data.json", "w", encoding="utf-8") as f:
                    json.dump(bestehende_daten, f, ensure_ascii=False, indent=4)
                
                addVersion(bestehende_daten)
            else:
                response = "HTTP/1.1 404 Not Found\n\n<h1>404 - Nicht gefunden</h1>"

            conn.sendall(response.encode())
