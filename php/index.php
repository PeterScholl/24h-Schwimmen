<?php
session_start();

if (php_sapi_name() === 'cli-server') {
    error_reporting(E_ALL);
    ini_set('log_errors', '1');
    ini_set('display_errors', '0');
}

require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

Logger::init(__DIR__ . '/../data/serverlog_php.log');

try {
    $db = getDb();
    init_db();
    ensure_admin_user();
} catch (\Throwable $e) {
    Logger::error('Datenbankverbindung fehlgeschlagen: ' . $e->getMessage());
    http_response_code(503);
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
        <title>Datenbankfehler</title>
        <style>body{font-family:sans-serif;max-width:600px;margin:80px auto;padding:0 20px}
        h1{color:#c0392b}</style></head><body>
        <h1>&#9888; Datenbankverbindung fehlgeschlagen</h1>
        <p>Der Server kann keine Verbindung zur Datenbank herstellen.</p>
        <p>Bitte die Datenbankzugangsdaten in der <code>config.json</code> pr&uuml;fen
        (<code>db_host</code>, <code>db_name</code>, <code>db_user</code>, <code>db_pass</code>)
        und den Administrator informieren.</p>
        <p><small>Details stehen in der Logdatei <code>data/serverlog_php.log</code>.</small></p>
        </body></html>';
    exit;
}

// Auth-Middleware
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!isset($_SESSION['user']) && $path !== '/login') {
    header('Location: /login');
    exit;
}

// Router
switch ($path) {
    case '/':          header('Location: /v2'); exit;
    case '/login':     handle_login();     break;
    case '/logout':    handle_logout();    break;
    case '/admin':     handle_admin();     break;
    case '/backupsql': handle_backupsql(); break;
    case '/v1':        handle_v1();        break;
    case '/v2':        handle_v2();        break;
    case '/main.js':       handle_main_js();    break;
    case '/main_v2.js':    handle_main_v2_js(); break;
    case '/view.js':       handle_view_js();    break;
    case '/view2.js':      handle_view2_js();   break;
    case '/view':          handle_view();        break;
    case '/view2':         handle_view2();       break;
    case '/action':        handle_action();      break;
    case '/api/ips':       handle_api_ips();     break;
    case '/show_qr':       handle_show_qr();     break;
    default:
        serve_static($path);
        break;
}

// ===================================================
// Hilfsfunktionen
// ===================================================

function render_template(string $name, array $vars = []): void {
    extract($vars, EXTR_SKIP);
    include __DIR__ . '/templates/' . $name . '.php';
}

function json_response(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function generiere_passwort(int $laenge = 8): string {
    $zeichen = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $pw = '';
    for ($i = 0; $i < $laenge; $i++) {
        $pw .= $zeichen[random_int(0, strlen($zeichen) - 1)];
    }
    return $pw;
}

function get_all_ips(): array {
    $ips = [];
    $hostname = gethostname();
    if ($hostname !== false) {
        $addrs = gethostbynamel($hostname);
        if ($addrs) {
            foreach ($addrs as $ip) {
                if (!str_contains($ip, ':')) {
                    $ips[] = $ip;
                }
            }
        }
    }
    if (empty($ips)) {
        $ips[] = '127.0.0.1';
    }
    return $ips;
}

function ensure_admin_user(): void {
    global $config;
    if (!finde_benutzer_by_username('admin')) {
        $passwort = $config['default_admin_pass'] ?? '';
        if (!$passwort) {
            $passwort = generiere_passwort();
        }
        Logger::info("Benutzer 'admin' wird angelegt mit Passwort: $passwort");
        erstelle_benutzer('Administrator', 'admin', $passwort, true);
    }
}

function serve_static(string $path): void {
    $file = realpath(__DIR__ . '/../static' . $path);
    $base = realpath(__DIR__ . '/../static');
    if (!$file || !$base || !str_starts_with($file, $base) || !is_file($file)) {
        http_response_code(404);
        echo 'Nicht gefunden';
        return;
    }
    $ext   = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimes = [
        'css'   => 'text/css',
        'js'    => 'application/javascript',
        'html'  => 'text/html',
        'json'  => 'application/json',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'eot'   => 'application/vnd.ms-fontobject',
        'map'   => 'application/json',
    ];
    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: $mime");
    readfile($file);
}

function request_json(): ?array {
    $ct = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    if (str_contains($ct, 'application/json')) {
        $body = file_get_contents('php://input');
        return json_decode($body, true);
    }
    return null;
}

function request_data(): array {
    $json = request_json();
    return $json ?? $_POST;
}

// ===================================================
// Route-Handler
// ===================================================

function handle_login(): void {
    global $config;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $benutzername = strtolower($_POST['benutzername'] ?? '');
        $passwort     = $_POST['passwort'] ?? '';
        $benutzer     = finde_benutzer_by_username($benutzername);
        if ($benutzer && password_verify($passwort, $benutzer['passwort'])) {
            $_SESSION['user']      = $benutzername;
            $_SESSION['user_id']   = (int)$benutzer['id'];
            $_SESSION['realname']  = $benutzer['name'];
            $_SESSION['clientID']  = erstelle_client($_SERVER['REMOTE_ADDR'], $benutzer['id']);
            if ($benutzer['admin']) {
                $_SESSION['user_role'] = 'admin';
                Logger::info("Admin-Benutzer $benutzername angemeldet");
            } else {
                Logger::info("Benutzer $benutzername angemeldet");
            }
            header('Location: /');
            exit;
        }
        render_template('login', ['error' => true]);
        return;
    }
    render_template('login', ['error' => false]);
}

