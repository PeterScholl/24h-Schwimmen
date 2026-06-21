<?php
$configPath = __DIR__ . '/../config.json';
$configJson = file_get_contents($configPath);
if ($configJson === false) {
    http_response_code(500);
    die('Konfigurationsdatei nicht lesbar: ' . $configPath);
}
$config = json_decode($configJson, true);
if ($config === null) {
    http_response_code(500);
    die('Fehler beim JSON-Decode der Konfiguration: ' . json_last_error_msg());
}
