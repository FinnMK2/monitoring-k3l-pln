// ==========================================================================
// 1. CONFIGURATION
// ==========================================================================

var SPREADSHEET_ID = "1RAXGeY1kGDS9RWPj-ktILv_LUA-ZKqr1duhCK61iaTk";
var FONNTE_TOKEN = "MASUKKAN_TOKEN_FONNTE_BARU_DI_SINI";
var FRONTEND_URL = "https://monitoring-k3l-pln.vercel.app";
var AUTH_SALT = "MASUKKAN_SALT_UNIK_DI_SINI";

// ==========================================================================
// 2. CATEGORY MAP
// ==========================================================================

var CATEGORY_MAP = {
  "KEPEMIMPINAN DAN KOMITMEN MANAJEMEN":
    "1. KEPEMIMPINAN DAN KOMITMEN MANAJEMEN",
  "SOSIALISASI, KOORDINASI DAN KERJASAMA DENGAN STAKEHOLDER PENGAMANAN":
    "2. SOSIALISASI, KOORDINASI DAN KERJASAMA DENGAN STAKEHOLDER PENGAMANAN",
  "PEMBINAAN TEKNIS, AUDIT DAN TINJAUAN MANAJEMEN SISTEM PENGAMANAN":
    "3. PEMBINAAN TEKNIS, AUDIT DAN TINJAUAN MANAJEMEN SISTEM PENGAMANAN",
  "IDENTIFIKASI TINGKAT KERAWANAN KEAMANAN, ANALISA RESIKO DAN KONTIJENSI KEAMANAN":
    "4. IDENTIFIKASI TINGKAT KERAWANAN KEAMANAN, ANALISA RESIKO DAN KONTIJENSI KEAMANAN",
  "KOMPETENSI DAN PELATIHAN":
    "5. KOMPETENSI DAN PELATIHAN",
  "PELAPORAN":
    "6. PELAPORAN",
  "PROGRAM PENDUKUNG":
    "7. PROGRAM PENDUKUNG"
};

// ==========================================================================
// 3. RESPONSE & SETTINGS HELPER
// ==========================================================================

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTargetPhone() {
  var props = PropertiesService.getScriptProperties();
  var savedPhone = props.getProperty("TARGET_PHONE");
  return savedPhone ? savedPhone.trim() : "";
}

// ==========================================================================
// 4. MENGELOLA SHEET BERDASARKAN TAHUN
// ==========================================================================

function getYearFromSheetName(name) {
  var match = String(name).match(/(?:^|\D)(20\d{2}|2100)(?=\D|$)/);
  return match ? match[1] : null;
}

function getAvailableYears(ss) {
  var years = {};
  ss.getSheets().forEach(function(sheet) {
    var year = getYearFromSheetName(sheet.getName());
    if (year) years[year] = true;
  });
  return Object.keys(years).sort();
}

function listYears() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return jsonResponse({ status: "success", years: getAvailableYears(ss) });
}

function findYearSheet(ss, year) {
  var preferred = year === "2026" ? ss.getSheetByName("Proker KAM 2026 TW 2") : null;
  preferred = preferred || ss.getSheetByName("Proker KAM " + year) || ss.getSheetByName(year);
  if (preferred) return preferred;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (getYearFromSheetName(sheets[i].getName()) === year) return sheets[i];
  }
  return null;
}

function getSheet(year) {
  year = year ? String(year).trim() : "2026";
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findYearSheet(ss, year);
  if (!sheet) throw new Error("Sheet untuk tahun " + year + " tidak ditemukan.");
  return sheet;
}

// ==========================================================================
// 5. FORMATTING & RESET DATA TAHUN
// ==========================================================================

function clearActualsForNewYear(sheet) {
  var data = sheet.getDataRange().getValues();

  for (var i = 16; i < data.length; i++) {
    var row = data[i];
    var status = row[12];

    if (String(status).trim().toLowerCase() === "actual") {
      var rowNum = i + 1;
      var range = sheet.getRange(rowNum, 14, 1, 53);
      range.clearContent();
      range.setBackground("#ffffff");
      var total = sheet.getRange(rowNum, 9);
      if (!total.getFormula()) total.setValue(0);
    }
  }
}

function formatWeekCellColors(sheet, rowNum, weeksObj, isActual) {
  var rowColors = [];
  for (var w = 1; w <= 53; w++) {
    var val = weeksObj[w];
    if (val !== undefined && val !== "" && Number(val) > 0) {
      rowColors.push(isActual ? "#c6efce" : "#fff2cc");
    } else {
      rowColors.push("#ffffff");
    }
  }
  sheet.getRange(rowNum, 14, 1, 53).setBackgrounds([rowColors]);
}

