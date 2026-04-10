// File: app.js (root)
// Vai trò: State chung + chuyển tab + modal chọn giáo viên + hàm dùng chung.
// Lưu ý: Các module (module-date.js, module-lesson.js, module-excel.js) sẽ gọi các hàm ở đây thông qua window.*

/* =========================
   1) CONSTANTS / DATA
   ========================= */
const SHUFFLE_DURATION = 10;
const FULL_TITLE = "HỘI THI GIÁO VIÊN CHỦ NHIỆM GIỎI XÃ VẠN LINH NĂM HỌC 2025-2026";

// 6 ô ngày giảng (2 ngày cố định lặp lại 3 lần)
const FIXED_DATE_POOL = [
  "Chiều thứ 2 ngày 13/4/2026",
  "Sáng thứ 3 ngày 14/4/2026",
  "Chiều thứ 2 ngày 13/4/2026",
  "Sáng thứ 3 ngày 14/4/2026",
  "Chiều thứ 2 ngày 13/4/2026",
  "Sáng thứ 3 ngày 14/4/2026",
];

const FIXED_LESSON_DAYS = [
  "Chiều thứ 2 ngày 13/4/2026",
  "Sáng thứ 3 ngày 14/4/2026",
];

// Danh sách giáo viên (đang hard-code giống bản cũ; sau này có thể tách file hoặc load JSON)
const TEACHERS = [
  { id: 1, name: "Vi Thị Lưu Ly", school: "THCS Hòa Bình" },
  { id: 2, name: "Hoàng Hải Triều", school: "THCS Hòa Bình" },
  { id: 3, name: "Hoàng Thị Châm", school: "THCS Vạn Linh" },
  { id: 4, name: "Vũ Bích Ngọc", school: "THCS Vạn Linh" },
  { id: 5, name: "Đào Xuân Hòa", school: "THCS Y Tịch" },
  { id: 6, name: "Cao Minh", school: "THCS Y Tịch" },
];

/* =========================
   2) APP STATE
   ========================= */
const state = {
  currentTab: "date",
  isShuffling: false,

  // Module bốc ngày
  date: {
    pool: [],              // danh sách kết quả sau khi shuffle
    results: [],           // danh sách kết quả đã reveal
    count: 6,              // số ô
    assignments: {},       // boxNum -> teacherId
    revealed: false,
  },

  // Module bốc bài
  lesson: {
    pool: [],              // danh sách encoded lesson (sau shuffle)
    results: [],           // danh sách kết quả đã reveal
    count: 0,              // số ô = số dòng excel
    selectCount: 3,        // số GV cần gán (3)
    target: FIXED_LESSON_DAYS[0],
    assignments: {},       // boxNum -> teacherId
    revealed: false,

    loadedLessons: [],     // lesson object list sau khi load excel (module-excel sẽ set)
    sourceFileName: "",
  },

  // modal
  activeBox: null,         // { type, boxNum }

  // chống chọn trùng GV theo từng module
  usedTeachers: {
    date: new Set(),
    lesson: new Set(),
  },
};

/* =========================
   3) DOM HELPERS
   ========================= */
function $(id) {
  return document.getElementById(id);
}

/* =========================
   4) TAB / NAVIGATION
   ========================= */
function switchTab(tab) {
  if (state.isShuffling) return;

  state.currentTab = tab;

  // tab button active
  $("tabDate")?.classList.toggle("tab-active", tab === "date");
  $("tabLesson")?.classList.toggle("tab-active", tab === "lesson");

  // show/hide sections
  $("sectionDate")?.classList.toggle("hidden", tab !== "date");
  $("sectionLesson")?.classList.toggle("hidden", tab !== "lesson");

  // đổi màu header cho hợp module
  const header = $("appHeader");
  if (header) {
    header.style.backgroundColor = tab === "date" ? "#064e3b" : "#1e3a8a";
  }
}

/* =========================
   5) MODAL TEACHER PICK
   ========================= */
function openTeacherModal(type, boxNum, subText = "") {
  if (state.isShuffling) return;

  state.activeBox = { type, boxNum };
  $("modalBoxNum").innerText = String(boxNum);
  $("modalSubText").innerText = subText || "";

  populateTeacherSelect(type);

  $("nameModal")?.classList.remove("hidden");
  $("teacherPick")?.focus();
}

function closeModal() {
  $("nameModal")?.classList.add("hidden");
  state.activeBox = null;

  // reset warn/hint khi đóng
  $("pickedHint")?.classList.add("hidden");
  $("pickedWarn")?.classList.add("hidden");
}

function populateTeacherSelect(type) {
  const select = $("teacherPick");
  const hint = $("pickedHint");
  const hintText = $("pickedHintText");
  const warn = $("pickedWarn");
  const infoDate = $("pickedInfoDate");
  const infoLesson = $("pickedInfoLesson");

  if (!select) return;

  select.innerHTML = "";

  // default option
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Chọn giáo viên --";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  // render teachers
  TEACHERS.forEach((teacher) => {
    const option = document.createElement("option");
    option.value = String(teacher.id);
    option.textContent = `${teacher.name} — ${teacher.school}`;

    if (state.usedTeachers[type].has(teacher.id)) {
      option.disabled = true;
      option.textContent = `⛔ ${option.textContent} (đã chọn)`;
    }
    select.appendChild(option);
  });

  // reset UI status
  hint?.classList.add("hidden");
  warn?.classList.add("hidden");

  if (type === "date") {
    infoDate?.classList.remove("hidden");
    infoLesson?.classList.add("hidden");
  } else {
    infoDate?.classList.add("hidden");
    infoLesson?.classList.remove("hidden");
  }

  select.onchange = () => {
    warn?.classList.add("hidden");

    const id = parseInt(select.value || "0", 10);
    const teacher = TEACHERS.find((t) => t.id === id);

    if (!teacher) {
      hint?.classList.add("hidden");
      return;
    }

    if (hintText) hintText.textContent = `Bạn đã chọn: ${teacher.name} (${teacher.school})`;
    hint?.classList.remove("hidden");

    if (state.usedTeachers[type].has(id)) {
      warn?.classList.remove("hidden");
    }
  };
}

