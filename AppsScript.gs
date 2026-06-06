/* ============================================================
   Google Apps Script — Physics Wallah Sheet Repository Backend
   Sheet: User Database (ID + Password)
   ============================================================
   
   📌 HOW TO DEPLOY:
   1. Open your Google Sheet
   2. Extensions → Apps Script
   3. Paste this entire code
   4. Deploy → New Deployment → Web App
   5. Who can access: "Anyone with Google account"
   6. Copy the Web App URL → paste in signup.html & forgot.html
   ============================================================ */

// ⚙️ CONFIG
const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const USER_SHEET_NAME = "Sheet1";  // jahan ID/Password store hain
const OTP_SHEET_NAME = "OTP";      // OTP store karne ke liye (auto-create hoga)

// ============================================================
// MAIN HANDLER — All requests come here
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "";

    if (action === "signup") return handleSignup(data);
    if (action === "sendOTP") return handleSendOTP(data);
    if (action === "verifyOTP") return handleVerifyOTP(data);
    if (action === "resetPassword") return handleResetPassword(data);

    return sendJSON({ success: false, error: "Unknown action" });
  } catch (err) {
    return sendJSON({ success: false, error: err.toString() });
  }
}

// ============================================================
// DO-GET (for testing)
// ============================================================
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "alive", message: "Apps Script is running!" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 1. SIGNUP — New user register karega
// ============================================================
function handleSignup(data) {
  const email = data.email.trim().toLowerCase();
  const password = data.password.trim();

  if (!email || !password) {
    return sendJSON({ success: false, error: "Email and password required" });
  }

  if (password.length < 6) {
    return sendJSON({ success: false, error: "Password must be at least 6 characters" });
  }

  const sheet = getSheet(USER_SHEET_NAME);
  const existingData = sheet.getDataRange().getValues();

  // Check duplicate email
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]?.toString().trim().toLowerCase() === email) {
      return sendJSON({ success: false, error: "Email already registered" });
    }
  }

  // Add new user
  sheet.appendRow([email, password]);
  return sendJSON({ success: true, message: "Account created successfully" });
}

// ============================================================
// 2. SEND OTP — Email par OTP bhejega
// ============================================================
function handleSendOTP(data) {
  const email = data.email.trim().toLowerCase();

  if (!email) {
    return sendJSON({ success: false, error: "Email required" });
  }

  // Check if email exists in user DB
  const sheet = getSheet(USER_SHEET_NAME);
  const existingData = sheet.getDataRange().getValues();
  let userExists = false;
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][0]?.toString().trim().toLowerCase() === email) {
      userExists = true;
      break;
    }
  }
  if (!userExists) {
    return sendJSON({ success: false, error: "Email not registered" });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

  // Store OTP in OTP sheet
  const otpSheet = getSheet(OTP_SHEET_NAME);
  // Clear old OTPs for this email
  const otpData = otpSheet.getDataRange().getValues();
  for (let i = otpData.length - 1; i >= 1; i--) {
    if (otpData[i][0]?.toString().trim().toLowerCase() === email) {
      otpSheet.deleteRow(i + 1);
    }
  }
  otpSheet.appendRow([email, otp, expiry]);

  // Send email with OTP
  try {
    MailApp.sendEmail({
      to: email,
      subject: "🔐 Your OTP for Password Reset - Physics Wallah Sheet Repository",
      htmlBody: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://upload.wikimedia.org/wikipedia/commons/d/dd/Physics_wallah_logo.svg" alt="PW Logo" style="width:48px;height:48px;object-fit:contain;">
            <h2 style="margin: 8px 0 4px; color: #1f2937;">Physics Wallah</h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">Sheet Repository — Password Reset OTP</p>
          </div>
          <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e5e7eb;">
            <p style="color: #374151; font-size: 14px; margin: 0 0 16px;">Your OTP for password reset is:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6366f1; background: #eef2ff; padding: 12px 24px; border-radius: 12px; display: inline-block;">
              ${otp}
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0;">This OTP is valid for 5 minutes only.</p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 20px;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `
    });
  } catch (e) {
    return sendJSON({ success: false, error: "Failed to send email. Check if you have email sending enabled." });
  }

  return sendJSON({ success: true, message: "OTP sent to your email" });
}