function updateSheetHeadersForYear(sheet, year) {
  var yearNum = parseInt(year, 10);
  if (isNaN(yearNum)) return;

  var current = new Date(yearNum, 0, 1);
  var firstDay = current.getDay();
  var daysToFirstSunday = firstDay === 0 ? 0 : (7 - firstDay);
  var week1EndDate = new Date(yearNum, 0, 1 + daysToFirstSunday);

  var cellN14 = sheet.getRange(14, 14);
  cellN14.setValue(week1EndDate);
  cellN14.setNumberFormat("dd/mm");

  var monthStartCols = {
    "Januari": 14, "Februari": 19, "Maret": 23, "April": 27,
    "Mei": 31, "Juni": 36, "Juli": 40, "Agustus": 44,
    "September": 49, "Oktober": 53, "November": 57, "Desember": 61
  };

  for (var monthName in monthStartCols) {
    var colNum = monthStartCols[monthName];
    sheet.getRange(13, colNum).setValue(monthName + " " + year);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 17) {
    sheet
      .getRange(17, 14, lastRow - 16, 53)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  }
}

function padZero(num) {
  return num < 10 ? "0" + num : String(num);
}

function getMonthNameIndonesian(mIdx) {
  var months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return months[mIdx];
}

function extractLinkFromBulk(richTextValues, formulas, data, rIdx, cIdx) {
  try {
    var richText = richTextValues[rIdx][cIdx];
    if (richText) {
      var url = richText.getLinkUrl();
      if (url) return url;
    }

    var formula = formulas[rIdx][cIdx];
    if (formula) {
      var match =
        formula.match(/=HYPERLINK\("([^"]+)"/i) ||
        formula.match(/=HYPERLINK\('([^']+)'/i);
      if (match && match[1]) return match[1];
    }
  } catch (e) {
    console.log("Tidak dapat membaca hyperlink: " + e.toString());
  }

  return data[rIdx][cIdx] ? data[rIdx][cIdx].toString().trim() : "";
}

function getMonthsFromWeeks(weeks) {
  var monthsMap = {
    "Jan": [1, 2, 3, 4, 5], "Feb": [6, 7, 8, 9], "Mar": [10, 11, 12, 13], "Apr": [14, 15, 16, 17],
    "Mei": [18, 19, 20, 21, 22], "Jun": [23, 24, 25, 26], "Jul": [27, 28, 29, 30], "Agu": [31, 32, 33, 34, 35],
    "Sep": [36, 37, 38, 39], "Okt": [40, 41, 42, 43], "Nov": [44, 45, 46, 47], "Des": [48, 49, 50, 51, 52, 53]
  };

  var selectedMonths = [];
  for (var month in monthsMap) {
    var monthWeeks = monthsMap[month];
    for (var w in weeks) {
      if (monthWeeks.indexOf(Number(w)) !== -1) {
        if (selectedMonths.indexOf(month) === -1) {
          selectedMonths.push(month);
        }
      }
    }
  }
  return selectedMonths;
}

function formatMatlevKamValue(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return (val.getMonth() + 1) + "." + val.getDate();
  }
  return val.toString().trim();
}

function formatSheetWeekCells(sheet, rowNum) {
  sheet
    .getRange(rowNum, 14, 1, 53)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
}

function getCurrentWeekNumber() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  var diff = now - start;
  var oneDay = 1000 * 60 * 60 * 24;
  var dayOfYear = Math.floor(diff / oneDay);
  var week = Math.ceil((dayOfYear + start.getDay() + 1) / 7);

  if (week < 1) return 1;
  if (week > 53) return 53;
  return week;
}

// ==========================================================================
// 6. ROUTER GET & POST
// ==========================================================================

