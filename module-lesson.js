// File: module-lesson.js (root)
// Module 2: Bốc Bài Giảng
// - Render giao diện vào #sectionLesson
// - Nạp file Excel đầu bài (gọi ExcelModule.loadLessonExcel)
// - Xáo trộn danh sách đầu bài -> gán vào các ô
// - Chọn đúng 3 giáo viên cho 3 ô (qua modal dùng chung ở app.js)
// - THÔNG BÁO KẾT QUẢ (flip card) + xuất biên bản Excel qua ExcelModule.exportExcel('lesson')
//
// Phụ thuộc (đã có trong app.js / module-excel.js):
// - window.state
// - window.SHUFFLE_DURATION, window.FIXED_LESSON_DAYS
// - window.openTeacherModal
// - window.capitalize, window.shuffleArray, window.escapeHtml
// - window.encodeLesson, window.decodeLesson
// - window.sortLessonResults
// - window.ExcelModule.loadLessonExcel, window.ExcelModule.exportExcel

(function () {
  "use strict";

  const TYPE = "lesson";

  /* =========================
     1) RENDER UI
     ========================= */
  function render() {
    const host = document.getElementById("sectionLesson");
    if (!host) return;

    host.innerHTML = `
      <div class="w-full flex flex-col items-center">

        <!-- Setup -->
        <div id="setupLesson" class="w-full max-w-3xl bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-blue-600 mb-8">
          <h3 id="lessonSetupTitle" class="text-2xl font-bold mb-6 text-blue-800 uppercase flex items-center">
            <i class="fas fa-tasks mr-3 text-blue-500"></i> Thiết lập đầu bài giảng
          </h3>

          <div class="space-y-5">
            <div>
              <label class="block text-sm font-bold text-gray-600 mb-2 italic">Bốc thăm cho ngày nào?</label>
              <select id="lessonDayTarget"
                class="w-full p-4 border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none bg-white text-blue-900 font-bold">
                <option value="${escape(window.FIXED_LESSON_DAYS?.[0] || "")}">${escape(window.FIXED_LESSON_DAYS?.[0] || "")}</option>
                <option value="${escape(window.FIXED_LESSON_DAYS?.[1] || "")}">${escape(window.FIXED_LESSON_DAYS?.[1] || "")}</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-bold text-gray-600 mb-2 italic">
                Chọn file Excel chứa đầu bài (dòng 1 là tiêu đề, cột A-D):
              </label>

              <input type="file" id="lessonFileInput"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                class="hidden" />

              <div class="flex flex-col sm:flex-row gap-3">
                <button type="button" id="btnPickLessonFile"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-xl shadow-lg uppercase tracking-wide transition-all active:scale-95">
                  <i class="fas fa-file-excel mr-2"></i> Chọn file Excel
                </button>

                <div id="lessonFileNameWrap" class="flex items-center flex-wrap gap-2 hidden">
                  <span id="lessonFileName" class="file-pill"></span>
                </div>
              </div>

              <p class="mt-3 text-sm text-gray-500 font-semibold">
                Cột A: Tiết trong buổi (hoặc “Tiết theo TKB”) • Cột B: Tiết theo KHGD • Cột C: Tên bài dạy • Cột D: Lớp dạy.
                Số dòng dữ liệu = số ô bốc thăm.
              </p>

              <div id="lessonLoadedInfo" class="hidden mt-4 count-box">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div class="font-black text-blue-900 uppercase">
                    <i class="fas fa-check-circle mr-2 text-blue-600"></i>
                    Đã nạp đầu bài: <span id="lessonLoadedCount">0</span> mục
                  </div>
                  <div class="text-sm text-blue-800 font-bold">
                    Không hiển thị danh sách đầu bài để tránh lộ nội dung
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button type="button" id="btnInitLesson"
            class="w-full mt-6 bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg text-lg uppercase tracking-widest active:scale-95">
            Xác nhận đầu bài
          </button>
        </div>

        <!-- Board -->
        <div id="boardLesson" class="hidden w-full flex flex-col items-center">

          <div class="mb-6 text-center">
            <span class="bg-blue-800 text-white px-10 py-3 rounded-full font-black text-xl shadow-lg border-2 border-yellow-400 uppercase">
              BỐC TIẾT GIẢNG: <span id="lessonTitleDate" class="text-yellow-300 ml-2"></span>
            </span>
          </div>

          <div id="shuffleCtrlLesson" class="mb-10 text-center">
            <div id="shuffleReadyMsgLesson"
              class="hidden mb-4 bg-blue-100 text-blue-800 px-6 py-2 rounded-full font-bold border border-blue-200">
              <i class="fas fa-check-circle mr-2"></i> Đã xáo trộn đầu bài! Mời thầy cô chọn ô.
            </div>

            <button type="button" id="btnShuffleLesson"
              class="bg-blue-600 hover:bg-blue-700 text-white text-3xl font-black py-6 px-16 rounded-full shadow-2xl animate-pulse border-4 border-white transform hover:scale-105 transition-all">
              <i class="fas fa-sync-alt mr-3"></i> BẮT ĐẦU XÁO TRỘN
            </button>
          </div>

          <div id="statusLesson"
            class="hidden mb-10 text-3xl font-black text-blue-600 bg-white px-12 py-5 rounded-full border-4 border-blue-400 shadow-xl">
            <i class="fas fa-cog fa-spin mr-3"></i> ĐANG XÁO TRỘN:
            <span id="timerLesson">10</span>s
          </div>

          <div id="gridLesson" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-6xl mb-8"></div>

          <div class="w-full flex justify-center mb-10">
            <button type="button" id="revealBtnLesson"
              class="hidden bg-red-600 hover:bg-red-700 text-white text-2xl font-black py-5 px-12 rounded-full shadow-2xl border-4 border-white transform hover:scale-105 transition-all uppercase tracking-wider">
              <i class="fas fa-bullhorn mr-3"></i> THÔNG BÁO KẾT QUẢ
            </button>
          </div>

          <div id="resultsLesson" class="hidden w-full bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-blue-600">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-4">
              <h4 class="text-2xl font-black text-blue-800 uppercase italic">
                <i class="fas fa-clipboard-check mr-2"></i> Biên bản bốc bài giảng
              </h4>

              <button type="button" id="btnExportLesson"
                class="bg-blue-800 hover:bg-blue-900 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-md transition-all active:scale-95">
                <i class="fas fa-file-excel mr-2"></i> Tải Biên Bản (.xlsx)
              </button>
            </div>

            <div id="listLesson" class="space-y-3 text-gray-700 font-bold text-xl"></div>
          </div>
        </div>
      </div>
    `;

    // Bind file picking
    document.getElementById("btnPickLessonFile")?.addEventListener("click", () => {
      document.getElementById("lessonFileInput")?.click();
    });

    document.getElementById("lessonFileInput")?.addEventListener("change", (e) => {
      if (window.ExcelModule?.loadLessonExcel) window.ExcelModule.loadLessonExcel(e);
      else alert("Thiếu module-excel.js hoặc ExcelModule.loadLessonExcel().");
    });

    // Bind actions
    document.getElementById("btnInitLesson")?.addEventListener("click", init);
    document.getElementById("btnShuffleLesson")?.addEventListener("click", startShuffle);
    document.getElementById("revealBtnLesson")?.addEventListener("click", revealAll);
    document.getElementById("btnExportLesson")?.addEventListener("click", () => {
      if (window.ExcelModule?.exportExcel) window.ExcelModule.exportExcel(TYPE);
      else alert("Thiếu module-excel.js hoặc ExcelModule.exportExcel().");
    });

    // Set default day
    const sel = document.getElementById("lessonDayTarget");
    if (sel && window.FIXED_LESSON_DAYS?.[0]) sel.value = window.FIXED_LESSON_DAYS[0];
  }

  /* =========================
     2) INIT / RESET MODULE
     ========================= */
  function init() {
    const s = window.state;
    if (!s) return;

    const selectCount = s.lesson.selectCount || 3;
    const pickedDay = String(document.getElementById("lessonDayTarget")?.value || "").trim();

    // validate picked day
    if (!Array.isArray(window.FIXED_LESSON_DAYS) || !window.FIXED_LESSON_DAYS.includes(pickedDay)) {
      alert("Vui lòng chọn đúng ngày bốc thăm trong danh sách.");
      return;
    }

    // validate lessons loaded
    if (!Array.isArray(s.lesson.loadedLessons) || s.lesson.loadedLessons.length < selectCount) {
      alert(`Vui lòng chọn file Excel (.xlsx) có ít nhất ${selectCount} đầu bài hợp lệ!`);
      return;
    }

    s.lesson.target = pickedDay;
    s.lesson.count = s.lesson.loadedLessons.length;

    // pool: encode each lesson into string for safe data-value
    s.lesson.pool = s.lesson.loadedLessons.map((item) => window.encodeLesson(item));

    s.lesson.assignments = {};
    s.lesson.results = [];
    s.lesson.revealed = false;
    s.usedTeachers.lesson = new Set();

    // UI reset
    setText("lessonTitleDate", s.lesson.target);
    show("revealBtnLesson", false);
    show("resultsLesson", false);
    setHTML("listLesson", "");

    show("setupLesson", false);
    show("boardLesson", true);

    // show global reset button
    document.getElementById("resetBtn")?.classList.remove("hidden");

    // render cards with correct count
    renderGrid();
  }

  /* =========================
     3) GRID / CARDS
     ========================= */
  function renderGrid() {
    const s = window.state;
    const grid = document.getElementById("gridLesson");
    if (!grid || !s) return;

    grid.innerHTML = "";

    const color = "from-blue-600 to-blue-800";
    const border = "border-blue-500";

    for (let i = 1; i <= s.lesson.count; i++) {
      grid.innerHTML += `
        <div id="lesson-card-${i}" class="flip-card perspective-1000 h-64 w-full cursor-pointer group">
          <div class="flip-inner relative w-full h-full transform-style-3d transition-transform duration-700 shadow-2xl rounded-2xl">
            <!-- Front -->
            <div class="flip-front absolute inset-0 backface-hidden bg-gradient-to-br ${color}
              rounded-2xl border-4 border-white text-white flex flex-col items-center justify-center
              transform group-hover:scale-[1.02] transition-all relative overflow-hidden">

              <span class="text-sm opacity-80 font-black uppercase tracking-tighter mb-[-10px]">Ô SỐ</span>
              <span class="text-8xl lg:text-9xl font-black num-display"
                style="text-shadow: 4px 4px 0px rgba(0,0,0,0.2)">${i}</span>

              <div class="shuffle-preview"></div>

              <div class="mt-2 px-4 py-2 rounded-full bg-white/20 border border-white/30 text-xs font-black tracking-wide
                teacher-badge hidden text-center max-w-[88%]">
                CHƯA CHỌN GV
              </div>

              <div class="selected-stamp hidden absolute top-3 right-3 items-center gap-2 px-3 py-1 rounded-full font-black text-xs shadow-lg">
                <i class="fas fa-check"></i> ĐÃ CHỌN
              </div>
            </div>

            <!-- Back -->
            <div class="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-2xl border-4 ${border} overflow-hidden flex flex-col">
              <div class="w-full bg-gray-800 py-2 text-center text-white text-[10px] font-black uppercase teacher-school leading-tight">ĐƠN VỊ</div>
              <div class="w-full bg-blue-900 py-1 text-center text-white text-xs font-black uppercase teacher-name">ĐANG CHỜ...</div>

              <div class="flex-grow flex items-center justify-center p-4 text-center">
                <div class="text-lg font-black text-blue-900 leading-tight result-val italic">...</div>
              </div>

              <div class="result-extra hidden px-3 pb-4 text-center">
                <span class="inline-flex items-center justify-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 font-black text-sm lesson-period"></span>
              </div>

              <div class="h-2 bg-yellow-400 w-full"></div>
            </div>
          </div>
        </div>
      `;
    }

    // bind clicks + reset visuals
    for (let i = 1; i <= s.lesson.count; i++) {
      const card = document.getElementById(`lesson-card-${i}`);
      if (!card) continue;

      card.onclick = () => handleCardClick(i);

      const badge = card.querySelector(".teacher-badge");
      const preview = card.querySelector(".shuffle-preview");
      const stamp = card.querySelector(".selected-stamp");
      const extra = card.querySelector(".result-extra");
      const period = card.querySelector(".lesson-period");

      badge?.classList.remove("hidden");
      if (badge) badge.textContent = "CHƯA CHỌN GV";

      preview?.classList.remove("show");
      if (preview) preview.innerHTML = "";

      stamp?.classList.add("hidden");
      extra?.classList.add("hidden");
      if (period) period.textContent = "";

      card.classList.remove("lesson-selected", "flipped");
      card.removeAttribute("data-value");
    }

    // reset shuffle controls
    show("shuffleReadyMsgLesson", false);
    show("btnShuffleLesson", true);
    show("shuffleCtrlLesson", true);
    show("statusLesson", false);
  }

  function handleCardClick(boxNum) {
    const s = window.state;
    if (!s || s.isShuffling) return;

    const card = document.getElementById(`lesson-card-${boxNum}`);
    if (!card) return;

    // must have shuffled (has data-value)
    if (!card.hasAttribute("data-value")) return;

    // lock after reveal
    if (s.lesson.revealed) return;

    // already assigned this box
    if (s.lesson.assignments[boxNum]) {
      alert("Ô này đã được chọn giáo viên. Vui lòng chọn ô khác.");
      return;
    }

    // limit to selectCount
    const assignedCount = Object.keys(s.lesson.assignments).length;
    if (assignedCount >= s.lesson.selectCount) {
      alert(`Đã đủ ${s.lesson.selectCount} giáo viên cho module 2. Hãy bấm "THÔNG BÁO KẾT QUẢ".`);
      return;
    }

    window.openTeacherModal(
      TYPE,
      boxNum,
      `Bốc bài giảng cho ngày: ${s.lesson.target} (chỉ gán 3 giáo viên vào 3 ô trước khi công bố)`
    );
  }

  /* =========================
     4) ASSIGN TEACHER (called by app.js modal confirm)
     ========================= */
  function assignTeacherToBox(boxNum, teacher) {
    const s = window.state;
    const card = document.getElementById(`lesson-card-${boxNum}`);
    if (!s || !card) return;

    if (s.lesson.revealed) return;
    if (s.lesson.assignments[boxNum]) return;

    const assignedCount = Object.keys(s.lesson.assignments).length;
    if (assignedCount >= s.lesson.selectCount) {
      alert(`Đã đủ ${s.lesson.selectCount} giáo viên cho module 2.`);
      return;
    }

    s.lesson.assignments[boxNum] = teacher.id;
    s.usedTeachers.lesson.add(teacher.id);

    card.classList.add("lesson-selected");

    const badge = card.querySelector(".teacher-badge");
    if (badge) {
      badge.classList.remove("hidden");
      badge.textContent = `${teacher.name} • ${teacher.school}`;
    }

    const stamp = card.querySelector(".selected-stamp");
    stamp?.classList.remove("hidden");

    const currentAssigned = Object.keys(s.lesson.assignments).length;
    if (currentAssigned >= s.lesson.selectCount) {
      show("revealBtnLesson", true);
    }
  }

  /* =========================
     5) SHUFFLE LOGIC
     ========================= */
  function startShuffle() {
    const s = window.state;
    if (!s || s.isShuffling) return;

    if (!s.lesson.count || s.lesson.count < s.lesson.selectCount) {
      alert(`Cần có ít nhất ${s.lesson.selectCount} đầu bài hợp lệ để bốc cho 3 giáo viên.`);
      return;
    }

    s.isShuffling = true;

    show("shuffleCtrlLesson", false);
    show("statusLesson", true);
    setText("timerLesson", String(window.SHUFFLE_DURATION));

    const cards = document.querySelectorAll("#gridLesson .flip-card");
    cards.forEach((c) => c.classList.add("shuffling-animation"));
    cards.forEach((c) => c.querySelector(".shuffle-preview")?.classList.add("show"));

    let timeLeft = window.SHUFFLE_DURATION;

    const shuffleLoop = setInterval(() => {
      // shuffle display numbers for effect
      const nums = Array.from({ length: s.lesson.count }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      const displays = document.querySelectorAll("#gridLesson .num-display");
      displays.forEach((d, idx) => (d.textContent = String(nums[idx])));

      // preview text effect (do not reveal lesson content)
      const previews = document.querySelectorAll("#gridLesson .shuffle-preview");
      previews.forEach((p) => {
        const randomNo = Math.floor(Math.random() * Math.max(1, s.lesson.count)) + 1;
        p.innerHTML = `ĐANG ĐẢO<br>MỤC ${randomNo}`;
      });
    }, 100);

    const clock = setInterval(() => {
      timeLeft -= 1;
      setText("timerLesson", String(timeLeft));

      if (timeLeft <= 0) {
        clearInterval(clock);
        clearInterval(shuffleLoop);
        completeShuffle();
      }
    }, 1000);
  }

  function completeShuffle() {
    const s = window.state;
    if (!s) return;

    s.isShuffling = false;

    // shuffle pool (encoded lessons)
    s.lesson.pool = window.shuffleArray(s.lesson.pool);

    const cards = document.querySelectorAll("#gridLesson .flip-card");
    cards.forEach((card, idx) => {
      card.classList.remove("shuffling-animation");
      card.querySelector(".num-display").textContent = String(idx + 1);
      card.setAttribute("data-value", s.lesson.pool[idx]);

      const preview = card.querySelector(".shuffle-preview");
      preview?.classList.remove("show");
      if (preview) preview.innerHTML = "";
    });

    show("statusLesson", false);
    show("shuffleCtrlLesson", true);
    show("shuffleReadyMsgLesson", true);
    show("btnShuffleLesson", false);
  }

  /* =========================
     6) REVEAL RESULTS
     ========================= */
  function revealAll() {
    const s = window.state;
    if (!s) return;

    if (s.lesson.revealed) return;

    const assignedBoxes = Object.keys(s.lesson.assignments).map(Number);
    if (assignedBoxes.length < s.lesson.selectCount) {
      alert(`Chưa đủ ${s.lesson.selectCount} giáo viên chọn ô. Hiện tại mới có ${assignedBoxes.length}.`);
      return;
    }

    s.lesson.revealed = true;

    const btn = document.getElementById("revealBtnLesson");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("opacity-60", "cursor-not-allowed");
    }

    setHTML("listLesson", "");
    s.lesson.results = [];

    // reveal theo thứ tự người đã chọn (ổn định, minh bạch)
    assignedBoxes.forEach((boxNum, idx) => {
      setTimeout(() => revealOne(boxNum), 650 * idx);
    });
  }

  function revealOne(boxNum) {
    const s = window.state;
    const card = document.getElementById(`lesson-card-${boxNum}`);
    if (!s || !card) return;

    const encoded = card.getAttribute("data-value");
    const lessonObj = window.decodeLesson(encoded);

    const teacherId = s.lesson.assignments[boxNum];
    const teacher = (window.TEACHERS || []).find((t) => t.id === teacherId);
    if (!teacher) return;

    const displayLine = `${lessonObj.className} • ${lessonObj.periodKHGD} • ${lessonObj.title}`;
    const periodText = `TIẾT TRONG BUỔI: TIẾT ${lessonObj.periodInSession}`;

    card.querySelector(".teacher-school").textContent = teacher.school;
    card.querySelector(".teacher-name").textContent = teacher.name;
    card.querySelector(".result-val").textContent = displayLine;

    const period = card.querySelector(".lesson-period");
    if (period) period.textContent = periodText;

    card.querySelector(".result-extra")?.classList.remove("hidden");
    card.classList.add("flipped");

    s.lesson.results.push({
      box: boxNum,
      name: teacher.name,
      school: teacher.school,
      val: displayLine,
      periodInSession: lessonObj.periodInSession,
      periodKHGD: lessonObj.periodKHGD,
      className: lessonObj.className,
      title: lessonObj.title,
    });

    renderResultsList();
    show("resultsLesson", true);
  }

  function renderResultsList() {
    const s = window.state;
    const list = document.getElementById("listLesson");
    if (!s || !list) return;

    list.innerHTML = "";
    const sorted = window.sortLessonResults(s.lesson.results);

    sorted.forEach((result) => {
      const div = document.createElement("div");
      div.className =
        "flex flex-col md:flex-row md:items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-blue-500";
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="bg-gray-100 px-2 py-1 rounded text-[10px] font-bold">Ô ${result.box}</span>
          <span class="text-xs text-gray-500 italic shrink-0">${window.escapeHtml(result.school)}</span>
          <span class="text-blue-900 font-bold">${window.escapeHtml(result.name)}</span>
          <i class="fas fa-arrow-right text-gray-300 text-xs"></i>
          <span class="text-red-600 font-black">${window.escapeHtml(result.val)}</span>
        </div>

        <div class="md:ml-auto">
          <span class="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-900 border border-yellow-300 font-black text-sm">
            TIẾT TRONG BUỔI: TIẾT ${window.escapeHtml(result.periodInSession)}
          </span>
        </div>
      `;
      list.appendChild(div);
    });
  }

  /* =========================
     7) SMALL DOM UTILS
     ========================= */
  function show(id, yes) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !yes);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
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
     8) EXPORT PUBLIC API
     ========================= */
  window.LessonModule = {
    render,
    init,
    startShuffle,
    assignTeacherToBox,
    revealAll,
  };
})();