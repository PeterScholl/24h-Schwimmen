<?php
class Logger {
    const DEBUG = 0;
    const INFO  = 1;
    const ERROR = 2;

    private static string $logFile      = '';
    private static int    $fileLevel    = self::DEBUG;
    private static int    $consoleLevel = self::INFO;

    public static function init(string $logFile): void {
        self::$logFile = $logFile;
        $dir = dirname($logFile);
        if ($dir && !is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }

    private static function write(int $level, string $levelName, string $msg): void {
        $line = date('Y-m-d H:i:s') . " - $levelName - $msg";
        if (self::$logFile && $level >= self::$fileLevel) {
            file_put_contents(self::$logFile, $line . "\n", FILE_APPEND | LOCK_EX);
        }
        if ($level >= self::$consoleLevel) {
            error_log($line);
        }
    }

    public static function debug(string $msg): void { self::write(self::DEBUG, 'DEBUG', $msg); }
    public static function info(string $msg): void  { self::write(self::INFO,  'INFO',  $msg); }
    public static function error(string $msg): void { self::write(self::ERROR, 'ERROR', $msg); }
}
