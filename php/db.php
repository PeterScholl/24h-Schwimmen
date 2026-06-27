<?php
class Database {
    public PDO $pdo;
    public bool $begin = false;

    public function __construct(string $dsn, string $user, string $pass) {
        $this->pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    public function execute(string $query, array $params = []): ?PDOStatement {
        try {
            $stmt = $this->pdo->prepare($query);
            foreach ($params as $i => $v) {
                $type = is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR;
                $stmt->bindValue($i + 1, $v, $type);
            }
            $stmt->execute();
            return $stmt;
        } catch (PDOException $e) {
            Logger::error(sprintf('DB-Fehler: %s | Query: %s | Params: %s',
                $e->getMessage(),
                preg_replace('/\s+/', ' ', $query),
                json_encode($params, JSON_UNESCAPED_UNICODE)
            ));
            return null;
        }
    }

    public function fetchAll(string $query, array $params = []): array {
        $stmt = $this->execute($query, $params);
        return $stmt ? $stmt->fetchAll() : [];
    }

    public function fetchOne(string $query, array $params = []): ?array {
        $stmt = $this->execute($query, $params);
        if (!$stmt) return null;
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function lastInsertId(): int {
        return (int)$this->pdo->lastInsertId();
    }

    public function setBegin(bool $value): void {
        if ($this->begin === $value) return;
        $this->begin = $value;
        if ($value) {
            $this->pdo->beginTransaction();
        } else {
            $this->pdo->commit();
        }
    }

    public function rollback(): void {
        if ($this->begin) {
            $this->pdo->rollBack();
            $this->begin = false;
        }
    }
}

$db = null;

function getDb(): Database {
    global $db, $config;
    if ($db === null) {
        $host    = $config['db_host'] ?? 'localhost';
        $name    = $config['db_name'] ?? '24h_schwimmen';
        $user    = $config['db_user'] ?? 'root';
        $pass    = $config['db_pass'] ?? '';
        $charset = $config['db_charset'] ?? 'utf8mb4';
        $db = new Database("mysql:host=$host;dbname=$name;charset=$charset", $user, $pass);
    }
    return $db;
}

// ===================================================
// DATENBANK-INITIALISIERUNG
// ===================================================

function init_db(): void {
    $db = getDb();
    $db->execute("CREATE TABLE IF NOT EXISTS benutzer (
        id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name        TEXT NOT NULL,
        benutzername VARCHAR(255) UNIQUE NOT NULL,
        passwort    TEXT NOT NULL,
        admin       TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->execute("CREATE TABLE IF NOT EXISTS clients (
        id                      INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        ip                      TEXT NOT NULL,
        benutzer_id             INT,
        zeitpunkt_letzte_aktion TEXT,
        FOREIGN KEY (benutzer_id) REFERENCES benutzer(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->execute("CREATE TABLE IF NOT EXISTS schwimmer (
        nummer                  INT NOT NULL PRIMARY KEY,
        erstellt_von_client_id  INT,
        vorname                 TEXT,
        nachname                TEXT,
        istKind                 INT,
        gruppe                  TEXT,
        bahnanzahl              INT,
        strecke                 INT,
        auf_bahn                INT,
        aktiv                   TINYINT(1),
        FOREIGN KEY (erstellt_von_client_id) REFERENCES clients(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->execute("CREATE TABLE IF NOT EXISTS actions (
        id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        benutzer_id INT,
        client_id   INT,
        zeitstempel TEXT,
        kommando    TEXT,
        parameter   TEXT,
        FOREIGN KEY (benutzer_id) REFERENCES benutzer(id),
        FOREIGN KEY (client_id)   REFERENCES clients(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function liste_tabelle(string $table): array {
    $db = getDb();
    return $db->fetchAll("SELECT * FROM `$table`");
}

function count_tabelle(string $table): int {
    $db = getDb();
    $row = $db->fetchOne("SELECT COUNT(*) AS cnt FROM `$table`");
    return $row ? (int)$row['cnt'] : 0;
}

function liste_tabelle_paged(string $table, int $limit, int $offset): array {
    $db = getDb();
    return $db->fetchAll(
        "SELECT * FROM `$table` ORDER BY id DESC LIMIT ? OFFSET ?",
        [$limit, $offset]
    );
}

function dump(): string {
    $db = getDb();
    $tables = ['benutzer', 'clients', 'schwimmer', 'actions'];
    $sql  = "-- 24h-Schwimmen MySQL Backup\n-- " . date('Y-m-d H:i:s') . "\n\n";
    $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";
    foreach ($tables as $table) {
        $rows = $db->fetchAll("SELECT * FROM `$table`");
        if (empty($rows)) continue;
        $cols = array_keys($rows[0]);
        $colList = implode(', ', array_map(fn($c) => "`$c`", $cols));
        foreach ($rows as $row) {
            $vals = array_map(function ($v) use ($db) {
                if ($v === null) return 'NULL';
                return $db->pdo->quote(strval($v));
            }, array_values($row));
            $sql .= "INSERT INTO `$table` ($colList) VALUES (" . implode(', ', $vals) . ");\n";
        }
        $sql .= "\n";
    }
    $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
    return $sql;
}

// =======================================
// SCHWIMMER-VERWALTUNG
// =======================================

function lies_schwimmer(int $nummer): ?array {
    $db = getDb();
    return $db->fetchOne("SELECT * FROM schwimmer WHERE nummer = ?", [$nummer]);
}

function lies_schwimmer_vonBahn(int $bahnnr): array {
    $db = getDb();
    return $db->fetchAll("SELECT * FROM schwimmer WHERE auf_bahn = ?", [$bahnnr]);
}

function update_schwimmer(int $schwimmer_id, array $kwargs): bool {
    $db = getDb();
    if (empty($kwargs)) return false;
    $sets   = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($kwargs)));
    $values = array_values($kwargs);
    $values[] = $schwimmer_id;
    $stmt = $db->execute("UPDATE schwimmer SET $sets WHERE nummer = ?", $values);
    return $stmt !== null && $stmt->rowCount() > 0;
}

function erstelle_schwimmer(
    int $nummer, int $erstellt_von_client_id, ?string $vorname,
    ?string $nachname, int $istKind, ?string $gruppe,
    int $bahnanzahl, int $strecke, int $auf_bahn, int $aktiv
): bool {
    $db = getDb();
    $stmt = $db->execute(
        "INSERT INTO schwimmer
            (nummer, erstellt_von_client_id, vorname, nachname, istKind, gruppe, bahnanzahl, strecke, auf_bahn, aktiv)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [$nummer, $erstellt_von_client_id, $vorname, $nachname, $istKind, $gruppe, $bahnanzahl, $strecke, $auf_bahn, $aktiv]
    );
    return $stmt !== null;
}

function insertOrUpdateSchwimmer(int $nummer, array $kwargs): bool {
    if (update_schwimmer($nummer, $kwargs)) {
        return true;
    }
    return erstelle_schwimmer(
        $nummer,
        (int)($kwargs['erstellt_von_client_id'] ?? 0),
        $kwargs['vorname']  ?? "Schwimmer $nummer",
        $kwargs['nachname'] ?? '-',
        (int)($kwargs['istKind']    ?? 0),
        $kwargs['gruppe']           ?? '',
        (int)($kwargs['bahnanzahl'] ?? 0),
        (int)($kwargs['strecke']    ?? 0),
        (int)($kwargs['auf_bahn']   ?? 0),
        (int)($kwargs['aktiv']      ?? 1)
    );
}

function get_bahnanzahl(int $nummer): ?int {
    $db = getDb();
    $row = $db->fetchOne("SELECT bahnanzahl FROM schwimmer WHERE nummer = ?", [$nummer]);
    return $row !== null ? (int)$row['bahnanzahl'] : null;
}

function aendere_bahnanzahl_um(int $nummer, int $anzahl, int $client_id, int $bahnnr = 0): void {
    $bahnanzahl = get_bahnanzahl($nummer);
    if ($bahnanzahl === null) {
        $ok = erstelle_schwimmer($nummer, $client_id, "Schwimmer $nummer", '-', 0, '', max($anzahl, 0), 0, $bahnnr, 1);
        if (!$ok) throw new RuntimeException("Schwimmer $nummer konnte nicht erstellt werden");
    } else {
        $neue = max($bahnanzahl + $anzahl, 0);
        $ok   = update_schwimmer($nummer, ['bahnanzahl' => $neue, 'auf_bahn' => $bahnnr]);
        if (!$ok) throw new RuntimeException("Schwimmer $nummer konnte nicht aktualisiert werden");
    }
}

function loesche_schwimmer(int $schwimmerID): ?int {
    $db = getDb();
    $stmt = $db->execute("DELETE FROM schwimmer WHERE nummer = ?", [$schwimmerID]);
    if (!$stmt) return null;
    $rows = $stmt->rowCount();
    return $rows > 0 ? $rows : null;
}

// ========================
// Clients
// ========================

function erstelle_client(string $ip, ?int $benutzer_id = null): int {
    $db = getDb();
    $db->execute(
        "INSERT INTO clients (ip, benutzer_id, zeitpunkt_letzte_aktion) VALUES (?, ?, ?)",
        [$ip, $benutzer_id, date('c')]
    );
    return $db->lastInsertId();
}

function update_client_aktion(int $client_id): void {
    $db = getDb();
    $db->execute("UPDATE clients SET zeitpunkt_letzte_aktion = ? WHERE id = ?", [date('c'), $client_id]);
}

// ========================
// Benutzer
// ========================

function erstelle_benutzer(string $name, string $benutzername, string $passwort, bool $admin = false): bool {
    $db = getDb();
    $stmt = $db->execute(
        "INSERT INTO benutzer (name, benutzername, passwort, admin) VALUES (?, ?, ?, ?)",
        [$name, $benutzername, password_hash($passwort, PASSWORD_DEFAULT), (int)$admin]
    );
    return $stmt !== null;
}

function update_benutzer_by_id(int $user_id, array $kwargs): bool {
    $db = getDb();
    if (empty($kwargs)) return false;
    $sets   = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($kwargs)));
    $values = array_values($kwargs);
    $values[] = $user_id;
    $stmt = $db->execute("UPDATE benutzer SET $sets WHERE id = ?", $values);
    return $stmt !== null && $stmt->rowCount() > 0;
}

function update_benutzer(string $benutzername, ?string $name = null, ?int $admin = null): int {
    $db = getDb();
    $felder = [];
    if ($name  !== null) $felder['name']  = $name;
    if ($admin !== null) $felder['admin'] = $admin;
    if (empty($felder)) return 0;
    $sets   = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($felder)));
    $values = array_values($felder);
    $values[] = $benutzername;
    $stmt = $db->execute("UPDATE benutzer SET $sets WHERE benutzername = ?", $values);
    return $stmt ? $stmt->rowCount() : 0;
}

function passwort_aendern(string $benutzername, string $neues_passwort): bool {
    $db = getDb();
    $stmt = $db->execute(
        "UPDATE benutzer SET passwort = ? WHERE benutzername = ?",
        [password_hash($neues_passwort, PASSWORD_DEFAULT), $benutzername]
    );
    return $stmt !== null && $stmt->rowCount() > 0;
}

function loesche_userID(int $userID): ?int {
    $db = getDb();
    $stmt = $db->execute("DELETE FROM benutzer WHERE id = ?", [$userID]);
    if (!$stmt) return null;
    $rows = $stmt->rowCount();
    return $rows > 0 ? $rows : null;
}

function finde_benutzer_by_username(string $benutzername): ?array {
    $db = getDb();
    return $db->fetchOne("SELECT * FROM benutzer WHERE benutzername = ?", [$benutzername]);
}

// ========================
// Actions
// ========================

function erstelle_action(int $benutzer_id, int $client_id, string $zeitstempel, string $kommando, string $parameter): int {
    $db = getDb();
    $exists = $db->fetchOne(
        "SELECT 1 FROM actions WHERE zeitstempel = ? AND kommando = ? AND parameter = ? LIMIT 1",
        [$zeitstempel, $kommando, $parameter]
    );
    if ($exists) return 0;
    $stmt = $db->execute(
        "INSERT INTO actions (benutzer_id, client_id, zeitstempel, kommando, parameter) VALUES (?, ?, ?, ?, ?)",
        [$benutzer_id, $client_id, $zeitstempel, $kommando, $parameter]
    );
    return ($stmt && $stmt->rowCount() > 0) ? 1 : 0;
}

function finde_actions_after_timestamp(string $timestamp): array {
    $db = getDb();
    return $db->fetchAll("SELECT * FROM actions WHERE zeitstempel > ?", [$timestamp]);
}

function finde_actions_by_schwimmer_nummer(int $nummer): array {
    $db = getDb();
    return $db->fetchAll(
        "SELECT * FROM actions
         WHERE CAST(JSON_EXTRACT(parameter, '\$[0]') AS SIGNED) = ?
         ORDER BY zeitstempel ASC",
        [$nummer]
    );
}

function checkBahnenAnzahlen(): array {
    $db = getDb();
    $query = "
        SELECT
            a.schwimmerID,
            s.vorname,
            s.bahnanzahl      AS Anz,
            a.anzahl          AS ActionAnz,
            GREATEST(a.anzahl, 0) AS ActionAnzErwartet
        FROM (
            SELECT
                CAST(JSON_EXTRACT(parameter, '\$[0]') AS SIGNED) AS schwimmerID,
                SUM(CAST(JSON_EXTRACT(parameter, '\$[1]') AS SIGNED)) AS anzahl
            FROM actions
            WHERE kommando = 'ADD'
            GROUP BY schwimmerID
        ) a
        JOIN schwimmer s ON s.nummer = a.schwimmerID
        WHERE s.bahnanzahl <> GREATEST(a.anzahl, 0)
        ORDER BY schwimmerID ASC
    ";
    return $db->fetchAll($query);
}
