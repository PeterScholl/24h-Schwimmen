<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$_session_lifetime_s = (int)(($config['session_lifetime_h'] ?? 24) * 3600);
ini_set('session.gc_maxlifetime', (string)$_session_lifetime_s);
session_set_cookie_params(['lifetime' => $_session_lifetime_s, 'samesite' => 'Lax']);
session_start();

if (($_SESSION['user_role'] ?? '') !== 'admin') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Zugriff verweigert.';
    exit;
}

$phpErrorLog = ini_get('error_log') ?: '';
$logFiles = array_filter([
    'php'   => __DIR__ . '/../data/serverlog_php.log',
    'phperr' => $phpErrorLog,
], fn($p) => $p !== '' && is_readable($p));

$fileKey = (isset($_GET['file']) && array_key_exists($_GET['file'], $logFiles))
    ? (string)$_GET['file']
    : 'php';
$logPath = $logFiles[$fileKey];
$lines   = max(10, (int)($_GET['lines'] ?? 200));

// ── Poll-Modus: neue Zeilen seit offset ──────────────────────────────────────
if (isset($_GET['poll'])) {
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    if (!is_readable($logPath)) {
        echo json_encode(['lines' => [], 'offset' => 0]);
        exit;
    }

    $size = filesize($logPath);
    // Datei wurde rotiert / geleert
    if ($size < $offset) {
        echo json_encode(['lines' => [], 'offset' => 0, 'reset' => true]);
        exit;
    }
    if ($size === $offset) {
        echo json_encode(['lines' => [], 'offset' => $offset]);
        exit;
    }

    $fh      = fopen($logPath, 'rb');
    fseek($fh, $offset);
    $content = fread($fh, $size - $offset);
    fclose($fh);

    $newLines = array_values(array_filter(explode("\n", (string)$content), fn($l) => $l !== ''));
    echo json_encode(['lines' => $newLines, 'offset' => $size]);
    exit;
}

// ── Letzte N Zeilen lesen ────────────────────────────────────────────────────
function tail_read(string $path, int $n): array
{
    if (!is_readable($path)) {
        return [[], 0];
    }
    $size = filesize($path);
    if ($size === 0) {
        return [[], 0];
    }
    $fh     = fopen($path, 'rb');
    $buf    = '';
    $pos    = $size;
    while ($pos > 0 && substr_count($buf, "\n") <= $n) {
        $read = min(8192, $pos);
        $pos -= $read;
        fseek($fh, $pos);
        $buf = fread($fh, $read) . $buf;
    }
    fclose($fh);

    $all = explode("\n", $buf);
    if (end($all) === '') {
        array_pop($all);
    }
    return [array_values(array_slice($all, -$n)), $size];
}

[$initialLines, $initialOffset] = tail_read($logPath, $lines);

