# WSGI steht für Web Server Gateway Interface. 
# Es ist eine Schnittstelle zwischen einem Webserver (z. B. Gunicorn) 
# und einer Python-Webanwendung (z. B. Flask, Django).
# Sorgt für bessere Lastverteilung: stabil, performant und sicher im produktiven Einsatz

from waitress import serve
from server import app  # die Flask-App
import webbrowser
import threading

if __name__ == "__main__":
    # Öffne die Webseite in einem separaten Thread, damit es den Server-Start nicht blockiert
    threading.Timer(1.0, lambda: webbrowser.open("http://localhost:8080")).start()
    
    # Starte den Server auf allen Interfaces (0.0.0.0) und Port 8080
    serve(app, host="0.0.0.0", port=8080)


