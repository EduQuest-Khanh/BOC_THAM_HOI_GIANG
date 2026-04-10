// File: module-date.js (root)
// Module 1: Bốc Ngày Giảng
// - Render giao diện vào #sectionDate
// - Xáo trộn 6 ô ngày (FIXED_DATE_POOL) với ràng buộc không có 3 ngày giống nhau liên tiếp
// - Chọn giáo viên cho từng ô (qua modal dùng chung ở app.js)
// - THÔNG BÁO KẾT QUẢ (flip card) + xuất biên bản Excel qua ExcelModule.exportExcel('date')
//
// Phụ thuộc (đã có trong app.js / module-excel.js):
// - window.state
// - window.SHUFFLE_DURATION, window.FIXED_DATE_POOL
// - window.openTeacherModal
// - window.capitalize, window.shuffleArray, window.escapeHtml
// - window.sortDateResults
// - window.ExcelModule.exportExcel

(function () {
  "use strict";

  const TYPE = "date";

  /* =========================
     1) RENDER UI
     ========================= */
  function render() {
    const host = document.getElementById("sectionDate");
    if (!host) return;

    host.innerHTML = `
      <div class="w-full flex flex-col items-center">
        <!-- Setup -->
        <div id="setupDate" class="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-2xl border-t-8 border-green-600 mb-8">
          <h3 class="text-2xl font-bold mb-6 text-green-800 uppercase flex items-center">
            <i class="fas fa-cog mr-3 text-green-500"></i> Thiết lập 6 Ngày giảng
          </h3>

          <div class="fixed-date-box mb-6">
            <div class="font-black text-green-900 uppercase mb-3">
              <i class="fas fa-lock mr-2 text-green-600"></i> Danh sách ngày cố định
            </div>
            <div class="space-y-3">
              <div class="fixed-date-item">
                <i class="fas fa-calendar-day text-green-600"></i>
                <span>Chiều thứ 2 ngày 13/4/2026</span>
              </div>
              <div class="fixed-date-item">
                <i class="fas fa-calendar-day text-green-600"></i>
                <span>Sáng thứ 3 ngày 14/4/2026</span>
              </div>
            </div>
            <p class="mt-4 text-sm text-green-800 font-semibold">
              Hệ thống dùng sẵn đúng 2 ngày này để tạo 6 ô và xáo ngẫu nhiên mỗi lần.
            </p>
          </div>

          <button type="button" id="btnInitDate"
            class="w-full bg-green-600 text-white font-black py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg text-lg uppercase tracking-widest active:scale-95">
            Xác nhận danh sách ngày
          </button>
        </div>

        <!-- Board -->
        <div id="boardDate" class="hidden w-full flex flex-col items-center">
          <div id="shuffleCtrlDate" class="mb-10 text-center">
            <div id="shuffleReadyMsgDate"
              class="hidden mb-4 bg-green-100 text-green-800 px-6 py-2 rounded-full font-bold border border-green-200">
              <i class="fas fa-check-circle mr-2"></i> Đã xáo trộn xong! Mời thầy cô chọn ô.
            </div>

            <button type="button" id="btnShuffleDate"
              class="bg-orange-500 hover:bg-orange-600 text-white text-3xl font-black py-6 px-16 rounded-full shadow-2xl animate-pulse transform hover:scale-105 transition-all border-4 border-white">
              <i class="fas fa-random mr-3"></i> BẮT ĐẦU XÁO TRỘN
            </button>
          </div>

          <div id="statusDate"
            class="hidden mb-10 text-3xl font-black text-orange-600 bg-white px-12 py-5 rounded-full border-4 border-orange-400 shadow-xl">
            <i class="fas fa-sync-alt fa-spin mr-3"></i> ĐANG XÁO TRỘN:
            <span id="timerDate">10</span>s
          </div>

          <div id="gridDate"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl mb-8"></div>

          <div class="w-full flex justify-center mb-10">
            <button type="button" id="revealBtnDate"
              class="hidden bg-red-600 hover:bg-red-700 text-white text-2xl font-black py-5 px-12 rounded-full shadow-2xl border-4 border-white transform hover:scale-105 transition-all uppercase tracking-wider">
              <i class="fas fa-bullhorn mr-3"></i> THÔNG BÁO KẾT QUẢ
            </button>
          </div>

          <div id="resultsDate" class="hidden w-full bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-green-600">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-4">
              <h4 class="text-2xl font-black text-green-800 uppercase italic">
                <i class="fas fa-list-ol mr-2"></i> Kết quả bốc thăm ngày
              </h4>
              <button type="button" id="btnExportDate"
                class="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-md transition-all active:scale-95">
                <i class="fas fa-file-excel mr-2"></i> Tải Biên Bản (.xlsx)
              </button>
            </div>
            <div id="listDate"
              class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 text-gray-700 font-bold text-lg"></div>
          </div>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById("btnInitDate")?.addEventListener("click", init);
    document.getElementById("btnShuffleDate")?.addEventListener("click", startShuffle);
    document.getElementById("revealBtnDate")?.addEventListener("click", revealAll);
    document.getElementById("btnExportDate")?.addEventListener("click", () => {
      if (window.ExcelModule?.exportExcel) window.ExcelModule.exportExcel(TYPE);
      else alert("Thiếu module-excel.js hoặc ExcelModule.exportExcel().");
    });
  }

  /* =========================
     2) INIT / RESET MODULE
     ========================= */
  function init() {
    const s = window.state;
    if (!s) return;

    // reset state date
    s.date.pool = [...window.FIXED_DATE_POOL];
    s.date.assignments = {};
    s.date.results = [];
    s.date.revealed = false;
    s.usedTeachers.date = new Set();

    // reset UI
    hide("revealBtnDate", true);
    hide("resultsDate", true);
    setHTML("listDate", "");

    hide("setupDate", true);
    hide("boardDate", false);

    // show global reset button
    document.getElementById("resetBtn")?.classList.remove("hidden");

    // render cards
    renderGrid();
  }

  /* =========================
     3) GRID / CARDS
     ========================= */
  function renderGrid() {
    const s = window.state;
    const grid = document.getElementById("gridDate");
    if (!grid || !s) return;

    grid.innerHTML = "";

    const color = "from-green-600 to-green-800";
    const border = "border-green-500";

    for (let i = 1; i <= s.date.count; i++) {
      grid.innerHTML += `
        <div id="date-card-${i}" class="flip-card perspective-1000 h-64 w-full cursor-pointer group">
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
              <div class="h-2 bg-yellow-400 w-full"></div>
            </div>
          </div>
        </div>
      `;
    }

    // set click handlers & reset visuals
    for (let i = 1; i <= s.date.count; i++) {
      const card = document.getElementById(`date-card-${i}`);
      if (!card) continue;

      card.onclick = () => handleCardClick(i);

      // reset styles
      const badge = card.querySelector(".teacher-badge");
      const preview = card.querySelector(".shuffle-preview");
      const stamp = card.querySelector(".selected-stamp");

      badge?.classList.remove("hidden");
      if (badge) badge.textContent = "CHƯA CHỌN GV";

      preview?.classList.remove("show");
      if (preview) preview.innerHTML = "";

      stamp?.classList.add("hidden");

      card.classList.remove("date-selected", "flipped");
      card.removeAttribute("data-value");
    }

    // reset shuffle area
    show("shuffleReadyMsgDate", false);
    show("btnShuffleDate", true);
    show("shuffleCtrlDate", true);
    show("statusDate", false);
  }

  function handleCardClick(boxNum) {
    const s = window.state;
    if (!s || s.isShuffling) return;

    const card = document.getElementById(`date-card-${boxNum}`);
    if (!card) return;

    // chỉ được click sau khi đã shuffle (có data-value)
    if (!card.hasAttribute("data-value")) return;

    // đã reveal rồi thì khóa
    if (s.date.revealed) return;

    // ô đã gán GV
    if (s.date.assignments[boxNum]) {
      alert("Ô này đã được chọn giáo viên. Vui lòng chọn ô khác.");
      return;
    }

    // mở modal chọn GV
    window.openTeacherModal(
      TYPE,
      boxNum,
      "Bốc thăm ngày giảng thi (chỉ gán giáo viên vào ô, chưa công bố kết quả)"
    );
  }

  /* =========================
     4) ASSIGN TEACHER (called by app.js modal confirm)
     ========================= */
  function assignTeacherToBox(boxNum, teacher) {
    const s = window.state;
    const card = document.getElementById(`date-card-${boxNum}`);
    if (!s || !card) return;

    if (s.date.revealed) return;
    if (s.date.assignments[boxNum]) return;

    s.date.assignments[boxNum] = teacher.id;
    s.usedTeachers.date.add(teacher.id);

    card.classList.add("date-selected");

    const badge = card.querySelector(".teacher-badge");
    if (badge) {
      badge.classList.remove("hidden");
      badge.textContent = `${teacher.name} • ${teacher.school}`;
    }

    const stamp = card.querySelector(".selected-stamp");
    stamp?.classList.remove("hidden");

    const assignedCount = Object.keys(s.date.assignments).length;
    if (assignedCount >= s.date.count) {
      show("revealBtnDate", true);
    }
  }

  /* =========================
     5) SHUFFLE LOGIC
     ========================= */
  function startShuffle() {
    const s = window.state;
    if (!s || s.isShuffling) return;

    s.isShuffling = true;

    // hide shuffle controls button, show status
    show("shuffleCtrlDate", false);
    show("statusDate", true);
    setText("timerDate", String(window.SHUFFLE_DURATION));

    const cards = document.querySelectorAll("#gridDate .flip-card");
    cards.forEach((c) => c.classList.add("shuffling-animation"));
    cards.forEach((c) => c.querySelector(".shuffle-preview")?.classList.add("show"));

    let timeLeft = window.SHUFFLE_DURATION;

    const shuffleLoop = setInterval(() => {
      // randomize number displays to create shuffle effect
      const nums = Array.from({ length: s.date.count }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
      const displays = document.querySelectorAll("#gridDate .num-display");
      displays.forEach((d, idx) => (d.textContent = String(nums[idx])));

      // random preview date labels
      const tempPool = generateDatePoolForShuffle(true);
      const previews = document.querySelectorAll("#gridDate .shuffle-preview");
      previews.forEach((p, idx) => (p.innerHTML = shortDateLabel(tempPool[idx])));
    }, 100);

    const clock = setInterval(() => {
      timeLeft -= 1;
      setText("timerDate", String(timeLeft));

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

    // generate pool (no triple same)
    s.date.pool = generateDatePoolForShuffle(false);

    // set cards final data-value, stop animations
    const cards = document.querySelectorAll("#gridDate .flip-card");
    cards.forEach((card, idx) => {
      card.classList.remove("shuffling-animation");
      // reset display number to real box order
      card.querySelector(".num-display").textContent = String(idx + 1);

      card.setAttribute("data-value", s.date.pool[idx]);

      const preview = card.querySelector(".shuffle-preview");
      preview?.classList.remove("show");
      if (preview) preview.innerHTML = "";
    });

    // show ready message + hide shuffle button (chỉ shuffle 1 lần)
    show("statusDate", false);
    show("shuffleCtrlDate", true);
    show("shuffleReadyMsgDate", true);
    show("btnShuffleDate", false);
  }

  function generateDatePoolForShuffle(allowAnyForAnimation = false) {
    const base = [...window.FIXED_DATE_POOL];

    for (let tries = 0; tries < 500; tries++) {
      const candidate = window.shuffleArray(base);
      if (allowAnyForAnimation) return candidate;
      if (!hasTripleSame(candidate)) return candidate;
    }
    return window.shuffleArray(base);
  }

  function hasTripleSame(arr) {
    for (let i = 0; i <= arr.length - 3; i++) {
      if (arr[i] === arr[i + 1] && arr[i + 1] === arr[i + 2]) return true;
    }
    return false;
  }

  function shortDateLabel(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("chiều") && text.includes("13/4/2026")) return "CHIỀU<br>13/4/2026";
    if (text.includes("sáng") && text.includes("14/4/2026")) return "SÁNG<br>14/4/2026";
    return window.escapeHtml(String(value || ""));
  }

  /* =========================
     6) REVEAL RESULTS
     ========================= */
  function revealAll() {
    const s = window.state;
    if (!s) return;

    if (s.date.revealed) return;

    const assignedCount = Object.keys(s.date.assignments).length;
    if (assignedCount < s.date.count) {
      alert(`Chưa đủ ${s.date.count} giáo viên chọn ô. Hiện tại mới có ${assignedCount}.`);
      return;
    }

    s.date.revealed = true;

    const btn = document.getElementById("revealBtnDate");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("opacity-60", "cursor-not-allowed");
    }

    setHTML("listDate", "");
    s.date.results = [];

    for (let i = 1; i <= s.date.count; i++) {
      setTimeout(() => revealOne(i), 650 * (i - 1));
    }
  }

  function revealOne(boxNum) {
    const s = window.state;
    const card = document.getElementById(`date-card-${boxNum}`);
    if (!s || !card) return;

    const value = card.getAttribute("data-value");
    const teacherId = s.date.assignments[boxNum];
    const teacher = (window.TEACHERS || []).find((t) => t.id === teacherId);
    if (!teacher) return;

    card.querySelector(".teacher-school").textContent = teacher.school;
    card.querySelector(".teacher-name").textContent = teacher.name;
    card.querySelector(".result-val").textContent = value;

    card.classList.add("flipped");

    s.date.results.push({
      box: boxNum,
      name: teacher.name,
      school: teacher.school,
      val: value,
    });

    renderResultsList();
    show("resultsDate", true);
  }

  function renderResultsList() {
    const s = window.state;
    const list = document.getElementById("listDate");
    if (!s || !list) return;

    list.innerHTML = "";
    const sorted = window.sortDateResults(s.date.results);

    sorted.forEach((result) => {
      const div = document.createElement("div");
      div.className =
        "flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm border-l-4 border-green-500";
      div.innerHTML = `
        <span class="bg-gray-100 px-2 py-1 rounded text-[10px] font-bold">Ô ${result.box}</span>
        <span class="text-xs text-gray-500 italic shrink-0">${window.escapeHtml(result.school)}</span>
        <span class="text-blue-900 font-bold truncate">${window.escapeHtml(result.name)}</span>
        <i class="fas fa-arrow-right text-gray-300 text-xs"></i>
        <span class="text-red-600 font-black">${window.escapeHtml(result.val)}</span>
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

  function hide(id, yesHide) {
    show(id, !yesHide);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /* =========================
     8) EXPORT PUBLIC API
     ========================= */
  window.DateModule = {
    render,
    init,
    startShuffle,
    assignTeacherToBox,
    revealAll,
  };
})();