$scriptUrl = strtok($_SERVER['REQUEST_URI'] ?? '/tail.php', '?');
?>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log-Viewer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: system-ui, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 14px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      font-size: 13px;
    }
    header h1 { font-size: 15px; font-weight: 600; white-space: nowrap; }
    select, input[type=number], input[type=text], button {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 13px;
      cursor: pointer;
    }
    input[type=text] { cursor: text; }
    input[type=text]::placeholder { color: #6e7681; }
    button:hover { background: #30363d; }
    .spacer { flex: 1; }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }
    .live  { background: #1a7f37; color: #fff; }
    .pause { background: #9e6a03; color: #fff; }
    .s-err { background: #b91c1c; color: #fff; }
    a { color: #58a6ff; text-decoration: none; font-size: 13px; }
    a:hover { text-decoration: underline; }
    /* Filterleiste */
    .filterbar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 6px 14px;
      background: #0d1117;
      border-bottom: 1px solid #21262d;
      font-size: 13px;
    }
    #filterText { flex: 1; min-width: 140px; max-width: 280px; }
    .lvl-btn {
      font-weight: 700;
      font-size: 11px;
      padding: 3px 9px;
      opacity: 0.35;
      transition: opacity .15s;
    }
    .lvl-btn.active { opacity: 1; }
    .lvl-err  { color: #ff6b6b; border-color: #ff6b6b44; }
    .lvl-warn { color: #ffd93d; border-color: #ffd93d44; }
    .lvl-info { color: #74b9ff; border-color: #74b9ff44; }
    .lvl-dbg  { color: #a0aec0; border-color: #a0aec044; }
    .lvl-other{ color: #c9d1d9; border-color: #c9d1d944; }
    #lineCount { font-size: 12px; color: #6e7681; white-space: nowrap; margin-left: auto; }
    /* Log-Ausgabe */
    #log {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      font-family: 'Courier New', Consolas, monospace;
      font-size: 15px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .l-err  { color: #ff6b6b; font-weight: 600; }
    .l-warn { color: #ffd93d; }
    .l-info { color: #74b9ff; }
    .l-dbg  { color: #a0aec0; }
    .hl     { background: #ffd93d33; border-radius: 2px; }
  </style>
</head>
<body>
<header>
  <h1>Log-Viewer</h1>

  <form method="get" action="<?= htmlspecialchars($scriptUrl, ENT_QUOTES) ?>" style="display:contents;">
    <select name="file" onchange="this.form.submit()">
      <?php
      $labels = ['php' => 'App-Log (PHP)', 'phperr' => 'PHP-Error-Log (Webserver)'];
      foreach ($logFiles as $key => $path): ?>
        <option value="<?= htmlspecialchars($key, ENT_QUOTES) ?>"<?= $key === $fileKey ? ' selected' : '' ?>>
          <?= htmlspecialchars($labels[$key] ?? basename($path), ENT_QUOTES) ?>
        </option>
      <?php endforeach; ?>
    </select>
    <label>Zeilen:
      <input type="number" name="lines" value="<?= $lines ?>" min="10" step="50" style="width:72px;" onchange="this.form.submit()">
    </label>
  </form>

  <button id="btnPause">⏸ Pause</button>
  <button id="btnClear">🗑 Anzeige leeren</button>
  <span style="display:flex;align-items:center;gap:4px;">
    <button id="btnSmaller"   title="Schrift verkleinern"      style="font-weight:600;padding:4px 9px;">A−</button>
    <button id="btnBigger"    title="Schrift vergrößern"       style="font-weight:600;padding:4px 9px;">A+</button>
    <button id="btnBold"      title="Fett ein/aus"             style="font-weight:700;min-width:32px;">B</button>
    <button id="btnLhSmaller" title="Zeilenabstand verringern" style="padding:4px 8px;">≡−</button>
    <button id="btnLhBigger"  title="Zeilenabstand vergrößern" style="padding:4px 8px;">≡+</button>
  </span>
  <span id="status" class="badge live">● Live</span>
  <span class="spacer"></span>
  <a href="/">← Zurück</a>
</header>

<div class="filterbar">
  <input type="text" id="filterText" placeholder="Suchen …" autocomplete="off" spellcheck="false">
  <button class="lvl-btn lvl-err  active" data-lvl="err"  >ERROR</button>
  <button class="lvl-btn lvl-warn active" data-lvl="warn" >WARN</button>
  <button class="lvl-btn lvl-info active" data-lvl="info" >INFO</button>
  <button class="lvl-btn lvl-dbg  active" data-lvl="dbg"  >DEBUG</button>
  <button class="lvl-btn lvl-other active" data-lvl="other">Sonstige</button>
  <span id="lineCount"></span>
</div>

<div id="log"></div>

<script>
(function () {
  var log       = document.getElementById('log');
  var status    = document.getElementById('status');
  var lineCount = document.getElementById('lineCount');
  var filterText = document.getElementById('filterText');
  var btnPause  = document.getElementById('btnPause');
  var btnClear  = document.getElementById('btnClear');
  var btnSmaller = document.getElementById('btnSmaller');
  var btnBigger  = document.getElementById('btnBigger');
  var btnBold    = document.getElementById('btnBold');

  var offset  = <?= json_encode($initialOffset) ?>;
  var fileKey = <?= json_encode($fileKey) ?>;
  var base    = <?= json_encode($scriptUrl) ?>;
  var paused  = false;
  var allLines = [];                         // alle Rohzeilen (ungefiltert)
  var ALL_LEVELS = ['err','warn','info','dbg','other'];
  var storedLevels = localStorage.getItem('tailActiveLevels');
  var activeLevels = new Set(storedLevels ? JSON.parse(storedLevels) : ALL_LEVELS);
  var searchTerm = '';
  var debounceTimer = null;

  // ── Schriftgröße & Fett ─────────────────────────────────────────────────
  var btnLhSmaller = document.getElementById('btnLhSmaller');
  var btnLhBigger  = document.getElementById('btnLhBigger');
  var MIN_SIZE = 10, MAX_SIZE = 28;
  var MIN_LH = 1.0, MAX_LH = 2.5, STEP_LH = 0.1;
  var fontSize   = parseInt(localStorage.getItem('tailFontSize') || '15', 10);
  var fontBold   = localStorage.getItem('tailFontBold') === '1';
  var lineHeight = parseFloat(localStorage.getItem('tailLineHeight') || '1.4');

  function applyFont() {
    log.style.fontSize   = fontSize + 'px';
    log.style.fontWeight = fontBold ? '700' : '400';
    log.style.lineHeight = lineHeight.toFixed(1);
    btnBold.style.background = fontBold ? '#388bfd' : '';
    btnBold.style.color      = fontBold ? '#fff'    : '';
    btnSmaller.disabled   = fontSize   <= MIN_SIZE;
    btnBigger.disabled    = fontSize   >= MAX_SIZE;
    btnLhSmaller.disabled = lineHeight <= MIN_LH;
    btnLhBigger.disabled  = lineHeight >= MAX_LH;
    localStorage.setItem('tailFontSize',   fontSize);
    localStorage.setItem('tailFontBold',   fontBold ? '1' : '0');
    localStorage.setItem('tailLineHeight', lineHeight.toFixed(1));
  }
  btnSmaller  .addEventListener('click', function () { if (fontSize   > MIN_SIZE) { fontSize--;                                    applyFont(); } });
  btnBigger   .addEventListener('click', function () { if (fontSize   < MAX_SIZE) { fontSize++;                                    applyFont(); } });
  btnBold     .addEventListener('click', function () { fontBold = !fontBold;                                                       applyFont(); });
  btnLhSmaller.addEventListener('click', function () { if (lineHeight > MIN_LH)   { lineHeight = Math.round((lineHeight - STEP_LH) * 10) / 10; applyFont(); } });
  btnLhBigger .addEventListener('click', function () { if (lineHeight < MAX_LH)   { lineHeight = Math.round((lineHeight + STEP_LH) * 10) / 10; applyFont(); } });
  applyFont();

  // ── Level-Erkennung ──────────────────────────────────────────────────────
  function getLevel(line) {
    if (/error|CRITICAL|Exception|Fatal/i.test(line)) return 'err';
    if (/warn|WARNING/i.test(line))                   return 'warn';
    if (/\bINFO\b/i.test(line))                       return 'info';
    if (/\bDEBUG\b/i.test(line))                      return 'dbg';
    return 'other';
  }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlight(escaped, term) {
    if (!term) return escaped;
    var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
    return escaped.replace(re, '<span class="hl">$1</span>');
  }

  function renderLine(line, term) {
    var lvl = getLevel(line);
    var e   = highlight(esc(line), term);
    if (lvl === 'err')  return '<span class="l-err">'  + e + '</span>';
    if (lvl === 'warn') return '<span class="l-warn">' + e + '</span>';
    if (lvl === 'info') return '<span class="l-info">' + e + '</span>';
    if (lvl === 'dbg')  return '<span class="l-dbg">'  + e + '</span>';
    return e;
  }

  // ── Gefiltertes Rendering ────────────────────────────────────────────────
  function renderView() {
    var term    = searchTerm.toLowerCase();
    var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    var html    = '';
    var shown   = 0;

    for (var i = 0; i < allLines.length; i++) {
      var line = allLines[i];
      if (!activeLevels.has(getLevel(line))) continue;
      if (term && line.toLowerCase().indexOf(term) === -1) continue;
      html += renderLine(line, searchTerm) + '\n';
      shown++;
    }

    log.innerHTML = html;
    lineCount.textContent = shown + ' / ' + allLines.length + ' Zeilen';
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  function addLines(arr) {
    if (!arr || arr.length === 0) return;
    for (var i = 0; i < arr.length; i++) allLines.push(arr[i]);
    renderView();
  }

  // ── Filter-Controls ──────────────────────────────────────────────────────
  // Buttons initial entsprechend localStorage-Zustand setzen
  document.querySelectorAll('.lvl-btn').forEach(function (btn) {
    if (!activeLevels.has(btn.dataset.lvl)) {
      btn.classList.remove('active');
    }
    btn.addEventListener('click', function () {
      var lvl = btn.dataset.lvl;
      if (activeLevels.has(lvl)) {
        activeLevels.delete(lvl);
        btn.classList.remove('active');
      } else {
        activeLevels.add(lvl);
        btn.classList.add('active');
      }
      localStorage.setItem('tailActiveLevels', JSON.stringify(Array.from(activeLevels)));
      renderView();
    });
  });

  filterText.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      searchTerm = filterText.value;
      renderView();
    }, 180);
  });

  // ── Initiale Zeilen ──────────────────────────────────────────────────────
  addLines(<?= json_encode($initialLines) ?>);
  log.scrollTop = log.scrollHeight;

  // ── Polling ──────────────────────────────────────────────────────────────
  function poll() {
    if (paused) return;
    fetch(base + '?poll=1&file=' + encodeURIComponent(fileKey) + '&offset=' + offset)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.reset) { allLines = []; offset = 0; }
        if (data.lines && data.lines.length > 0) {
          addLines(data.lines);
          offset = data.offset;
        }
        setStatus('live');
      })
      .catch(function () { setStatus('err'); });
  }

  function setStatus(s) {
    if (s === 'live')  { status.textContent = '● Live';  status.className = 'badge live'; }
    if (s === 'pause') { status.textContent = '⏸ Pause'; status.className = 'badge pause'; }
    if (s === 'err')   { status.textContent = '✗ Fehler'; status.className = 'badge s-err'; }
  }

  btnPause.addEventListener('click', function () {
    paused = !paused;
    btnPause.textContent = paused ? '▶ Weiter' : '⏸ Pause';
    setStatus(paused ? 'pause' : 'live');
  });

  btnClear.addEventListener('click', function () {
    allLines = [];
    log.innerHTML = '';
    lineCount.textContent = '0 / 0 Zeilen';
  });

  setInterval(poll, 2000);
}());
</script>
</body>
</html>