function handle_logout(): void {
    session_destroy();
    header('Location: /login');
    exit;
}

function handle_backupsql(): void {
    if ($_SESSION['user_role'] !== 'admin') {
        http_response_code(403);
        echo 'Zugriff verweigert';
        return;
    }
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="backup.sql"');
    echo dump();
}

function handle_admin(): void {
    global $config;
    if ($_SESSION['user_role'] !== 'admin') {
        http_response_code(403);
        echo 'Zugriff verweigert';
        return;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data   = request_data();
        $action = $data['action'] ?? null;
        Logger::info("admin-POST-request: action=$action");

        if ($action === 'create_user') {
            $realname = trim($data['realname'] ?? '');
            $username = strtolower(trim($data['username'] ?? ''));
            $password = $data['password'] ?? '';
            if (!preg_match('/^[A-Za-zÄÖÜäöüß\s]+$/u', $realname)) {
                Logger::error("Versuch Benutzer mit ungültigem Real-Namen anzulegen: $realname");
                http_response_code(400); echo 'Ungültiger Name'; return;
            }
            if (!preg_match('/^[A-Za-z0-9]+$/', $username)) {
                http_response_code(400); echo 'Ungültiger Benutzername'; return;
            }
            if (strlen($password) < 3) {
                http_response_code(400); echo 'Passwort zu kurz'; return;
            }
            if (finde_benutzer_by_username($username)) {
                echo 'Benutzer existiert bereits'; return;
            }
            $isAdmin = in_array($data['admin'] ?? '', [true, 1, '1', 'true', 'True'], true);
            erstelle_benutzer($realname, $username, $password, $isAdmin);
            echo 'Benutzer erstellt';
            return;

        } elseif ($action === 'new_passwort') {
            $benutzername = $data['benutzername'] ?? '';
            $new_pass     = $data['new_pass'] ?? '';
            if (passwort_aendern($benutzername, $new_pass)) {
                echo 'Passwort, erfolgreich geändert';
            } else {
                http_response_code(400); echo 'Fehler bei der Passwortänderung';
            }
            return;

        } elseif ($action === 'delete_user') {
            $nummer = $data['nummer'] ?? null;
            if (!$nummer) { http_response_code(400); echo 'Keine Nutzernummer angegeben'; return; }
            Logger::info("Action delete_user: ID=$nummer");
            if (!loesche_userID((int)$nummer)) { http_response_code(400); echo 'DB - Fehler'; return; }
            echo 'Erfolg';
            return;

        } elseif ($action === 'delete_swimmer') {
            $nummer = $data['nummer'] ?? null;
            if (!$nummer) { http_response_code(400); echo 'Keine Schwimmernummer angegeben'; return; }
            Logger::info("Action delete_swimmer: Nummer=$nummer");
            if (!loesche_schwimmer((int)$nummer)) { http_response_code(400); echo 'DB - Fehler'; return; }
            echo 'Erfolg';
            return;

        } elseif ($action === 'edit_swimmer') {
            $nummer = $data['nummer'] ?? null;
            if (!$nummer) { http_response_code(400); echo 'Keine Schwimmernummer angegeben'; return; }
            $felder = [];
            if (isset($data['vorname']))    $felder['vorname']    = trim($data['vorname']);
            if (isset($data['nachname']))   $felder['nachname']   = trim($data['nachname']);
            if (isset($data['gruppe']))     $felder['gruppe']     = trim($data['gruppe']);
            if (isset($data['istKind']))    $felder['istKind']    = in_array($data['istKind'], [true, 1, '1', 'true', 'True'], true) ? 1 : 0;
            if (isset($data['bahnanzahl'])) $felder['bahnanzahl'] = (int)$data['bahnanzahl'];
            if (empty($felder)) { http_response_code(400); echo 'Keine Felder zum Ändern angegeben'; return; }
            Logger::info("Schwimmer $nummer wird bearbeitet: " . json_encode($felder, JSON_UNESCAPED_UNICODE));
            if (!update_schwimmer((int)$nummer, $felder)) { http_response_code(400); echo 'DB - Fehler'; return; }
            echo 'Erfolg';
            return;

        } elseif ($action === 'edit_user') {
            $user_id = $data['id'] ?? null;
            if (!$user_id) { http_response_code(400); echo 'Keine Benutzer-ID angegeben'; return; }
            $felder = [];
            if (isset($data['name']))  $felder['name']  = trim($data['name']);
            if (isset($data['admin'])) $felder['admin'] = in_array($data['admin'], [true, 1, '1', 'true', 'True'], true) ? 1 : 0;
            if (isset($data['passwort']) && trim($data['passwort']) !== '') {
                $felder['passwort'] = password_hash(trim($data['passwort']), PASSWORD_DEFAULT);
            }
            if (empty($felder)) { http_response_code(400); echo 'Keine Felder zum Ändern angegeben'; return; }
            $logFelder = array_filter($felder, fn($k) => $k !== 'passwort', ARRAY_FILTER_USE_KEY);
            Logger::info("Benutzer $user_id wird bearbeitet: " . json_encode($logFelder, JSON_UNESCAPED_UNICODE));
            if (!update_benutzer_by_id((int)$user_id, $felder)) { http_response_code(400); echo 'DB - Fehler'; return; }
            echo 'Erfolg';
            return;

        } elseif ($action === 'get_table_benutzer') {
            Logger::info("Tabelle benutzer wird abgerufen");
            json_response(liste_tabelle('benutzer'));
            return;
        } elseif ($action === 'get_table_clients') {
            Logger::info("Tabelle clients wird abgerufen");
            json_response(liste_tabelle('clients'));
            return;
        } elseif ($action === 'get_table_swimmer') {
            Logger::info("Tabelle schwimmer wird abgerufen");
            json_response(liste_tabelle('schwimmer'));
            return;
        } elseif ($action === 'get_table_actions') {
            Logger::info("Tabelle actions wird abgerufen");
            json_response(liste_tabelle('actions'));
            return;

        } elseif ($action === 'get_table_actions_paged') {
            $limit  = (int)($data['limit'] ?? 50);
            $page   = (int)($data['page']  ?? 1);
            $offset = ($page - 1) * $limit;
            Logger::info("Tabelle actions paginiert: Seite $page, Limit $limit, Offset $offset");
            $rows   = liste_tabelle_paged('actions', $limit, $offset);
            $total  = count_tabelle('actions');
            json_response(['data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit]);
            return;

        } elseif ($action === 'get_swimmer_log') {
            $nummer   = (int)($data['nummer'] ?? 0);
            $schwimmer = lies_schwimmer($nummer);
            $actions   = finde_actions_by_schwimmer_nummer($nummer);
            json_response(['schwimmer' => $schwimmer, 'actions' => $actions]);
            return;

        } elseif ($action === 'get_checkAnzahlTable') {
            Logger::info("Tabelle checkAnzahlen wird abgerufen");
            json_response(checkBahnenAnzahlen());
            return;

        } elseif ($action === 'import_schwimmer') {
            global $db;
            $schwimmer_liste = $data['data'] ?? [];
            if (!is_array($schwimmer_liste)) {
                json_response(['error' => 'Datenformat ungültig'], 400); return;
            }
            Logger::info("Schwimmer werden importiert - Daten enthalten " . count($schwimmer_liste) . " Schwimmer");
            $db->setBegin(true);
            $validierte = [];
            foreach ($schwimmer_liste as $s) {
                $nummer  = $s['nummer'] ?? null;
                $vorname = $s['vorname'] ?? null;
                if ($vorname === 0 || $vorname === '0') $vorname = null;
                if (!$nummer || !$vorname) continue;
                $nachname = $s['nachname'] ?? null;
                $istKind  = $s['istKind'] ?? null;
                $istErw   = $s['istErw'] ?? null;
                if ($istKind && !in_array($istKind, [0, '0'], true)) $istKind = 1;
                if ($istErw && $istKind != 1 && ($istErw == 0 || $istErw === '0' || $istErw === 'Nein')) $istKind = 1;
                $gruppe = $s['gruppe'] ?? null;
                if ($gruppe === 0 || $gruppe === '0') $gruppe = null;
                $args = array_filter([
                    'erstellt_von_client_id' => $_SESSION['clientID'] ?? 0,
                    'vorname'  => $vorname,
                    'nachname' => $nachname,
                    'istKind'  => $istKind,
                    'gruppe'   => $gruppe,
                ], fn($v) => $v !== null);
                if (insertOrUpdateSchwimmer((int)$nummer, $args)) {
                    $validierte[] = $args;
                }
            }
            $db->setBegin(false);
            Logger::info("Importiert wurden " . count($validierte) . " Schwimmer");
            json_response(['status' => 'ok', 'importiert' => count($validierte)]);
            return;

        } elseif ($action === 'import_benutzer') {
            $benutzer_liste = $data['data'] ?? [];
            if (!is_array($benutzer_liste)) {
                json_response(['error' => 'Datenformat ungültig'], 400); return;
            }
            Logger::info("Benutzer werden importiert - " . count($benutzer_liste) . " Einträge");
            $neu = 0; $aktualisiert = 0;
            foreach ($benutzer_liste as $b) {
                $benutzername = strtolower(trim($b['benutzername'] ?? ''));
                if (!$benutzername) continue;
                $name     = trim($b['name'] ?? '') ?: $benutzername;
                $passwort = trim($b['passwort'] ?? '');
                $is_admin = in_array($b['admin'] ?? '0', [1, '1', 'true', 'True', true], true);
                $vorhandener = finde_benutzer_by_username($benutzername);
                if ($vorhandener) {
                    update_benutzer($benutzername, $name, (int)$is_admin);
                    if ($passwort) passwort_aendern($benutzername, $passwort);
                    $aktualisiert++;
                } else {
                    $pw = $passwort ?: generiere_passwort();
                    erstelle_benutzer($name, $benutzername, $pw, $is_admin);
                    $neu++;
                }
            }
            Logger::info("Benutzer-Import: $neu neu, $aktualisiert aktualisiert");
            json_response(['status' => 'ok', 'importiert' => $neu + $aktualisiert, 'neu' => $neu, 'aktualisiert' => $aktualisiert]);
            return;

        } elseif ($action) {
            Logger::error("Unbekannte Admin-Action: $action");
            http_response_code(400); echo "Unknown Action $action";
            return;
        }
    }

    render_template('admin', [
        'user_role'      => $_SESSION['user_role'] ?? '',
        'userrealname'   => $_SESSION['realname']  ?? 'Unbekannt',
        'username'       => $_SESSION['user']       ?? 'unknown',
        'clientID'       => $_SESSION['clientID']   ?? '--',
        'schwimmerNrLen' => $config['laenge_schwimmerNr_digits'],
    ]);
}

function handle_v1(): void {
    global $config;
    render_template('index_v1', [
        'user_role'    => $_SESSION['user_role'] ?? '',
        'userrealname' => $_SESSION['realname']  ?? 'Unbekannt',
        'username'     => $_SESSION['user']       ?? 'unknown',
        'clientID'     => $_SESSION['clientID']   ?? '--',
        'debugfunktion' => ($_GET['dbgfkt'] ?? '') === 'true',
        'card_font_size' => $_GET['size'] ?? '5',
    ]);
}

function handle_v2(): void {
    global $config;
    render_template('index_v2', [
        'user_role'       => $_SESSION['user_role'] ?? '',
        'userrealname'    => $_SESSION['realname']  ?? 'Unbekannt',
        'username'        => $_SESSION['user']       ?? 'unknown',
        'clientID'        => $_SESSION['clientID']   ?? '--',
        'debugfunktion'   => ($_GET['dbgfkt'] ?? '') === 'true',
        'card_font_size'  => $_GET['size'] ?? '5',
        'mobile_cards_col' => $config['mobile_cards_col'] ?? 2,
    ]);
}

function handle_main_js(): void {
    global $config;
    header('Content-Type: application/javascript; charset=utf-8');
    $js = file_get_contents(__DIR__ . '/../flask_templates/main.js');
    $js = str_replace('{{schwimmerNrLen}}', $config['laenge_schwimmerNr_digits'], $js);
    echo $js;
}

function handle_main_v2_js(): void {
    global $config;
    header('Content-Type: application/javascript; charset=utf-8');
    $js = file_get_contents(__DIR__ . '/../flask_templates/main_v2.js');
    $js = str_replace('{{schwimmerNrLen}}', $config['laenge_schwimmerNr_digits'], $js);
    $js = str_replace('{{fadeTime}}',       $config['fade_time_s'] ?? 0,          $js);
    echo $js;
}

function handle_view_js(): void {
    global $config;
    header('Content-Type: application/javascript; charset=utf-8');
    $js = file_get_contents(__DIR__ . '/../flask_templates/view.js');
    $js = str_replace('{{bahnlaenge}}',           $config['laenge_bahn_m'],                          $js);
    $js = str_replace('{{startzeit}}',            $config['startzeit'] ?? '2000-01-01T00:00:00Z',    $js);
    $js = str_replace('{{swimmer_list_interval}}', $config['swimmer_list_update_interval_s'] ?? 60,   $js);
    echo $js;
}

function handle_view2_js(): void {
    global $config;
    header('Content-Type: application/javascript; charset=utf-8');
    $js = file_get_contents(__DIR__ . '/../flask_templates/view2.js');
    $js = str_replace('{{bahnlaenge}}',            $config['laenge_bahn_m'],                          $js);
    $js = str_replace('{{page_interval}}',         $config['view2_page_interval_s'] ?? 10,            $js);
    $js = str_replace('{{startzeit}}',             $config['startzeit'] ?? '2000-01-01T00:00:00Z',    $js);
    $js = str_replace('{{swimmer_list_interval}}', $config['swimmer_list_update_interval_s'] ?? 60,   $js);
    echo $js;
}

function handle_view(): void {
    serve_static('/view.html');
}

function handle_view2(): void {
    serve_static('/view2.html');
}

function handle_api_ips(): void {
    json_response(get_all_ips());
}

function handle_show_qr(): void {
    $myip   = get_all_ips()[0];
    $ip_url = $_GET['ip'] ?? "http://$myip:8080";
    render_template('qr', ['ip_url' => htmlspecialchars($ip_url, ENT_QUOTES)]);
}

function handle_action(): void {
    global $db;
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405); return;
    }
    try {
        $clientid = $_SESSION['clientID'] ?? -1;
        $user_id  = (int)($_SESSION['user_id'] ?? 0);
        $actions  = json_decode(file_get_contents('php://input'), true);
        if (!is_array($actions)) { http_response_code(400); echo 'Ungültige JSON-Daten'; return; }

        $results = [];
        $updates = [];

        $db->setBegin(true);

        foreach ($actions as $action) {
            $kommando  = $action['kommando']  ?? null;
            $parameter = $action['parameter'] ?? [];
            $timestamp = $action['timestamp'] ?? '';

            if ($kommando === 'ADD') {
                $anz = erstelle_action($user_id, (int)$clientid, (string)$timestamp, 'ADD', json_encode($parameter));
                Logger::debug("Aktion ist eingetragen: " . ($anz > 0 ? 'NEW' : 'EXISTED'));
                if ($anz > 0) {
                    try {
                        $nummer  = (int)$parameter[0];
                        $anzahl  = (int)$parameter[1];
                        $bahnnr  = isset($parameter[2]) ? (int)$parameter[2] : 0;
                        if ($nummer > 0) {
                            Logger::info("ADD wird ausgeführt: Schwimmer $nummer, Anzahl $anzahl, BahnNr $bahnnr");
                            aendere_bahnanzahl_um($nummer, $anzahl, (int)$clientid, $bahnnr);
                            Logger::debug("ADD ist ausgeführt");
                            $results[] = ['kommando' => 'ADD', 'status' => 'erfolgreich', 'nummer' => $nummer, 'anzahl' => $anzahl];
                        } else {
                            Logger::error("ADD nicht ausgeführt für ungültige Schwimmernummer $nummer");
                            $results[] = ['kommando' => 'ADD', 'status' => "ungültige Schwimmernummer: $nummer", 'nummer' => $nummer, 'anzahl' => $anzahl];
                        }
                        $updates[] = lies_schwimmer($nummer);
                    } catch (Exception $e) {
                        Logger::info("Fehler bei ADD-Parametern: " . $e->getMessage());
                        $results[] = ['kommando' => 'ADD', 'status' => 'ungültige Parameter: ' . $e->getMessage()];
                    }
                } else {
                    $results[] = ['kommando' => 'ADD', 'parameter' => $parameter, 'status' => 'existierte bereits'];
                }

            } elseif ($kommando === 'GETB') {
                try {
                    Logger::info("Schwimmer der Bahnen " . json_encode($parameter) . " werden von Client-ID: $clientid abgerufen");
                    foreach ($parameter as $bahnnr) {
                        $updates = array_merge($updates, lies_schwimmer_vonBahn((int)$bahnnr));
                    }
                    $results[] = ['kommando' => 'GETB', 'status' => 'erfolgreich', 'bahnen' => $parameter];
                } catch (Exception $e) {
                    Logger::info("Fehler bei GETB-Parametern: " . $e->getMessage());
                    $results[] = ['kommando' => 'GETB', 'status' => 'ungültige Parameter: ' . $e->getMessage()];
                }

            } elseif ($kommando === 'GET') {
                Logger::info("Tabelle schwimmer wird von Client-ID: $clientid abgerufen");
                if ($parameter === []) {
                    $updates = liste_tabelle('schwimmer');
                } else {
                    $swimmer = lies_schwimmer((int)$parameter[0]);
                    if ($swimmer !== null) {
                        $updates = [$swimmer];
                    } else {
                        Logger::info("GET: Schwimmer " . (int)$parameter[0] . " nicht gefunden");
                    }
                }

            } elseif ($kommando === 'VIEW') {
                $db->setBegin(false);
                if (in_array('update_swimmer', $parameter, true)) {
                    json_response(['swimmerMap' => liste_tabelle('schwimmer')]);
                } elseif (count($parameter) > 0) {
                    json_response(['actions' => finde_actions_after_timestamp($parameter[0])]);
                } else {
                    json_response([
                        'swimmerMap' => liste_tabelle('schwimmer'),
                        'actions'    => liste_tabelle('actions'),
                    ]);
                }
                return;

            } elseif ($kommando === 'ACT') {
                try {
                    $nummer = (int)$parameter[0];
                    $value  = (int)$parameter[1];
                    erstelle_action($user_id, (int)$clientid, (string)$timestamp, 'ACT', json_encode($parameter));
                    if (update_schwimmer($nummer, ['aktiv' => $value])) {
                        Logger::info("ACT ausgeführt: Schwimmer $nummer erhält Aktivitätswert $value");
                        $results[] = ['kommando' => 'ACT', 'status' => 'erfolgreich', 'nummer' => $nummer, 'value' => $value];
                    } elseif (lies_schwimmer($nummer) === null) {
                        $status = ($value === 0) ? 'erfolgreich' : 'nicht gefunden';
                        Logger::info("ACT: Schwimmer $nummer nicht gefunden – status=$status (value=$value)");
                        $results[] = ['kommando' => 'ACT', 'status' => $status, 'nummer' => $nummer, 'value' => $value];
                    } else {
                        Logger::error("ACT: Schwimmer $nummer konnte nicht aktualisiert werden");
                        $results[] = ['kommando' => 'ACT', 'status' => 'FEHLER', 'nummer' => $nummer, 'value' => $value];
                    }
                } catch (\Throwable $e) {
                    Logger::info("Fehler bei ACT-Parametern: " . $e->getMessage());
                    $results[] = ['kommando' => 'ACT', 'status' => 'ungültige Parameter: ' . $e->getMessage()];
                }
            } else {
                Logger::debug("Unbekanntes Kommando: $kommando");
            }
        }

        $db->setBegin(false);
        json_response(['results' => $results, 'updates' => $updates]);

    } catch (\Throwable $e) {
        Logger::error("Fehler beim Verarbeiten der Actions - rollback: " . $e->getMessage());
        $db->rollback();
        Logger::info("Rollback der DB-Veränderungen aufgrund eines Fehlers");
        http_response_code(400);
        echo 'Fehler';
    }
}
