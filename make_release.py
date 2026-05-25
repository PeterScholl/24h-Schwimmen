import shutil
import os
import subprocess

# Basisnamen
release_name = "swim24v0.3"
dist_dir = "dist"
release_path = os.path.join(dist_dir, release_name)
zip_path = os.path.join(dist_dir, f"{release_name}.zip")

# Schritt 1: PyInstaller ausführen
#TODO Linux-Version - bzw. prüfen ob Linux, dann : statt ; bei den add-data-Optionen
subprocess.run(["pyinstaller", "--noconfirm", "--onedir", "wsgiserverwin.py", "--add-data", 'flask_templates;flask_templates', "--add-data", 'static;static'], check=True)
#subprocess.run(["pyinstaller", "--onedir", "gui.py"])
                
# Vorheriges Release löschen
if os.path.exists(release_path):
    shutil.rmtree(release_path)
os.makedirs(release_path, exist_ok=True)

# Relevante Dateien/Ordner kopieren
#shutil.copy("dist/gui.exe", release_path)
#shutil.copytree("flask_templates", os.path.join(release_path, "flask_templates"))
#shutil.copytree("static", os.path.join(release_path, "static"))
shutil.copytree(os.path.join("dist","wsgiserverwin"), release_path, dirs_exist_ok=True)
#shutil.copy("server.py", release_path)
shutil.copy("config.json", release_path)
# ggf. weitere Dateien ...
shutil.copytree("testfiles", os.path.join(release_path,"testfiles"))

# ZIP erstellen
shutil.make_archive(base_name=os.path.splitext(zip_path)[0], format='zip', root_dir=release_path)

print(f"{zip_path} wurde erstellt.")
