/* ============================================================
   PinnedSync.gs — Google Apps Script
   Add this to your existing Login Credentials sheet:
     Extensions → Apps Script → Paste → Deploy as Web App
   ============================================================ */

/**
 * GET ?email=user@pw.live
 *      ?email=user@pw.live&action=set&pins=["SheetA","SheetB"]
 *
 * READ:  Returns { "pins": ["SheetA", "SheetB"] }
 * WRITE: Saves pins and returns { "success": true, "pins": [...] }
 */
function doGet(e) {
  const email = e?.parameter?.email?.trim().toLowerCase();
  if (!email) {
    return jsonResponse({ error: "Missing 'email' parameter" }, 400);
  }

  // ── WRITE mode ──────────────────────────────────────────
  if (e?.parameter?.action === "set" && e?.parameter?.pins) {
    const pins = parsePins(e.parameter.pins);
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || "").trim().toLowerCase() === email) {
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

  // ── READ mode ──────────────────────────────────────────
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === email) {
      const pins = parsePins(data[i][1]);
      return jsonResponse({ pins });
    }
  }

  return jsonResponse({ pins: [] });
}

/**
 * POST with JSON body:
 * { "email": "user@pw.live", "pins": ["SheetA", "SheetB"] }
 * Returns: { "success": true, "pins": [...] }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const email = body.email?.trim().toLowerCase();
    const pins = body.pins;

    if (!email || !Array.isArray(pins)) {
      return jsonResponse({ error: "Requires 'email' (string) and 'pins' (array)" }, 400);
    }

    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || "").trim().toLowerCase() === email) {
        sheet.getRange(i + 1, 2).setValue(JSON.stringify(pins));
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([email, JSON.stringify(pins)]);
    }

    return jsonResponse({ success: true, pins });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ===== HELPERS =====

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("PinnedData");
  if (sheet) return sheet;

  // Create new sheet with header row
  sheet = ss.insertSheet("PinnedData");
  sheet.appendRow(["Email", "PinnedSheets"]);
  sheet.setFrozenRows(1);
  // Optional: bold the header
  sheet.getRange("A1:B1").setFontWeight("bold");
  return sheet;
}

function parsePins(val) {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    output.setStatusCode(statusCode);
  }
  return output;
}
