let regexp = /^\d\d\d$/; // regular Expression um die SchwimmerNummern zu prüfen

export function initStatusMessage() {
    // erst die CSS-Styles
    const style = document.createElement('style');
    style.textContent = ``;
    // document.head.appendChild(style);

    // dann die HTML-Zeilen
    const modalHTML = `
    <div id="statusMessage" style="display:none; position:fixed; top:0px; left:50%; transform:translateX(-50%);
padding: 0em 0.5em 0.2em; color:white; border-radius:5px; opacity: 0.9; z-index:1000;"></div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHTML;
    document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
}


export function initMyModal() {
    // erst die CSS-Styles
    const style = document.createElement('style');
    style.textContent = `
    .mymodal {
        display: none;
        position: fixed;
        z-index: 1;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
    }
    .mymodal-content {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        position: relative;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
    }

    .mymodal-content button:disabled {
        background-color: grey;
    }
    `;
    document.head.appendChild(style);

    // dann die HTML-Zeilen
    const modalHTML = `
    <div id="myModal" class="mymodal">
        <div id="modalContent" class="mymodal-content" style="text-align: center;">
        </div>
    </div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHTML;
    document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
}

export function showStatusMessage(text, isSuccess = true, duration = 3000) {
    const msg = document.getElementById("statusMessage");
    msg.zIndex = '1000';
    msg.textContent = text;
    msg.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
    msg.style.display = "block";

    setTimeout(() => {
        msg.style.display = "none";
    }, duration);
}


// Funktion um das Modal anzuzeigen und die Nummer zu erfragen
export function schwimmerNummerErfragen(length = 3) {
    if (length<=0) {
        regexp = new RegExp('^\\d+$');
    } else {
        regexp = new RegExp('^' + '\\d'.repeat(length) + '$');
    }
    console.log("Regexp", regexp);
    return new Promise(resolve => {
        const innerHTML = `
            <h2 style="color: black;">Schwimmer Nummer:</h2>
            <input type="number" id="nummer" name="nummer" placeholder="${'x'.repeat(length>=0?length:0)}" maxlength="3"
                   style="font-size: 3em; text-align: center; width: 100%; box-sizing: border-box; margin-bottom: 16px; display: block;">
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button id="closeBtn">Schließen</button>
                <button id="confirmBtn">Bestätigen</button>
            </div>
        `;
        document.getElementById('modalContent').innerHTML = innerHTML;
        const modal = document.getElementById('myModal');
        const input = document.getElementById("nummer");
        const confirmBtn = document.getElementById("confirmBtn");
        confirmBtn.disabled = true;
        const closeBtn = document.getElementById("closeBtn");

        input.value = "";
        modal.style.display = 'block';
        input.focus();

        input.addEventListener('input', checkNummerInput);
        checkNummerInput();

        confirmBtn.onclick = () => {
            const nummer = input.value.trim();
            closeModal();
            resolve(nummer);
        };

        closeBtn.onclick = () => {
            closeModal();
            resolve(null); // oder leerer String
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });
    });
}


// Funktion zum Schließen des Modals
function closeModal() {
    document.getElementById('myModal').style.display = 'none';
}

function isNummerInputValid(value) {
    console.log("Regexp in isNummerInputValid", regexp, "test", value.trim(), "is", regexp.test(value.trim()));
    // Prüft, ob der Eingabewert aus drei aufeinander folgenden Ziffern besteht
    // Regulärer Ausdruck:
    // ^         → Anfang des Strings
    // \d+       → mindestens eine Ziffer
    // (,\d+)*   → optional beliebig viele Gruppen aus Komma gefolgt von mindestens einer Ziffer
    // $         → Ende des Strings
    return regexp.test(value.trim());
}

function checkNummerInput() {
    const input = document.getElementById("nummer");
    const confirmBtn = document.getElementById("confirmBtn");
    if (isNummerInputValid(input.value)) {
        input.style.backgroundColor = ""; // gültig
        confirmBtn.disabled = false;
    } else {
        input.style.backgroundColor = "#fdd"; // ungültig (rot)
        confirmBtn.disabled = true;
    }
}


initMyModal();
initStatusMessage();