<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bahnenschwimmen</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" type="text/css" media="screen" href="/main.css" />
  <link rel="stylesheet" href="/all.min.css" />
  <style>
    :root { --swimmer-card-width: calc(<?= (int)$card_font_size ?> * 40px); }

    #header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
    }
    #header > div:last-child {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
    }

    #bahnButtons button {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.5);
      background: rgba(255,255,255,0.15);
      color: white;
      cursor: pointer;
      font-size: 15px;
      font-weight: bold;
      padding: 0;
      line-height: 1;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    #bahnButtons button.bahn-aktiv {
      background: white;
      color: #1a237e;
      border-color: white;
    }

    @media (max-width: 600px) {
      #header { padding: 10px; }
      #header h1 { font-size: 18px; letter-spacing: 0; }
      #container {
        display: grid;
        grid-template-columns: repeat(<?= (int)$mobile_cards_col ?>, 1fr);
      }
      .schwimmer { width: 100%; min-width: 0; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <header>
    <div id="infoBar" style="display: flex">
      <span id="serverStatus" style="display: inline-block; text-align: left">
        <span style="height: 10px; width: 10px; background-color: green; border-radius: 50%; display: inline-block; margin-right: 5px"></span>
        Verbunden
      </span>
      <span style="display: inline-block; text-align: center"> Angemeldet als: <strong><?= htmlspecialchars($userrealname) ?> (<?= htmlspecialchars($username) ?>)</strong></span>
      <span style="display: inline-block; text-align: right"> Client-ID: <strong><?= htmlspecialchars($clientID) ?></strong></span>
    </div>
    <div id="header">
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="schwimmerHinzufuegen" style="font-size: 30px; cursor: pointer; color: white; background: none; border: none; padding: 10px 18px;">+</button>
      </div>
      <div style="display: flex; flex-direction: column; font-size: 24px; color: white; text-align: center; align-items: center;">
        <h1 id="mainHeading">24h&nbsp;Schwimmen</h1>
        <div id="bahnButtons" style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 4px;"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button id="toggleInfoBar" style="padding-left: 0px; font-size: 30px; cursor: pointer; color: white; background: none; border: none">
          <i class="fa-solid fa-circle-info"></i>
        </button>
      </div>
    </div>
  </header>
  <main style="padding-bottom: 60px">
    <div id="container"></div>
    <p id="antwort"></p>
    <div id="contextMenu">
      <ul>
        <li id="rundeAbziehenOption">Runde abziehen</li>
        <li id="deleteSwimmer">Schwimmer*innen entfernen</li>
        <li id="nurEigene">Fremdbahnen entfernen</li>
      </ul>
    </div>
  </main>
  <footer style="display: flex; justify-content: space-between; align-items: center; padding: 10px">
    <div style="display: flex; gap: 6px; align-items: center;">
      <?php if ($user_role === 'admin'): ?>
      <form action="/admin" method="post">
        <button type="submit" title="Adminbereich" style="font-size: 30px; color: inherit; background: none; border: none; cursor: pointer">⚙️</button>
      </form>
      <?php endif; ?>
      <button id="downloadJsonBtn"
        title="Aktionen-Backup herunterladen – enthält alle seit dem Login empfangenen Bahnen. Kann im Admin-Bereich unter Aktionen → JSON-Import wieder eingespielt werden."
        style="font-size: 30px; cursor: pointer; color: inherit; background: none; border: none">
        <i class="fa-solid fa-download"></i>
      </button>
    </div>
    <div style="position: absolute; left: 50%; transform: translateX(-50%)">&copy; 2025 Schwimmen 24h. Alle Rechte vorbehalten.</div>
    <form action="/logout" method="post" style="margin-left: auto">
      <button type="submit" title="Logout" style="font-size: 30px; color: inherit; background: none; border: none; cursor: pointer">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </form>
  </footer>
  <script type="module" src="/main_v3.js"></script>
  <?php if ($debugfunktion): ?>
  <script>
    const DEBUG_CONFIG = {
      tickMs: 1000,
      klickWahrscheinlichkeit: 0.6,
      hinzufuegenIntervallTicks: 8,
      schwimmerNrMax: 350,
      maxSchwimmer: 25,
    };
    let debugTimer = null;
    let debugTick = 0;
    function debugStep() {
      debugTick++;
      const container = document.getElementById('container');
      const schwimmerDivs = container.querySelectorAll('.schwimmer');
      if (schwimmerDivs.length > 0 && Math.random() < DEBUG_CONFIG.klickWahrscheinlichkeit) {
        schwimmerDivs[Math.floor(Math.random() * schwimmerDivs.length)].click();
      }
      if (debugTick % DEBUG_CONFIG.hinzufuegenIntervallTicks === 0 && window.debugSchwimmerHinzufuegen) {
        window.debugSchwimmerHinzufuegen(Math.floor(Math.random() * DEBUG_CONFIG.schwimmerNrMax));
      }
      if (schwimmerDivs.length > DEBUG_CONFIG.maxSchwimmer && window.debugSchwimmerEntfernen) window.debugSchwimmerEntfernen();
    }
    function toggleDebugTimer() {
      if (debugTimer) { clearInterval(debugTimer); debugTimer = null; document.getElementById("mainHeading").style.color = ""; }
      else { debugTick = 0; debugTimer = setInterval(debugStep, DEBUG_CONFIG.tickMs); document.getElementById("mainHeading").style.color = "green"; }
    }
    document.getElementById("mainHeading").addEventListener("click", () => toggleDebugTimer());
    document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'd') { e.preventDefault(); toggleDebugTimer(); } });
  </script>
  <?php endif; ?>
</body>
</html>
