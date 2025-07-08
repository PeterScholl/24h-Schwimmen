# WSGI steht für Web Server Gateway Interface. 
# Es ist eine Schnittstelle zwischen einem Webserver (z. B. Gunicorn) 
# und einer Python-Webanwendung (z. B. Flask, Django).
# Sorgt für bessere Lastverteilung: stabil, performant und sicher im produktiven Einsatz

from gunicorn.app.base import BaseApplication
from server import app  # deine Flask-App

class StandaloneApplication(BaseApplication):
    def __init__(self, app):
        self.application = app
        super().__init__()

    def load_config(self):
        self.cfg.set("bind", "0.0.0.0:8080")
        self.cfg.set("workers", 2)

    def load(self):
        return self.application

if __name__ == "__main__":
    StandaloneApplication(app).run()