function doGet(e) {
  try {
    var action = e.parameter.action;
    var year = e.parameter.year || "2026";

    if (action === "read") {
      return readData(year);
    }

    if (action === "list_years") {
      return listYears();
    }

    if (action === "get_settings") {
      return jsonResponse({
        status: "success",
        phone: getTargetPhone(),
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID
      });
    }

    return jsonResponse({
      status: "error",
      message: "Permintaan GET tidak valid"
    });

  } catch (err) {
    return jsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        status: "error",
        message: "Payload kosong"
      });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var year = payload.year || "2026";

    if (action === "login") {
      return handleLogin(payload);
    }

    if (action === "send_wa") {
      return sendWhatsAppMessage(payload.phone || getTargetPhone(), payload.message);
    }

    if (action === "save_settings") {
      var phoneValue = payload.phone !== undefined ? String(payload.phone).trim() : "";
      PropertiesService.getScriptProperties().setProperty("TARGET_PHONE", phoneValue);
      return jsonResponse({
        status: "success",
        message: "Pengaturan sistem berhasil disimpan!",
        phone: getTargetPhone()
      });
    }

    if (action === "add") {
      return addData(payload, year);
    }

    if (action === "edit") {
      return editData(payload, year);
    }

    if (action === "delete") {
      return deleteData(payload, year);
    }

    if (action === "create_year") {
      return createYearSheet(payload.year, payload.sourceYear || "2026");
    }

    if (action === "delete_year") {
      return deleteYearSheet(payload.year);
    }

    return jsonResponse({
      status: "error",
      message: "Permintaan POST tidak valid"
    });

  } catch (err) {
    console.error(err);
    return jsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

// ==========================================================================
// 7. PENGELOLAAN TAHUN BARU
// ==========================================================================

function createYearSheet(year, sourceYear) {
  year = String(year || "").trim();
  sourceYear = String(sourceYear || "2026").trim();
  if (!/^\d{4}$/.test(year) || Number(year) < 2000 || Number(year) > 2100) {
    return jsonResponse({ status: "error", message: "Tahun harus 4 digit dalam rentang 2000 sampai 2100." });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonResponse({ status: "error", message: "Pengelolaan tahun sedang diproses. Silakan coba lagi." });
  }

  var ss;
  var newSheet = null;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var existing = findYearSheet(ss, year);
    if (existing) {
      return jsonResponse({
        status: "success", created: false, year: year,
        sheetName: existing.getName(), sheetId: existing.getSheetId(),
        years: getAvailableYears(ss),
        message: "Tab tahun " + year + " sudah tersedia. Data yang ada tidak diubah."
      });
    }

    var sourceSheet = findYearSheet(ss, sourceYear);
    if (!sourceSheet) throw new Error("Sheet sumber tahun " + sourceYear + " tidak ditemukan.");

    newSheet = sourceSheet.copyTo(ss);
    clearActualsForNewYear(newSheet);
    updateSheetHeadersForYear(newSheet, year);
    newSheet.setName("Proker KAM " + year);
    SpreadsheetApp.flush();

    return jsonResponse({
      status: "success", created: true, year: year, sourceYear: sourceYear,
      sheetName: newSheet.getName(), sheetId: newSheet.getSheetId(),
      years: getAvailableYears(ss),
      message: "Rencana tahun " + year + " berhasil dibuat dari tahun " + sourceYear + "."
    });
  } catch (err) {
    var cleanupMessage = "";
    if (newSheet) {
      try {
        ss.deleteSheet(newSheet);
        SpreadsheetApp.flush();
      } catch (cleanupError) {
        cleanupMessage = " Salinan belum selesai; periksa tab " + newSheet.getName() + " di Spreadsheet.";
      }
    }
    return jsonResponse({ status: "error", message: "Gagal membuat tahun " + year + ": " + err.toString() + cleanupMessage });
  } finally {
    lock.releaseLock();
  }
}

function deleteYearSheet(year) {
  year = String(year || "").trim();

  if (year === "2026") {
    return jsonResponse({
      status: "error",
      message: "Tab tahun default 2026 tidak boleh dihapus!"
    });
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name.indexOf(year) !== -1) {
      ss.deleteSheet(sheets[i]);
      return jsonResponse({
        status: "success",
        message: "Tab sheet tahun " + year + " berhasil dihapus!"
      });
    }
  }

  return jsonResponse({
    status: "error",
    message: "Tab sheet tahun tidak ditemukan"
  });
}

// ==========================================================================
// 8. AUTENTIKASI & OTORISASI (SALTED SHA-256)
// ==========================================================================

function computeSaltedSHA256(text) {
  var saltedInput = text + AUTH_SALT;
  var rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    saltedInput,
    Utilities.Charset.UTF_8
  );

  var hashHex = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hashHex += byteHex;
  }
  return hashHex;
}

