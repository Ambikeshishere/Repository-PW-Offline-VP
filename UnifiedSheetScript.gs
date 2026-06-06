/* ============================================================
   UNIFIED Google Apps Script — Pin Sync + Signup OTP + Forgot Password
   Sheet: User Database (ID + Password)
   ============================================================
   
   📌 HOW TO DEPLOY:
   1. Open your Google Sheet
   2. Extensions → Apps Script
   3. Paste this entire code (replace everything)
   4. Deploy → Manage Deployments → select existing → Deploy new version
   5. URL remains the same
   ============================================================ */

// ⚙️ CONFIG
const USER_SHEET_NAME = "Sheet1";    // jahan ID/Password store hain
const OTP_SHEET_NAME = "OTP";        // OTP store (auto-create)
const PIN_SHEET_NAME = "PinnedData"; // Pinned sheets store (auto-create)

// ============================================================
// DO-GET  — Pin READ + health check
// ============================================================
function doGet(e) {
  // Health check (no params)
  if (!e || !e.parameter || !e.parameter.email) {
    return jsonResponse({ status: "alive", message: "Unified script is running!" });
  }

  const email = e.parameter.email.trim().toLowerCase();

  // WRITE mode (pins) — called by GET for backward compat
  if (e.parameter.action === "set" && e.parameter.pins) {
    const pins = parsePins(e.parameter.pins);
    const sheet = getOrCreateSheet(PIN_SHEET_NAME, ["Email", "PinnedSheets"]);
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || "").trim().toLowerCase() === email) {
        sheet.getRange(i + 1, 2).setValue(JSON.stringify(pins));
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([email, JSON.stringify(pins)]);
    return jsonResponse({ success: true, pins });
  }

  // READ mode (pins)
  const sheet = getOrCreateSheet(PIN_SHEET_NAME, ["Email", "PinnedSheets"]);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === email) {
      return jsonResponse({ pins: parsePins(data[i][1]) });
    }
  }
  return jsonResponse({ pins: [] });
}

// ============================================================
// DO-POST — All POST actions in ONE place
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || "";

    if (action === "signup")        return handleSignup(body);
    if (action === "sendOtp")       return handleSendOtp(body);
    if (action === "verifyOtp")     return handleVerifyOtp(body);
    if (action === "sendOTP")       return handleSendOTP(body);
    if (action === "verifyOTP")     return handleVerifyOTP(body);
    if (action === "resetPassword") return handleResetPassword(body);
    if (action === "setPins")       return handleSetPins(body);
    // Also handle pin POST without action (backward compat with app.js)
    if (!action && body.email && Array.isArray(body.pins)) {
      return handleSetPins(body);
    }

    return jsonResponse({ success: false, error: "Unknown action: " + action }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

// ============================================================
// 1. SIGNUP — OTP ke baad account create
// ============================================================
function handleSignup(data) {
  const email = data.email.trim().toLowerCase();
  const password = data.password.trim();
  const otp = String(data.otp || "").trim();

  if (!email || !password || !otp) {
    return jsonResponse({ success: false, error: "Email, password, and OTP required" }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ success: false, error: "Password must be at least 6 characters" }, 400);
  }

  // 1. Verify OTP
  const otpSheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  const otpData = otpSheet.getDataRange().getValues();
  let otpValid = false;
  for (let i = 1; i < otpData.length; i++) {
    const rowEmail = String(otpData[i][0] || "").trim().toLowerCase();
    const rowOtp   = String(otpData[i][1] || "").trim();
    const expiry   = Number(otpData[i][2] || 0);
    if (rowEmail === email && rowOtp === otp && Date.now() <= expiry) {
      otpValid = true;
      otpSheet.deleteRow(i + 1); // consume OTP
      break;
    }
  }
  if (!otpValid) {
    return jsonResponse({ success: false, error: "Invalid or expired OTP. Use sendOtp first." }, 400);
  }

  // 2. Check duplicate
  const userSheet = getSheet(USER_SHEET_NAME);
  const userData  = userSheet.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][0] || "").trim().toLowerCase() === email) {
      return jsonResponse({ success: false, error: "Email already registered" }, 400);
    }
  }

  // 3. Create account
  userSheet.appendRow([email, password]);
  return jsonResponse({ success: true, message: "Account created successfully!" });
}

// ============================================================
// 2. SEND OTP for SIGNUP (lowercase 't') — any @pw.live email
// ============================================================
function handleSendOtp(data) {
  const email = data.email.trim().toLowerCase();
  if (!email) return jsonResponse({ success: false, error: "Email required" }, 400);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = Date.now() + 10 * 60 * 1000; // 10 min

  const sheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  clearOldOtps(sheet, email);
  sheet.appendRow([email, otp, expiry]);

  sendOtpEmail(email, otp, "account verification", "Signup OTP");

  return jsonResponse({ success: true, message: "OTP sent to your email" });
}

// ============================================================
// 3. VERIFY OTP for SIGNUP (lowercase 't')
// ============================================================
function handleVerifyOtp(data) {
  const email = data.email.trim().toLowerCase();
  const otp = String(data.otp || "").trim();
  if (!email || !otp) return jsonResponse({ success: false, error: "Email and OTP required" }, 400);

  const sheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  const otpData = sheet.getDataRange().getValues();

  for (let i = 1; i < otpData.length; i++) {
    const rowEmail = String(otpData[i][0] || "").trim().toLowerCase();
    const rowOtp   = String(otpData[i][1] || "").trim();
    const expiry   = Number(otpData[i][2] || 0);
    if (rowEmail === email && rowOtp === otp && Date.now() <= expiry) {
      return jsonResponse({ success: true, message: "OTP verified" });
    }
    if (rowEmail === email && rowOtp === otp && Date.now() > expiry) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: false, error: "OTP expired. Request a new one." }, 400);
    }
  }
  return jsonResponse({ success: false, error: "Invalid OTP. Request a new one." }, 400);
}

