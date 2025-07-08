# WSGI steht für Web Server Gateway Interface. 
# Es ist eine Schnittstelle zwischen einem Webserver (z. B. Gunicorn) 
# und einer Python-Webanwendung (z. B. Flask, Django).
# Sorgt für bessere Lastverteilung: stabil, performant und sicher im produktiven Einsatz

from waitress import serve
from server import app  # die Flask-App
import webbrowser
import threading
import sys

if __name__ == "__main__":
    # Öffne die Webseite in einem separaten Thread, damit es den Server-Start nicht blockiert
    threading.Timer(1.0, lambda: webbrowser.open("http://localhost:8080")).start()

    try:
        # Starte den Server auf allen Interfaces (0.0.0.0) und Port 8080
        print("Starte Server mit Waitress. Mit Strg+C beenden.")
        serve(app, host="0.0.0.0", port=8080)
    except KeyboardInterrupt:
        print("\nServer wurde durch Strg+C sauber beendet.")
    finally:
        print("Server wurde beendet.")
        input("Drücke Enter, um das Fenster zu schließen...")
        sys.exit(0)
    