function handleLogin(payload) {
  var email = payload.email ? payload.email.trim().toLowerCase() : "";
  var password = payload.password ? payload.password.trim() : "";

  if (payload.role === "guest" || email === "tamu@pln.co.id" || payload.isGuest) {
    return jsonResponse({
      status: "success",
      role: "guest",
      name: "Tamu Peninjau",
      token: Utilities.getUuid() + "-guest",
      message: "Login berhasil sebagai Tamu"
    });
  }

  var cache = CacheService.getScriptCache();
  var attemptKey = "login_attempt_" + email;
  var failedAttempts = Number(cache.get(attemptKey) || 0);

  if (failedAttempts >= 3) {
    return jsonResponse({
      status: "error",
      message: "Akun terkunci sementara demi keamanan karena 3x kesalahan sandi. Silakan tunggu 6 jam."
    });
  }

  var inputHash = computeSaltedSHA256(password);
  var adminHash = computeSaltedSHA256("MASUKAN_KATA_SANDI_ADMIN_UNIK_DI_SINI");

  if (email === "MASUKAN_EMAIL_ADMIN_UNIK_DI_SINI") {
    if (inputHash === adminHash) {
      cache.remove(attemptKey);
      var sessionToken = Utilities.getUuid() + "-" + computeSaltedSHA256(email + new Date().getTime());
      return jsonResponse({
        status: "success",
        role: "admin",
        name: "Administrator UPT",
        token: sessionToken,
        message: "Login berhasil"
      });
    } else {
      cache.put(attemptKey, String(failedAttempts + 1), 21600);
      return jsonResponse({
        status: "error",
        message: "Kata sandi salah! Percobaan gagal: " + (failedAttempts + 1) + " dari 3."
      });
    }
  }

  return jsonResponse({
    status: "error",
    message: "Email tidak terdaftar dalam sistem pemantauan K3 & KAM!"
  });
}

// ==========================================================================
// 9. WHATSAPP GATEWAY (FONNTE API)
// ==========================================================================

