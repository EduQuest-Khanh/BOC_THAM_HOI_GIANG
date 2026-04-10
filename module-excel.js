// File: module-excel.js (root)
// Vai trò:
// 1) Đọc Excel đầu bài (module bốc bài) -> đổ vào state.lesson.loadedLessons
// 2) Xuất biên bản Excel (.xlsx) cho cả 2 module (date/lesson)
//
// FIX LỖI "Thiếu thư viện Excel (XLSX)":
// - Tự động nạp XLSX từ nhiều CDN dự phòng (jsDelivr, unpkg)
// - Nếu vẫn không nạp được, báo hướng dẫn dùng file XLSX local trong thư mục gốc
//
// Phụ thuộc:
// - window.state, window.FULL_TITLE, window.sortDateResults, window.sortLessonResults, window.escapeHtml
// - Thư viện XLSX (sẽ được auto-load nếu chưa có)

(function () {
  "use strict";

  /* =========================
     0) XLSX LOADER (FALLBACK)
     ========================= */

  // Ưu tiên xlsx-js-style (hỗ trợ style). Nếu không tải được, fallback sang xlsx thường.
  const XLSX_CDN_LIST = [
    // xlsx-js-style (ưu tiên)
    "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.full.min.js",
    "https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.full.min.js",
    // xlsx thường (fallback)
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
  ];

  let _xlsxLoadPromise = null;

  function loadScriptWithTimeout(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).some((s) => s.src === url);
      if (existing) {
        // đã có script tag url này, chờ một nhịp để window.XLSX xuất hiện
        setTimeout(() => resolve(true), 0);
        return;
      }

      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.referrerPolicy = "no-referrer";

      const timer = setTimeout(() => {
        s.remove();
        reject(new Error("timeout"));
      }, timeoutMs);

      s.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      s.onerror = () => {
        clearTimeout(timer);
        s.remove();
        reject(new Error("load_error"));
      };

      document.head.appendChild(s);
    });
  }

  async function ensureXLSX() {
    if (window.XLSX && window.XLSX.utils) return true;

    if (_xlsxLoadPromise) return _xlsxLoadPromise;

    _xlsxLoadPromise = (async () => {
      for (const url of XLSX_CDN_LIST) {
        try {
          await loadScriptWithTimeout(url);
          if (window.XLSX && window.XLSX.utils) return true;
        } catch (e) {
          // thử url tiếp theo
        }
      }
      return false;
    })();

    return _xlsxLoadPromise;
  }

  function xlsxMissingHelpText() {
    return (
      "Không tải được thư viện Excel (XLSX).\n\n" +
      "Nguyên nhân thường gặp:\n" +
      "• Mạng đang chặn CDN (jsdelivr/unpkg)\n" +
      "• Máy không có internet / DNS lỗi\n\n" +
      "Cách khắc phục chắc chắn nhất (khuyên dùng):\n" +
      "1) Tải file thư viện về máy (xlsx.full.min.js)\n" +
      "2) Đặt vào CÙNG THƯ MỤC với index.html (thư mục gốc repo)\n" +
      "3) Trong index.html, thêm dòng:\n" +
      '   <script src="./xlsx.full.min.js"></script>\n' +
      "   và/hoặc dùng xlsx-js-style bản local nếu muốn style.\n\n" +
      "Sau đó load lại trang và thử lại."
    );
  }

  /* =========================
     1) LOAD EXCEL (LESSON INPUT)
     ========================= */

  async function loadLessonExcel(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const ok = await ensureXLSX();
    if (!ok) {
      alert("Thiếu thư viện Excel (XLSX). Vui lòng kiểm tra kết nối internet.\n\n" + xlsxMissingHelpText());
      return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = e.target.result; // ArrayBuffer
        const workbook = window.XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames?.[0];
        if (!firstSheetName) throw new Error("Không tìm thấy sheet trong file Excel.");

        const sheet = workbook.Sheets[firstSheetName];
        const lessons = parseLessonSheet(sheet);

        const selectCount = window.state?.lesson?.selectCount ?? 3;
        if (lessons.length < selectCount) {
          alert(`File Excel cần có ít nhất ${selectCount} dòng đầu bài hợp lệ.`);
          resetLessonFileUI();
          return;
        }

        // set state
        window.state.lesson.loadedLessons = lessons;
        window.state.lesson.sourceFileName = file.name;
        window.state.lesson.count = lessons.length;

        // update UI if exists
        setTextIfExists("lessonLoadedCount", String(lessons.length));
        setHTMLIfExists("lessonFileName", `<i class="fas fa-file-excel"></i> ${escape(file.name)}`);
        showIfExists("lessonFileNameWrap", true);
        showIfExists("lessonLoadedInfo", true);
        setHTMLIfExists(
          "lessonSetupTitle",
          `<i class="fas fa-tasks mr-3 text-blue-500"></i> Thiết lập ${lessons.length} đầu bài giảng`
        );
      } catch (err) {
        console.error(err);
        alert("Có lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng .xlsx/.xls.");
        resetLessonFileUI();
      }
    };

    reader.onerror = function () {
      alert("Có lỗi khi đọc file Excel. Vui lòng thử lại.");
      resetLessonFileUI();
    };

    reader.readAsArrayBuffer(file);
  }

  // Đọc sheet -> array lesson objects
  function parseLessonSheet(sheet) {
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // tìm hàng header đầu tiên có >=3 ô có nội dung
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = (rows[i] || [])
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0);
      if (r.length >= 3) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) return [];

    const header = (rows[headerRowIndex] || [])
      .map((x) => String(x ?? "").trim().toLowerCase());

    const colA = findColIndex(header, [
      "tiết trong buổi",
      "tiet trong buoi",
      "tiết theo tkb",
      "tiet theo tkb",
      "tiet tkb",
      "tiết tkb",
    ]);
    const colB = findColIndex(header, ["tiết theo khgd", "tiet theo khgd", "khgd"]);
    const colC = findColIndex(header, [
      "tên bài dạy",
      "ten bai day",
      "tên bài",
      "ten bai",
      "bài dạy",
      "bai day",
      "tên bài dạy",
    ]);
    const colD = findColIndex(header, ["lớp dạy", "lop day", "lớp", "lop", "lớp dạy"]);

    // fallback A-D
    const A = colA !== -1 ? colA : 0;
    const B = colB !== -1 ? colB : 1;
    const C = colC !== -1 ? colC : 2;
    const D = colD !== -1 ? colD : 3;

    const lessons = [];
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] || [];

      const periodInSessionRaw = String(row[A] ?? "").trim();
      const periodKHGD = String(row[B] ?? "").trim();
      const title = String(row[C] ?? "").trim();
      const className = String(row[D] ?? "").trim();

      if (!periodInSessionRaw && !periodKHGD && !title && !className) continue;
      if (!title) continue;

      lessons.push({
        periodInSession: normalizePeriodInSession(periodInSessionRaw),
        periodKHGD: periodKHGD || "Tiết KHGD (chưa rõ)",
        title,
        className: className || "Lớp (chưa rõ)",
      });
    }

    return lessons;
  }

  function findColIndex(headerArr, keywords) {
    for (let i = 0; i < headerArr.length; i++) {
      const h = headerArr[i];
      if (!h) continue;
      if (keywords.some((k) => h.includes(k))) return i;
    }
    return -1;
  }

  function normalizePeriodInSession(value) {
    const t = String(value ?? "").trim();
    const m = t.match(/(\d{1,2})/);
    return m ? m[1] : (t || "?");
  }

  function resetLessonFileUI() {
    if (!window.state?.lesson) return;

    window.state.lesson.loadedLessons = [];
    window.state.lesson.sourceFileName = "";
    window.state.lesson.count = 0;

    const input = document.getElementById("lessonFileInput");
    if (input) input.value = "";

    showIfExists("lessonFileNameWrap", false);
    showIfExists("lessonLoadedInfo", false);
    setTextIfExists("lessonLoadedCount", "0");
    setTextIfExists("lessonFileName", "");
    setHTMLIfExists(
      "lessonSetupTitle",
      `<i class="fas fa-tasks mr-3 text-blue-500"></i> Thiết lập đầu bài giảng`
    );
  }

  /* =========================
     2) EXPORT EXCEL (DATE + LESSON)
     ========================= */

  async function exportExcel(type) {
    const ok = await ensureXLSX();
    if (!ok) {
      alert("Thiếu thư viện Excel (XLSX). Vui lòng kiểm tra kết nối internet.\n\n" + xlsxMissingHelpText());
      return;
    }

    if (!window.state?.[type]) {
      alert("Sai loại module để xuất Excel.");
      return;
    }

    if (!Array.isArray(window.state[type].results) || window.state[type].results.length === 0) {
      alert("Chưa có kết quả để xuất file.");
      return;
    }

    const nowStr = new Date().toLocaleString("vi-VN");
    const safeNow = new Date()
      .toLocaleString("vi-VN")
      .replace(/[\/:\s]/g, "-")
      .replace(/-+/g, "-");

    const wb = window.XLSX.utils.book_new();

    if (type === "date") {
      const ws = buildSheetDate(nowStr);
      window.XLSX.utils.book_append_sheet(wb, ws, "BocNgayGiang");
      window.XLSX.writeFile(wb, `BienBan_BocNgayGiang_${safeNow}.xlsx`);
      return;
    }

    if (type === "lesson") {
      const ws = buildSheetLesson(nowStr);
      window.XLSX.utils.book_append_sheet(wb, ws, "BocBaiGiang");
      window.XLSX.writeFile(wb, `BienBan_BocBaiGiang_${safeNow}.xlsx`);
      return;
    }

    alert("Loại module không hợp lệ.");
  }

  function buildSheetDate(nowStr) {
    const sorted = window.sortDateResults(window.state.date.results);

    const headers = ["STT", "Ô số", "Họ và tên giáo viên", "Đơn vị", "Kết quả (Ngày giảng)"];
    const aoa = [];

    aoa.push([window.FULL_TITLE]);
    aoa.push(["BIÊN BẢN BỐC THĂM NGÀY GIẢNG"]);
    aoa.push([`Thời gian xuất: ${nowStr}`]);
    aoa.push([]);
    aoa.push(headers);

    sorted.forEach((r, idx) => {
      aoa.push([idx + 1, r.box, r.name, r.school, r.val]);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    ];

    ws["!cols"] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 26 },
      { wch: 22 },
      { wch: 30 },
    ];

    ws["!autofilter"] = { ref: "A5:E5" };

    styleRange(ws, 0, 0, 0, 4, styleTitle());
    styleRange(ws, 1, 0, 1, 4, styleSubtitle());
    styleRange(ws, 2, 0, 2, 4, styleMeta());
    styleRange(ws, 4, 0, 4, 4, styleHeader());

    for (let r = 5; r < aoa.length; r++) {
      styleRange(ws, r, 0, r, 4, styleRow(r));
      setCellStyle(ws, r, 0, styleCellCenter());
      setCellStyle(ws, r, 1, styleCellCenter());
      setCellStyle(ws, r, 2, styleCellWrap());
      setCellStyle(ws, r, 3, styleCellWrap());
      setCellStyle(ws, r, 4, styleCellWrap());
    }

    return ws;
  }

  function buildSheetLesson(nowStr) {
    const sorted = window.sortLessonResults(window.state.lesson.results);

    const headers = [
      "STT",
      "Ô số",
      "Tiết trong buổi",
      "Tiết theo KHGD",
      "Lớp dạy",
      "Tên bài dạy",
      "Giáo viên",
      "Đơn vị",
    ];

    const aoa = [];
    aoa.push([window.FULL_TITLE]);
    aoa.push(["BIÊN BẢN BỐC THĂM BÀI GIẢNG"]);
    aoa.push([`Dành cho ngày: ${window.state.lesson.target}`]);
    aoa.push([`Thời gian xuất: ${nowStr}`]);
    aoa.push([]);
    aoa.push(headers);

    sorted.forEach((r, idx) => {
      aoa.push([
        idx + 1,
        r.box,
        r.periodInSession,
        r.periodKHGD,
        r.className,
        r.title,
        r.name,
        r.school,
      ]);
    });

    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    ];

    ws["!cols"] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 45 },
      { wch: 22 },
      { wch: 20 },
    ];

    ws["!autofilter"] = { ref: "A6:H6" };

    styleRange(ws, 0, 0, 0, 7, styleTitle());
    styleRange(ws, 1, 0, 1, 7, styleSubtitle());
    styleRange(ws, 2, 0, 3, 7, styleMeta());
    styleRange(ws, 5, 0, 5, 7, styleHeader());

    for (let r = 6; r < aoa.length; r++) {
      styleRange(ws, r, 0, r, 7, styleRow(r));
      setCellStyle(ws, r, 0, styleCellCenter());
      setCellStyle(ws, r, 1, styleCellCenter());
      setCellStyle(ws, r, 2, styleCellCenter());
      setCellStyle(ws, r, 3, styleCellCenter());
      setCellStyle(ws, r, 4, styleCellCenter());
      setCellStyle(ws, r, 5, styleCellWrap());
      setCellStyle(ws, r, 6, styleCellWrap());
      setCellStyle(ws, r, 7, styleCellWrap());
    }

    return ws;
  }

  /* =========================
     3) STYLE HELPERS (xlsx-js-style compatible)
     ========================= */

  function styleTitle() {
    return {
      font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    };
  }

  function styleSubtitle() {
    return {
      font: { bold: true, sz: 13, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: "FEF08A" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    };
  }

  function styleMeta() {
    return {
      font: { italic: true, sz: 11, color: { rgb: "374151" } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: thinBorder(),
    };
  }

  function styleHeader() {
    return {
      font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "065F46" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: mediumBorder(),
    };
  }

  function styleRow(rIndex) {
    const isAlt = rIndex % 2 === 0;
    return {
      font: { sz: 11, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: isAlt ? "F3F4F6" : "FFFFFF" } },
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: thinBorder(),
    };
  }

  function styleCellCenter() {
    return {
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    };
  }

  function styleCellWrap() {
    return {
      alignment: { horizontal: "left", vertical: "top", wrapText: true },
      border: thinBorder(),
    };
  }

  function thinBorder() {
    return {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    };
  }

  function mediumBorder() {
    return {
      top: { style: "medium", color: { rgb: "111827" } },
      bottom: { style: "medium", color: { rgb: "111827" } },
      left: { style: "medium", color: { rgb: "111827" } },
      right: { style: "medium", color: { rgb: "111827" } },
    };
  }

  function styleRange(ws, r1, c1, r2, c2, style) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        setCellStyle(ws, r, c, style);
      }
    }
  }

  function setCellStyle(ws, r, c, style) {
    const addr = window.XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) return;
    ws[addr].s = mergeStyle(ws[addr].s, style);
  }

  function mergeStyle(base, extra) {
    const b = base || {};
    const e = extra || {};
    return {
      font: { ...(b.font || {}), ...(e.font || {}) },
      fill: { ...(b.fill || {}), ...(e.fill || {}) },
      alignment: { ...(b.alignment || {}), ...(e.alignment || {}) },
      border: { ...(b.border || {}), ...(e.border || {}) },
      numFmt: e.numFmt || b.numFmt,
    };
  }

  /* =========================
     4) SMALL DOM UTILS (safe)
     ========================= */

  function setTextIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function setHTMLIfExists(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function showIfExists(id, shouldShow) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !shouldShow);
  }

  function escape(text) {
    if (window.escapeHtml) return window.escapeHtml(text);
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* =========================
     5) EXPORT PUBLIC API
     ========================= */
  window.ExcelModule = {
    // loader
    ensureXLSX,

    // input
    loadLessonExcel,
    resetLessonFileUI,

    // parsing helpers
    parseLessonSheet,
    normalizePeriodInSession,
    findColIndex,

    // output
    exportExcel,
    buildSheetDate,
    buildSheetLesson,
  };
})();