// ============================================================
// 4. SEND OTP for FORGOT PASSWORD (uppercase 'T') — checks email exists
// ============================================================
function handleSendOTP(data) {
  const email = data.email.trim().toLowerCase();
  if (!email) return jsonResponse({ success: false, error: "Email required" }, 400);

  // Check if user exists
  const userSheet = getSheet(USER_SHEET_NAME);
  const userData  = userSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][0] || "").trim().toLowerCase() === email) { found = true; break; }
  }
  if (!found) return jsonResponse({ success: false, error: "Email not registered" }, 400);

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = Date.now() + 5 * 60 * 1000; // 5 min (as in original forgot.html)

  const sheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  clearOldOtps(sheet, email);
  sheet.appendRow([email, otp, expiry]);

  sendOtpEmail(email, otp, "password reset", "Password Reset OTP");

  return jsonResponse({ success: true, message: "OTP sent to your email" });
}

// ============================================================
// 5. VERIFY OTP for FORGOT PASSWORD (uppercase 'T')
// ============================================================
function handleVerifyOTP(data) {
  const email = data.email.trim().toLowerCase();
  const otp = String(data.otp || "").trim();
  if (!email || !otp) return jsonResponse({ success: false, error: "Email and OTP required" }, 400);

  const sheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  const otpData = sheet.getDataRange().getValues();

  for (let i = 1; i < otpData.length; i++) {
    const rowEmail = String(otpData[i][0] || "").trim().toLowerCase();
    const rowOtp   = String(otpData[i][1] || "").trim();
    const expiry   = Number(otpData[i][2] || 0);
    if (rowEmail === email && rowOtp === otp && Date.now() <= expiry) {
      return jsonResponse({ success: true, message: "OTP verified successfully" });
    }
    if (rowEmail === email && rowOtp === otp && Date.now() > expiry) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: false, error: "OTP expired. Request a new one." }, 400);
    }
  }
  return jsonResponse({ success: false, error: "No valid OTP found. Request a new one." }, 400);
}

// ============================================================
// 6. RESET PASSWORD
// ============================================================
function handleResetPassword(data) {
  const email = data.email.trim().toLowerCase();
  const otp = String(data.otp || "").trim();
  const newPassword = data.password.trim();

  if (!email || !otp || !newPassword) {
    return jsonResponse({ success: false, error: "Email, OTP, and new password required" }, 400);
  }
  if (newPassword.length < 6) {
    return jsonResponse({ success: false, error: "Password must be at least 6 characters" }, 400);
  }

  // Verify OTP
  const otpSheet = getOrCreateSheet(OTP_SHEET_NAME, ["Email", "OTP", "Expiry"]);
  const otpData = otpSheet.getDataRange().getValues();
  let otpVerified = false;
  for (let i = 1; i < otpData.length; i++) {
    const rowEmail = String(otpData[i][0] || "").trim().toLowerCase();
    const rowOtp   = String(otpData[i][1] || "").trim();
    const expiry   = Number(otpData[i][2] || 0);
    if (rowEmail === email && rowOtp === otp && Date.now() <= expiry) {
      otpVerified = true;
      otpSheet.deleteRow(i + 1); // consume OTP
      break;
    }
  }
  if (!otpVerified) {
    return jsonResponse({ success: false, error: "Invalid or expired OTP. Request a new one." }, 400);
  }

  // Update password
  const sheet = getSheet(USER_SHEET_NAME);
  const userData = sheet.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][0] || "").trim().toLowerCase() === email) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return jsonResponse({ success: true, message: "Password reset successfully!" });
    }
  }
  return jsonResponse({ success: false, error: "User not found" }, 404);
}

// ============================================================
// 7. SET PINS
// ============================================================
function handleSetPins(data) {
  const email = data.email.trim().toLowerCase();
  const pins = data.pins;
  if (!email || !Array.isArray(pins)) {
    return jsonResponse({ error: "Requires 'email' (string) and 'pins' (array)" }, 400);
  }

  const sheet = getOrCreateSheet(PIN_SHEET_NAME, ["Email", "PinnedSheets"]);
  const sheetData = sheet.getDataRange().getValues();

  let found = false;
  for (let i = 1; i < sheetData.length; i++) {
    if (String(sheetData[i][0] || "").trim().toLowerCase() === email) {
      sheet.getRange(i + 1, 2).setValue(JSON.stringify(pins));
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow([email, JSON.stringify(pins)]);
  }

  return jsonResponse({ success: true, pins });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sheet;
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(["Email", "Password"]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:B1").setFontWeight("bold");
  }
  return sheet;
}

function clearOldOtps(sheet, email) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || "").trim().toLowerCase() === email) {
      sheet.deleteRow(i + 1);
    }
  }
}

function parsePins(val) {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

function sendOtpEmail(toEmail, otp, purpose, subject) {
  MailApp.sendEmail({
    to: toEmail,
    subject: "🔐 Your OTP for " + subject + " - Physics Wallah Sheet Repository",
    htmlBody: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Physics_wallah_logo.svg" alt="PW Logo" style="width:48px;height:48px;object-fit:contain;">
          <h2 style="margin: 8px 0 4px; color: #1f2937;">Physics Wallah</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0;">Sheet Repository — ${subject}</p>
        </div>
        <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e5e7eb;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Your OTP for ${purpose} is:</p>
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6366f1; background: #eef2ff; padding: 12px 24px; border-radius: 12px; display: inline-block;">
            ${otp}
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">This OTP is valid for 10 minutes.</p>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `
  });
}

function jsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) output.setStatusCode(statusCode);
  return output;
}