function sendWhatsAppMessage(phone, message) {
  var targetNumber = (phone || getTargetPhone() || "").trim();

  if (!targetNumber) {
    console.log("Nomor WhatsApp kosong. Pengiriman pesan dibatalkan.");
    return jsonResponse({
      status: "error",
      message: "Nomor WhatsApp kosong. Pesan tidak terkirim."
    });
  }

  if (!FONNTE_TOKEN || FONNTE_TOKEN === "MASUKKAN_TOKEN_FONNTE_BARU_DI_SINI") {
    return jsonResponse({
      status: "error",
      message: "Token Fonnte belum dikonfigurasi."
    });
  }

  var url = "https://api.fonnte.com/send";
  var options = {
    method: "post",
    headers: {
      Authorization: FONNTE_TOKEN
    },
    payload: {
      target: targetNumber,
      message: message
    },
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var resText = response.getContentText();
    return jsonResponse({
      status: "success",
      response: resText
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

// ==========================================================================
// 10. OPERASI DATA PROKER
// ==========================================================================

function readData(year) {
  try {
    var sheet = getSheet(year);
    var data = sheet.getDataRange().getValues();

    if (data.length <= 16) {
      return jsonResponse({
        year: String(year),
        sheetId: sheet.getSheetId(),
        status: "success",
        data: []
      });
    }

    var richTextValues = sheet.getRange(1, 1, data.length, data[0].length).getRichTextValues();
    var formulas = sheet.getRange(1, 1, data.length, data[0].length).getFormulas();

    var jsonArray = [];
    var currentCategory = "";
    var currentCategoryNum = "";

    for (var i = 16; i < data.length; i++) {
      var rowPlan = data[i];

      if (!rowPlan[5]) continue;

      if (!rowPlan[3] && !rowPlan[6]) {
        var rawCategory = rowPlan[5].toString().trim();
        var cleanKey = rawCategory.replace(/^\d+\.\s*/, "").toUpperCase().trim();
        currentCategory = CATEGORY_MAP[cleanKey] || rawCategory;
        currentCategoryNum = currentCategory;
        continue;
      }

      var rowActual = data[i + 1] || [];
      var targetPlan = Number(rowPlan[8] || 0);
      var actualTotal = Number(rowActual[8] || 0);

      var weeks = {};
      var actualWeeks = {};

      for (var w = 1; w <= 53; w++) {
        var colIdx = 13 + (w - 1);
        var planVal = rowPlan[colIdx];
        if (planVal !== "" && !isNaN(planVal) && Number(planVal) > 0) {
          weeks[w] = Number(planVal);
        }

        var actualVal = rowActual[colIdx];
        if (actualVal !== "" && !isNaN(actualVal) && Number(actualVal) > 0) {
          actualWeeks[w] = Number(actualVal);
        }
      }

      var status = "Belum Mulai";
      if (actualTotal >= targetPlan && targetPlan > 0) {
        status = "Selesai";
      } else if (actualTotal > 0) {
        status = "Dalam Proses";
      }

      var folderUrl = extractLinkFromBulk(richTextValues, formulas, data, i, 10);
      var linkUrl = extractLinkFromBulk(richTextValues, formulas, data, i, 11);

      var obj = {
        id: rowPlan[70] ? Number(rowPlan[70]) : (i + 1),
        iso45001: rowPlan[1] || "",
        pp50: rowPlan[2] || "",
        matlevKam: formatMatlevKamValue(rowPlan[3]),
        no: formatMatlevKamValue(rowPlan[3]),
        subNo: String(rowPlan[4] || ""),
        title: rowPlan[5] || "",
        category: currentCategory,
        categoryNum: currentCategoryNum,
        pic: rowPlan[6] || "",
        biaya: rowPlan[7] || "-",
        target: targetPlan,
        actual: actualTotal,
        status: status,
        prosedur: rowPlan[9] || "-",
        folder: folderUrl || "-",
        link: linkUrl || "",
        months: getMonthsFromWeeks(weeks),
        weeks: weeks,
        actualWeeks: actualWeeks
      };

      jsonArray.push(obj);
      i++;
    }

    return jsonResponse({
      year: String(year),
      sheetId: sheet.getSheetId(),
      status: "success",
      data: jsonArray
    });

  } catch (err) {
    return jsonResponse({
      status: "error",
      message: err.toString(),
      data: []
    });
  }
}

function addData(payload, year) {
  var sheet = getSheet(year);
  var nextRow = sheet.getLastRow() + 1;

  var formulaTarget = "=SUM(N" + nextRow + ":BP" + nextRow + ")";
  var formulaProgress = "=SUM(N" + (nextRow + 1) + ":BP" + (nextRow + 1) + ")";

  var rowPlan = [
    "",
    payload.iso45001 || "",
    payload.pp50 || "",
    payload.no || payload.matlevKam || "",
    payload.subNo || "",
    payload.title || "",
    payload.pic || "",
    payload.biaya || "-",
    formulaTarget,
    payload.prosedur || "-",
    payload.folder || "-",
    payload.link || "",
    "Plan"
  ];

  var rowActual = [
    "", "", "", "", "", "", "", "",
    formulaProgress,
    "", "", "", "Actual"
  ];

  for (var w = 1; w <= 53; w++) {
    rowPlan.push(payload.weeks && payload.weeks[w] ? Number(payload.weeks[w]) : "");
    rowActual.push(payload.actualWeeks && payload.actualWeeks[w] ? Number(payload.actualWeeks[w]) : "");
  }

  while (rowPlan.length < 70) { rowPlan.push(""); }
  rowPlan.push(payload.id);

  while (rowActual.length < 70) { rowActual.push(""); }
  rowActual.push(payload.id);

  sheet.appendRow(rowPlan);
  sheet.appendRow(rowActual);

  sheet.getRange(nextRow, 14, 2, 53).setHorizontalAlignment("center").setVerticalAlignment("middle");
  formatWeekCellColors(sheet, nextRow, payload.weeks || {}, false);
  formatWeekCellColors(sheet, nextRow + 1, payload.actualWeeks || {}, true);

  SpreadsheetApp.flush();

  return jsonResponse({
    status: "success",
    message: "Kegiatan berhasil ditambahkan",
    id: payload.id
  });
}

function editData(payload, year) {
  var sheet = getSheet(year);
  var data = sheet.getDataRange().getValues();
  var targetId = Number(payload.id);

  if (!targetId) {
    return jsonResponse({
      status: "error",
      message: "ID kegiatan tidak valid"
    });
  }

  for (var i = 16; i < data.length; i++) {
    var rowPlan = data[i];
    var rowId = Number(rowPlan[70]);

    if (rowId === targetId) {
      var rowNum = i + 1;

      var formulaPlanI = sheet.getRange(rowNum, 9).getFormula();
      var formulaActualI = sheet.getRange(rowNum + 1, 9).getFormula();

      var defaultFormulaPlan = "=SUM(N" + rowNum + ":BP" + rowNum + ")";
      var defaultFormulaActual = "=SUM(N" + (rowNum + 1) + ":BP" + (rowNum + 1) + ")";

      var newRowPlan = [
        "",
        payload.iso45001 || "",
        payload.pp50 || "",
        payload.no || payload.matlevKam || "",
        payload.subNo || "",
        payload.title || "",
        payload.pic || "",
        payload.biaya || "-",
        formulaPlanI || defaultFormulaPlan,
        payload.prosedur || "-",
        payload.folder || "-",
        payload.link || "",
        "Plan"
      ];

      for (var w = 1; w <= 53; w++) {
        newRowPlan.push(payload.weeks && payload.weeks[w] ? Number(payload.weeks[w]) : "");
      }
      while (newRowPlan.length < 70) { newRowPlan.push(""); }
      newRowPlan.push(payload.id);

      var newRowActual = [
        "", "", "", "", "", "", "", "",
        formulaActualI || defaultFormulaActual,
        "", "", "", "Actual"
      ];

      for (var aw = 1; aw <= 53; aw++) {
        newRowActual.push(payload.actualWeeks && payload.actualWeeks[aw] ? Number(payload.actualWeeks[aw]) : "");
      }
      while (newRowActual.length < 70) { newRowActual.push(""); }
      newRowActual.push(payload.id);

      sheet.getRange(rowNum, 1, 1, 71).setValues([newRowPlan]);
      sheet.getRange(rowNum + 1, 1, 1, 71).setValues([newRowActual]);

      sheet.getRange(rowNum, 14, 2, 53).setHorizontalAlignment("center").setVerticalAlignment("middle");
      formatWeekCellColors(sheet, rowNum, payload.weeks || {}, false);
      formatWeekCellColors(sheet, rowNum + 1, payload.actualWeeks || {}, true);

      SpreadsheetApp.flush();

      return jsonResponse({
        status: "success",
        message: "Kegiatan berhasil diperbarui"
      });
    }
  }

  return jsonResponse({
    status: "error",
    message: "ID kegiatan tidak ditemukan"
  });
}

function deleteData(payload, year) {
  var sheet = getSheet(year);
  var data = sheet.getDataRange().getValues();
  var targetId = Number(payload.id);

  if (!targetId) {
    return jsonResponse({
      status: "error",
      message: "ID kegiatan tidak valid"
    });
  }

  for (var i = 16; i < data.length; i++) {
    var rowId = Number(data[i][70]);

    if (rowId === targetId) {
      sheet.deleteRows(i + 1, 2);
      SpreadsheetApp.flush();

      return jsonResponse({
        status: "success",
        message: "Kegiatan berhasil dihapus"
      });
    }
  }

  return jsonResponse({
    status: "error",
    message: "Kegiatan tidak ditemukan untuk dihapus"
  });
}

// ==========================================================================
// 11. LOGIKA KONTEN PENGINGAT
// ==========================================================================

function sendWeeklyK3LAutoReminders() {
  var targetPhone = getTargetPhone();
  if (!targetPhone) {
    console.log("Nomor WhatsApp kosong. Pengingat mingguan dilewati.");
    return;
  }

  var yearActive = new Date().getFullYear().toString();
  var sheet = getSheet(yearActive);
  var data = sheet.getDataRange().getValues();
  var currentWeek = getCurrentWeekNumber();
  var plansList = [];

  for (var i = 16; i < data.length; i++) {
    var rowPlan = data[i];
    if (!rowPlan[5]) continue;
    if (!rowPlan[3] && !rowPlan[6]) continue;

    var rowActual = data[i + 1] || [];
    var colIdx = 13 + (currentWeek - 1);

    var planValueThisWeek = Number(rowPlan[colIdx] || 0);
    var actualValueThisWeek = Number(rowActual[colIdx] || 0);

    if (planValueThisWeek > 0 && actualValueThisWeek < planValueThisWeek) {
      plansList.push(
        "- *" + rowPlan[5] + "* (MATLEV KAM: " +
        formatMatlevKamValue(rowPlan[3]) + " " + (rowPlan[4] || "") + ")" +
        " - Target: " + planValueThisWeek + ", Aktual: " + actualValueThisWeek
      );
    }

    i++;
  }

  if (plansList.length > 0) {
    var message =
      "Halo Rekan K3L,\n\n" +
      "*PENGINGAT PROGRAM K3L MINGGU INI (M-" + currentWeek + ")*\n\n" +
      "Berikut kegiatan yang masih memiliki target pada minggu ini:\n\n" +
      plansList.join("\n") +
      "\n\nJika kegiatan telah dilaksanakan, silakan memperbarui realisasi melalui sistem:\n" +
      FRONTEND_URL +
      "\n\nTerima kasih,\nSistem Monitoring K3L PLN";

    sendWhatsAppMessage(targetPhone, message);
  }
}

function sendFridayK3LAutoReminders() {
  var targetPhone = getTargetPhone();
  if (!targetPhone) {
    console.log("Nomor WhatsApp kosong. Pengingat Jumat sore dilewati.");
    return;
  }

  var message =
    "Halo Rekan K3L,\n\n" +
    "*PENGINGAT HARI JUMAT SORE*\n\n" +
    "Apakah pada minggu ini Anda telah melaksanakan Program Kerja K3L (Proker KAM)?\n\n" +
    "Jika sudah, silakan memperbarui realisasi melalui Formulir Pemantauan:\n" +
    FRONTEND_URL +
    "\n\nTerima kasih,\nSistem Monitoring K3L PLN";

  sendWhatsAppMessage(targetPhone, message);
}

function sendMonthlyK3LAutoReminders() {
  var targetPhone = getTargetPhone();
  if (!targetPhone) {
    console.log("Nomor WhatsApp kosong. Pengingat awal bulan dilewati.");
    return;
  }

  var now = new Date();
  var yearActive = now.getFullYear().toString();
  var sheet = getSheet(yearActive);
  var data = sheet.getDataRange().getValues();

  var monthsShort = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  var currentMonthShort = monthsShort[now.getMonth()];
  var currentMonthLong = getMonthNameIndonesian(now.getMonth());

  var monthMap = {
    "Jan": [1, 2, 3, 4, 5], "Feb": [6, 7, 8, 9], "Mar": [10, 11, 12, 13], "Apr": [14, 15, 16, 17],
    "Mei": [18, 19, 20, 21, 22], "Jun": [23, 24, 25, 26], "Jul": [27, 28, 29, 30], "Agu": [31, 32, 33, 34, 35],
    "Sep": [36, 37, 38, 39], "Okt": [40, 41, 42, 43], "Nov": [44, 45, 46, 47], "Des": [48, 49, 50, 51, 52, 53]
  };

  var monthWeeks = monthMap[currentMonthShort] || [];
  var monthlyPlans = [];

  for (var i = 16; i < data.length; i++) {
    var rowPlan = data[i];
    if (!rowPlan[5]) continue;
    if (!rowPlan[3] && !rowPlan[6]) continue;

    var planWeeksThisMonth = [];
    for (var k = 0; k < monthWeeks.length; k++) {
      var weekNum = monthWeeks[k];
      var colIdx = 13 + (weekNum - 1);
      var planVal = Number(rowPlan[colIdx] || 0);

      if (planVal > 0) {
        planWeeksThisMonth.push("M-" + weekNum);
      }
    }

    if (planWeeksThisMonth.length > 0) {
      monthlyPlans.push("- *" + rowPlan[5] + "* (" + planWeeksThisMonth.join(", ") + ")");
    }

    i++;
  }

  var message =
    "Halo Rekan K3L,\n\n" +
    "*DAFTAR RENCANA PROGRAM K3L BULAN " + currentMonthLong.toUpperCase() + " " + yearActive + "*\n\n" +
    (monthlyPlans.length > 0 ? monthlyPlans.join("\n") : "Tidak ada rencana kegiatan untuk bulan ini.") +
    "\n\nTautan Sistem:\n" +
    FRONTEND_URL +
    "\n\nTerima kasih,\nSistem Monitoring K3L PLN";

  sendWhatsAppMessage(targetPhone, message);
}

function sendEndOfMonthK3LAutoReminders() {
  var targetPhone = getTargetPhone();
  if (!targetPhone) {
    console.log("Nomor WhatsApp kosong. Pengingat akhir bulan dilewati.");
    return;
  }

  var now = new Date();
  var yearActive = now.getFullYear().toString();
  var sheet = getSheet(yearActive);
  var data = sheet.getDataRange().getValues();

  var monthsShort = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  var currentMonthShort = monthsShort[now.getMonth()];
  var currentMonthLong = getMonthNameIndonesian(now.getMonth());

  var monthMap = {
    "Jan": [1, 2, 3, 4, 5], "Feb": [6, 7, 8, 9], "Mar": [10, 11, 12, 13], "Apr": [14, 15, 16, 17],
    "Mei": [18, 19, 20, 21, 22], "Jun": [23, 24, 25, 26], "Jul": [27, 28, 29, 30], "Agu": [31, 32, 33, 34, 35],
    "Sep": [36, 37, 38, 39], "Okt": [40, 41, 42, 43], "Nov": [44, 45, 46, 47], "Des": [48, 49, 50, 51, 52, 53]
  };

  var monthWeeks = monthMap[currentMonthShort] || [];
  var pendingMonthPlans = [];

  for (var i = 16; i < data.length; i++) {
    var rowPlan = data[i];
    if (!rowPlan[5]) continue;
    if (!rowPlan[3] && !rowPlan[6]) continue;

    var rowActual = data[i + 1] || [];
    var planMonthSum = 0;
    var actualMonthSum = 0;

    for (var k = 0; k < monthWeeks.length; k++) {
      var weekNum = monthWeeks[k];
      var colIdx = 13 + (weekNum - 1);
      var pVal = rowPlan[colIdx];
      if (pVal !== "" && !isNaN(pVal)) planMonthSum += Number(pVal);

      var aVal = rowActual[colIdx];
      if (aVal !== "" && !isNaN(aVal)) actualMonthSum += Number(aVal);
    }

    if (planMonthSum > 0 && actualMonthSum < planMonthSum) {
      var matlev = formatMatlevKamValue(rowPlan[3]);
      var sub = rowPlan[4] ? " " + rowPlan[4] : "";
      pendingMonthPlans.push(
        "- *" + rowPlan[5] + "* (MATLEV KAM: " + matlev + sub + ")" +
        " [Target: " + planMonthSum + ", Realisasi: " + actualMonthSum + "]"
      );
    }

    i++;
  }

  if (pendingMonthPlans.length > 0) {
    var message =
      "Halo Rekan K3L,\n\n" +
      "*EVALUASI AKHIR BULAN PROGRAM KERJA (" + currentMonthLong.toUpperCase() + " " + yearActive + ")*\n\n" +
      "Berikut daftar agenda kegiatan bulan ini yang *belum selesai* atau *belum terisi realisasinya*:\n\n" +
      pendingMonthPlans.join("\n") +
      "\n\nApakah kegiatan di atas sudah terlaksana?\n" +
      "Jika sudah, silakan segera memperbarui realisasinya melalui sistem:\n" +
      FRONTEND_URL +
      "\n\nTerima kasih atas kerja samanya.\nSalam,\nBagian K3 & KAM PLN UPT Tanjung Karang";

    sendWhatsAppMessage(targetPhone, message);
  }
}

// ==========================================================================
// 12. PENJADWAL PRESISI MENIT :00
// ==========================================================================

function pasangSemuaTriggerOtomatis() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  susunJadwalK3LHarian();

  ScriptApp.newTrigger("susunJadwalK3LHarian")
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .inTimezone("Asia/Jakarta")
    .create();

  Logger.log("Seluruh pemicu otomatis berhasil dipasang.");
}

function susunJadwalK3LHarian() {
  var sekarang = new Date();
  var hariIni = sekarang.getDay();
  var tglHariIni = sekarang.getDate();

  hapusTriggerByName("eksekusiPengingatSenin");
  hapusTriggerByName("eksekusiPengingatJumat");
  hapusTriggerByName("eksekusiPengingatAwalBulan");
  hapusTriggerByName("eksekusiPengingatAkhirBulan");

  if (hariIni === 1) {
    pasangWaktuPresisi("eksekusiPengingatSenin", 10, 0);
  }

  if (hariIni === 5) {
    pasangWaktuPresisi("eksekusiPengingatJumat", 16, 0);
  }

  if (tglHariIni === 1) {
    pasangWaktuPresisi("eksekusiPengingatAwalBulan", 10, 0);
  }

  var besok = new Date(sekarang.getFullYear(), sekarang.getMonth(), tglHariIni + 1);
  if (besok.getDate() === 1) {
    pasangWaktuPresisi("eksekusiPengingatAkhirBulan", 10, 0);
  }
}

function pasangWaktuPresisi(namaFungsi, jam, menit) {
  hapusTriggerByName(namaFungsi);

  var target = new Date();
  target.setHours(jam, menit, 0, 0);

  if (target > new Date()) {
    ScriptApp.newTrigger(namaFungsi)
      .timeBased()
      .at(target)
      .inTimezone("Asia/Jakarta")
      .create();
    console.log("Jadwal presisi [" + namaFungsi + "] disetel untuk jam " + jam + ":" + (menit < 10 ? "0" + menit : menit));
  }
}

function eksekusiPengingatSenin() {
  sendWeeklyK3LAutoReminders();
  hapusTriggerByName("eksekusiPengingatSenin");
}

function eksekusiPengingatJumat() {
  sendFridayK3LAutoReminders();
  hapusTriggerByName("eksekusiPengingatJumat");
}

function eksekusiPengingatAwalBulan() {
  sendMonthlyK3LAutoReminders();
  hapusTriggerByName("eksekusiPengingatAwalBulan");
}

function eksekusiPengingatAkhirBulan() {
  sendEndOfMonthK3LAutoReminders();
  hapusTriggerByName("eksekusiPengingatAkhirBulan");
}

function hapusTriggerByName(namaFungsi) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === namaFungsi) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}