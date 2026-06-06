/* ============================================================
   auth.js — Authentication Logic
   - Login: validates against Google Sheet user DB (CSV)
   ============================================================ */

// ⚙️ CONFIG — Change these for your company
const ALLOWED_DOMAIN = "@pw.live";
const COMPANY_NAME   = "Physics Wallah";
const COMPANY_TAG    = "Sheet Repository";

const USER_DB_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHH00xEJap1iWdn7vz5KBqpxG20G0w5IUVU2771CzDPQpA5vAfIhwQ48bTnxx19B0-MlrJfZOi_f8D/pub?output=csv";

// ===== PASSWORD SHOW/HIDE TOGGLE =====
function togglePassword(fieldId) {
  const input = document.getElementById(fieldId);
  const btn = input?.parentElement?.querySelector('.pwd-toggle');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁';
  }
}

// ===== EMAIL + PASSWORD LOGIN =====
async function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const message = document.getElementById("authMessage");
  const btn = document.querySelector(".btn-signin");

  message.innerText = "";

  if (!email) { message.innerText = "Please enter your email."; return; }
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    message.innerText = `Only ${ALLOWED_DOMAIN} emails are allowed.`;
    return;
  }
  if (!password) { message.innerText = "Please enter your password."; return; }

  btn.innerHTML = '<span class="btn-spinner"></span><span>Signing in...</span>';
  btn.disabled = true;

  try {
    const res = await fetch(USER_DB_URL + "&t=" + Date.now());
    const text = await res.text();
    const allRows = text.split("\n").filter(r => r.trim());
    let rows = allRows;

    // Agar pehli row header hai (e.g. "Email") to skip karo, warna nahi
    if (allRows.length > 0 && allRows[0].toLowerCase().includes("email")) {
      rows = allRows.slice(1);
    }

    let validUser = false;

    rows.forEach(row => {
      const cols = row.split(",");
      const dbEmail = cols[0]?.trim().toLowerCase();
      const dbPassword = cols[1]?.trim();
      if (dbEmail === email.toLowerCase() && dbPassword === password) {
        validUser = true;
      }
    });

    if (validUser) {
      localStorage.setItem("loggedUser", email);
      window.location.href = "index.html";
    } else {
      message.innerText = "Invalid email or password.";
      btn.innerHTML = "<span>Sign In</span><span class='btn-arrow'>→</span>";
      btn.disabled = false;
    }
  } catch (err) {
    console.error("Login error:", err);
    message.innerText = "Error connecting. Please try again.";
    btn.innerHTML = "<span>Sign In</span><span class='btn-arrow'>→</span>";
    btn.disabled = false;
  }
}

// Enter key support
document.addEventListener("DOMContentLoaded", function() {
  createDoodles();
  const loginForm = document.querySelector(".auth-body");
  if (loginForm) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.getElementById("email")) signIn();
    });
  }
});

// ===== PW LOGO DOODLE WALLPAPER =====
function createDoodles() {
  const container = document.getElementById('bgDoodles');
  if (!container || container.querySelector('img')) return;
  
  const logoUrl = 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Physics_wallah_logo.svg';
  const count = 50;
  
  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: doodleFloat ${25 + Math.random() * 30}s ease-in-out infinite;
      animation-delay: ${Math.random() * -30}s;
      pointer-events: none;
      z-index: 0;
    `;

    const img = document.createElement('img');
    img.className = 'doodle-img';
    img.src = logoUrl;
    img.style.cssText = `
      width: ${16 + Math.random() * 35}px;
      height: auto;
      transform: rotate(${Math.random() * 360}deg);
      display: block;
      pointer-events: none;
      user-select: none;
    `;
    img.setAttribute('loading', 'lazy');
    img.setAttribute('alt', '');
    wrapper.appendChild(img);
    container.appendChild(wrapper);
  }
}