// ============================================================
// 3. VERIFY OTP — User ka OTP check karega
// ============================================================
function handleVerifyOTP(data) {
  const email = data.email.trim().toLowerCase();
  const otp = data.otp.trim();

  if (!email || !otp) {
    return sendJSON({ success: false, error: "Email and OTP required" });
  }

  const otpSheet = getSheet(OTP_SHEET_NAME);
  const otpData = otpSheet.getDataRange().getValues();

  for (let i = 1; i < otpData.length; i++) {
    const storedEmail = otpData[i][0]?.toString().trim().toLowerCase();
    const storedOTP = otpData[i][1]?.toString().trim();
    const expiry = Number(otpData[i][2] || 0);

    if (storedEmail === email) {
      // Check expiry
      if (Date.now() > expiry) {
        otpSheet.deleteRow(i + 1);
        return sendJSON({ success: false, error: "OTP expired. Request a new one." });
      }

      // Check OTP match
      if (storedOTP === otp) {
        return sendJSON({ success: true, message: "OTP verified successfully" });
      } else {
        return sendJSON({ success: false, error: "Invalid OTP. Try again." });
      }
    }
  }

  return sendJSON({ success: false, error: "No OTP found for this email. Request a new one." });
}

// ============================================================
// 4. RESET PASSWORD — Nayi password set karega
// ============================================================
function handleResetPassword(data) {
  const email = data.email.trim().toLowerCase();
  const otp = data.otp.trim();
  const newPassword = data.password.trim();

  if (!email || !otp || !newPassword) {
    return sendJSON({ success: false, error: "Email, OTP, and new password required" });
  }

  if (newPassword.length < 6) {
    return sendJSON({ success: false, error: "Password must be at least 6 characters" });
  }

  // Verify OTP first
  const otpSheet = getSheet(OTP_SHEET_NAME);
  const otpData = otpSheet.getDataRange().getValues();
  let otpVerified = false;

  for (let i = 1; i < otpData.length; i++) {
    const storedEmail = otpData[i][0]?.toString().trim().toLowerCase();
    const storedOTP = otpData[i][1]?.toString().trim();
    const expiry = Number(otpData[i][2] || 0);

    if (storedEmail === email && storedOTP === otp && Date.now() <= expiry) {
      otpVerified = true;
      // Delete used OTP
      otpSheet.deleteRow(i + 1);
      break;
    }
  }

  if (!otpVerified) {
    return sendJSON({ success: false, error: "Invalid or expired OTP. Request a new one." });
  }

  // Update password in user sheet
  const sheet = getSheet(USER_SHEET_NAME);
  const userData = sheet.getDataRange().getValues();

  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0]?.toString().trim().toLowerCase() === email) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return sendJSON({ success: true, message: "Password reset successfully!" });
    }
  }

  return sendJSON({ success: false, error: "User not found" });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function sendJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Add headers
    if (name === USER_SHEET_NAME) {
      sheet.appendRow(["Email", "Password"]);
    } else if (name === OTP_SHEET_NAME) {
      sheet.appendRow(["Email", "OTP", "Expiry"]);
    }
  }
  return sheet;
}

// ============================================================
// FOR TESTING IN APPS SCRIPT EDITOR
// ============================================================
function testSignup() {
  const result = handleSignup({ email: "test@company.com", password: "test123" });
  console.log(result);
}

function testSendOTP() {
  const result = handleSendOTP({ email: "test@company.com" });
  console.log(result);
}

function testVerifyOTP() {
  const result = handleVerifyOTP({ email: "test@company.com", otp: "123456" });
  console.log(result);
}

function testResetPassword() {
  const result = handleResetPassword({ email: "test@company.com", otp: "123456", password: "newpass123" });
  console.log(result);
}
