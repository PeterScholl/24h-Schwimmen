<!doctype html>
<html>
<head>
    <title>QR-Code</title>
    <script src="/qrcode.min.js"></script>
    <link rel="stylesheet" type="text/css" media="screen" href="/main.css" />
</head>
<body>
    <h2>QR-Code für <?= $ip_url ?></h2>
    <div id="qrcode" style="padding: 20px;" onclick="window.close()"></div>
    <button onclick="window.close()">Fenster schließen</button>
    <script>
        new QRCode(document.getElementById("qrcode"), "<?= $ip_url ?>");
    </script>
</body>
</html>
