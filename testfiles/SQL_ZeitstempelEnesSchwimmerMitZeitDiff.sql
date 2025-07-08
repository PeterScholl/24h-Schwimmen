SELECT
  id,
  benutzer_id,
  zeitstempel,
  CAST(json_extract(parameter, '$[0]') AS INTEGER) AS schwimmerID,
  json_extract(parameter, '$[1]') AS anzahl,
  ROUND((julianday(zeitstempel) - julianday(LAG(zeitstempel) OVER (
      PARTITION BY benutzer_id ORDER BY zeitstempel))) * 86400, 1) AS diff_in_sek
FROM actions
WHERE kommando = "ADD"
  AND schwimmerID = 2
ORDER BY zeitstempel ASC;