/**
 * Khi bấm Xác nhận trong modal:
 * - kiểm tra GV hợp lệ và chưa dùng
 * - gọi hàm assign do module cung cấp: window.DateModule.assignTeacher(...) hoặc window.LessonModule.assignTeacher(...)
 */
function confirmModalAction() {
  if (!state.activeBox) return;

  const { type, boxNum } = state.activeBox;
  const select = $("teacherPick");
  const warn = $("pickedWarn");

  const pickedId = parseInt(select?.value || "0", 10);
  const teacher = TEACHERS.find((t) => t.id === pickedId);

  if (!teacher) {
    alert("Vui lòng chọn giáo viên trong danh sách!");
    return;
  }

  if (state.usedTeachers[type].has(teacher.id)) {
    warn?.classList.remove("hidden");
    return;
  }

  // Gọi module tương ứng để gán vào ô
  if (type === "date") {
    if (window.DateModule?.assignTeacherToBox) {
      window.DateModule.assignTeacherToBox(boxNum, teacher);
      closeModal();
      return;
    }
    alert("Thiếu module-date.js hoặc DateModule.assignTeacherToBox().");
    return;
  }

  if (type === "lesson") {
    if (window.LessonModule?.assignTeacherToBox) {
      window.LessonModule.assignTeacherToBox(boxNum, teacher);
      closeModal();
      return;
    }
    alert("Thiếu module-lesson.js hoặc LessonModule.assignTeacherToBox().");
    return;
  }
}

/* =========================
   6) COMMON UTILS (dùng chung)
   ========================= */
function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function shuffleArray(arr) {
  const copy = [...(arr || [])];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(text) {
  const s = String(text ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// encode/decode lesson object để gán vào data-value trên card
function encodeLesson(obj) {
  return encodeURIComponent(JSON.stringify(obj));
}
function decodeLesson(encoded) {
  try {
    return JSON.parse(decodeURIComponent(encoded || ""));
  } catch {
    return { periodInSession: "?", periodKHGD: "", title: String(encoded || ""), className: "" };
  }
}

/* ===== Sorting helpers (module-date/module-lesson có thể dùng) ===== */
function extractDatePartsFromLabel(label) {
  const text = String(label || "").trim();
  const match = text.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match) return { timeValue: Number.MAX_SAFE_INTEGER, sessionRank: 99 };

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const dateObj = new Date(year, month - 1, day);

  let sessionRank = 99;
  const lower = text.toLowerCase();
  if (lower.includes("sáng")) sessionRank = 0;
  else if (lower.includes("chiều")) sessionRank = 1;
  else if (lower.includes("tối")) sessionRank = 2;

  return { timeValue: dateObj.getTime(), sessionRank };
}

function sortDateResults(results) {
  return [...(results || [])].sort((a, b) => {
    const da = extractDatePartsFromLabel(a.val);
    const db = extractDatePartsFromLabel(b.val);
    if (da.timeValue !== db.timeValue) return da.timeValue - db.timeValue;
    if (da.sessionRank !== db.sessionRank) return da.sessionRank - db.sessionRank;

    const byName = String(a.name || "").localeCompare(String(b.name || ""), "vi");
    if (byName !== 0) return byName;
    return (a.box || 0) - (b.box || 0);
  });
}

function sortLessonResults(results) {
  return [...(results || [])].sort((a, b) => {
    const pa = parseInt(a.periodInSession || "999", 10);
    const pb = parseInt(b.periodInSession || "999", 10);
    if (pa !== pb) return pa - pb;

    const byName = String(a.name || "").localeCompare(String(b.name || ""), "vi");
    if (byName !== 0) return byName;
    return (a.box || 0) - (b.box || 0);
  });
}

/* =========================
   7) PUBLIC API (expose to window)
   ========================= */
window.SHUFFLE_DURATION = SHUFFLE_DURATION;
window.FULL_TITLE = FULL_TITLE;
window.FIXED_DATE_POOL = FIXED_DATE_POOL;
window.FIXED_LESSON_DAYS = FIXED_LESSON_DAYS;
window.TEACHERS = TEACHERS;

window.state = state;

window.switchTab = switchTab;
window.openTeacherModal = openTeacherModal;
window.closeModal = closeModal;
window.confirmModalAction = confirmModalAction;

window.capitalize = capitalize;
window.shuffleArray = shuffleArray;
window.escapeHtml = escapeHtml;

window.encodeLesson = encodeLesson;
window.decodeLesson = decodeLesson;

window.sortDateResults = sortDateResults;
window.sortLessonResults = sortLessonResults;

/* =========================
   8) BOOTSTRAP
   ========================= */
document.addEventListener("DOMContentLoaded", () => {
  // default tab
  switchTab("date");

  // để module-lesson dùng nếu cần
  // set default target day
  state.lesson.target = FIXED_LESSON_DAYS[0];

  // các module sẽ tự render UI vào #sectionDate và #sectionLesson
  // nếu module đã load, gọi luôn render setup để hiện giao diện ban đầu
  if (window.DateModule?.render) window.DateModule.render();
  if (window.LessonModule?.render) window.LessonModule.render();
});