<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/all.min.css">
    <style>
        body { font-family: sans-serif; margin: 0; background-color: #f0f5f9; color: #333; }
        header { background-color: #2962ff; color: #ffffff; padding: 20px 0; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); }
        header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
        .login-container { max-width: 400px; margin: 50px auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .login-container h2 { color: #2962ff; text-align: center; }
        .login-form { display: flex; flex-direction: column; gap: 15px; }
        .login-form input { padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 5px; outline: none; }
        .login-form input:focus { border-color: #2962ff; }
        .login-form button { background-color: #2962ff; color: #fff; padding: 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .login-form button:hover { background-color: #0d47a1; }
        .error-message { color: red; font-size: 14px; text-align: center; }
        footer { background-color: #448aff; color: #fff; text-align: center; padding: 1rem 0; position: fixed; bottom: 0; width: 100%; }
        @media (max-width: 768px) {
            header h1 { font-size: 24px; }
            .login-container { width: 90%; margin: 30px auto; }
        }
    </style>
</head>
<body>
    <header><h1>24h Schwimmen Login</h1></header>
    <div class="login-container">
        <h2>Bitte anmelden</h2>
        <form class="login-form" action="/login" method="POST">
            <input type="text" name="benutzername" placeholder="Benutzername" required>
            <input type="password" name="passwort" placeholder="Passwort" required>
            <button type="submit">Login</button>
        </form>
        <div class="error-message">
            <?php if ($error): ?>Falscher Benutzername oder Passwort.<?php endif; ?>
        </div>
    </div>
    <footer>&copy; 2025 Schwimmen 24h. Alle Rechte vorbehalten.</footer>
</body>
</html>
