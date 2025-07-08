WITH mit_diff AS (
  SELECT
    CAST(json_extract(parameter, '$[0]') AS INTEGER) AS schwimmerID,
    ROUND((julianday(zeitstempel) - julianday(LAG(zeitstempel) OVER (
        PARTITION BY CAST(json_extract(parameter, '$[0]') AS INTEGER)
        ORDER BY zeitstempel))) * 86400, 1) AS diff_in_sek
  FROM actions
  WHERE kommando = "ADD"
)
SELECT
  s.nummer AS schwimmerID,
  s.vorname,
  s.nachname,
  s.istKind,
  s.gruppe,
  COUNT(*) AS anzahl_intervall,
  ROUND(AVG(diff_in_sek), 1) AS avg_diff_sek
FROM mit_diff d
JOIN schwimmer s ON s.nummer = d.schwimmerID
WHERE diff_in_sek BETWEEN 60 AND 400
GROUP BY s.nummer, s.vorname, s.nachname, s.istKind, s.gruppe
ORDER BY s.nummer;
