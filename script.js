document.addEventListener("DOMContentLoaded", () => {
  /* ---------- mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- seamless ticker loop ---------- */
  const track = document.querySelector(".ticker-track");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- live countdown to next race ---------- */
  const countdownEl = document.querySelector("[data-countdown]");
  if (countdownEl) {
    const target = new Date(countdownEl.getAttribute("data-countdown")).getTime();
    const dEl = countdownEl.querySelector("[data-d]");
    const hEl = countdownEl.querySelector("[data-h]");
    const mEl = countdownEl.querySelector("[data-m]");
    const sEl = countdownEl.querySelector("[data-s]");

    function tick() {
      const now = Date.now();
      let diff = Math.max(0, target - now);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (dEl) dEl.textContent = String(d).padStart(2, "0");
      if (hEl) hEl.textContent = String(h).padStart(2, "0");
      if (mEl) mEl.textContent = String(m).padStart(2, "0");
      if (sEl) sEl.textContent = String(s).padStart(2, "0");
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- article expand/collapse ---------- */
  document.querySelectorAll(".expand-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const body = document.getElementById(targetId);
      if (!body) return;
      const isOpen = body.classList.toggle("open");
      btn.textContent = isOpen ? btn.dataset.less : btn.dataset.more;
    });
  });

  /* ---------- tyre compound info panel ----------
     Update SOFT/MEDIUM/HARD's compound number below every race weekend to
     match Pirelli's official nomination for that circuit (C1 = hardest,
     C6 = softest — three consecutive numbers get nominated as that
     weekend's hard/medium/soft). Intermediate and wet are fixed compounds
     and are never renominated, so their blurbs don't need updating. */
  const CURRENT_GP_COMPOUNDS = { soft: "C4", medium: "C3", hard: "C2" }; // United States GP (Austin): Pirelli nomination C2/C3/C4

  const TIRE_INFO = {
    soft: `Soft (${CURRENT_GP_COMPOUNDS.soft}): highest grip, fastest lap times, wears fastest. Used in qualifying and short, aggressive stints.`,
    medium: `Medium (${CURRENT_GP_COMPOUNDS.medium}): balances pace and durability. The most common choice for a race's main stint.`,
    hard: `Hard (${CURRENT_GP_COMPOUNDS.hard}): most durable, lowest grip. Chosen for long stints or hot, abrasive circuits.`,
    inter: "Intermediate: grooved for light rain or a drying track. Bridges the gap between slicks and full wets.",
    wet: "Wet: full tread pattern for standing water. Used in heavy rain, clears large volumes of water per second.",
  };

  const tireButtons = document.querySelectorAll(".tire-btn");
  const tireInfo = document.getElementById("tire-info");
  if (tireButtons.length && tireInfo) {
    tireButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.compound;
        const alreadyOpen = btn.getAttribute("aria-expanded") === "true";
        tireButtons.forEach((b) => b.setAttribute("aria-expanded", "false"));
        if (alreadyOpen) {
          tireInfo.hidden = true;
          tireInfo.textContent = "";
          return;
        }
        btn.setAttribute("aria-expanded", "true");
        tireInfo.textContent = TIRE_INFO[key] || "";
        tireInfo.hidden = false;
      });
    });
  }

  /* ---------- archive: expand rows ---------- */
  document.querySelectorAll(".race-row").forEach((row) => {
    const head = row.querySelector(".race-row-head");
    const expandable = !row.classList.contains("upcoming") && row.querySelector(".race-detail");
    function sync() { if (head && expandable) head.setAttribute("aria-expanded", row.classList.contains("open") ? "true" : "false"); }
    row.addEventListener("click", (e) => {
      if (row.classList.contains("upcoming")) return;
      if (e.target.closest("a, button, input")) return; // links inside the recap keep working
      row.classList.toggle("open");
      sync();
    });
    // keyboard: the row head acts as a disclosure button
    if (head && expandable) {
      head.setAttribute("role", "button");
      head.tabIndex = 0;
      sync();
      head.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        row.classList.toggle("open");
        sync();
      });
      new MutationObserver(sync).observe(row, { attributes: true, attributeFilter: ["class"] });
    }
  });

  /* ---------- deep links: open the archive/verdict row named in the URL hash ---------- */
  function openRowFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const row = document.getElementById(id);
    if (row && row.classList.contains("race-row") && !row.classList.contains("upcoming")) row.classList.add("open");
  }
  openRowFromHash();
  window.addEventListener("hashchange", openRowFromHash);

  /* ---------- homepage: session schedule status ----------
     Each <li> carries its official start (with timezone) and scheduled
     length; the status follows the visitor's clock. */
  const sessionList = document.querySelector("[data-sessions]");
  if (sessionList) {
    const items = sessionList.querySelectorAll("li[data-start]");
    function updateSessions() {
      const now = Date.now();
      let nextFlagged = false;
      items.forEach((li) => {
        const start = Date.parse(li.dataset.start);
        const end = start + (parseInt(li.dataset.mins, 10) || 60) * 60000;
        const statusEl = li.querySelector(".s-status");
        let label = "UPCOMING";
        let state = "upcoming";
        if (now >= end) { label = "COMPLETE"; state = "done"; }
        else if (now >= start) { label = "UNDERWAY"; state = "live"; nextFlagged = true; }
        else if (!nextFlagged) { label = "NEXT"; state = "next"; nextFlagged = true; }
        li.dataset.state = state;
        if (statusEl) statusEl.textContent = label;
      });
    }
    updateSessions();
    setInterval(updateSessions, 60000);
  }

  /* ---------- archive: filter tabs ---------- */
  const filterTabs = document.querySelectorAll(".filter-tab");
  const rows = document.querySelectorAll(".race-row");
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const filter = tab.getAttribute("data-filter");
      rows.forEach((row) => {
        const status = row.getAttribute("data-status");
        const matches = filter === "all" || filter === status;
        row.style.display = matches ? "" : "none";
      });
    });
  });

  /* ---------- archive: search ---------- */
  const searchBox = document.querySelector(".search-box");
  if (searchBox) {
    searchBox.addEventListener("input", () => {
      const q = searchBox.value.trim().toLowerCase();
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? "" : "none";
      });
      // reset filter tabs visually since search overrides
      if (q) filterTabs.forEach((t) => t.classList.remove("active"));
    });
  }

  /* ---------- about: animated stat counters ---------- */
  const counters = document.querySelectorAll("[data-count-to]");
  if (counters.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const to = parseInt(el.getAttribute("data-count-to"), 10);
          const suffix = el.getAttribute("data-suffix") || "";
          let current = 0;
          el.textContent = "0" + suffix; // JS takes over from here; markup already shows the real number for anyone/anything not running JS
          const step = Math.max(1, Math.ceil(to / 40));
          const iv = setInterval(() => {
            current += step;
            if (current >= to) {
              current = to;
              clearInterval(iv);
            }
            el.textContent = current + suffix;
          }, 25);
          observer.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((c) => observer.observe(c));
  }

  /* ---------- standings: tab switching ---------- */
  const standingsTabs = document.querySelectorAll(".standings-tab");
  if (standingsTabs.length) {
    standingsTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        standingsTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.getAttribute("data-panel");
        document.querySelectorAll(".standings-panel").forEach((p) => {
          p.classList.toggle("active", p.id === target);
        });
      });
    });
  }

  /* ---------- pit stop reaction game ---------- */
  const pitBtn = document.getElementById("pit-btn");
  if (pitBtn) {
    const bulbs = document.querySelectorAll("#light-rig .light-bulb");
    const statusEl = document.getElementById("pit-status");
    const resultEl = document.getElementById("pit-result");
    const timeEl = document.getElementById("pit-time");
    const gradeEl = document.getElementById("pit-grade");
    const bestEl = document.getElementById("pit-best");

    const BEST_KEY = "jp-pitstop-best";
    let state = "idle"; // idle | arming | waiting | live
    let goAt = 0;
    let timers = [];

    function clearTimers() {
      timers.forEach((t) => clearTimeout(t));
      timers = [];
    }

    function resetBulbs() {
      bulbs.forEach((b) => b.classList.remove("lit", "go"));
    }

    function showBest() {
      const best = localStorage.getItem(BEST_KEY);
      bestEl.textContent = best ? `Personal best: ${best} ms` : "";
    }
    showBest();

    function grade(ms) {
      if (ms < 150) return "Superhuman — real F1 drivers average ~200ms";
      if (ms < 220) return "F1 driver reflexes";
      if (ms < 350) return "Sharp reaction";
      if (ms < 500) return "Solid";
      if (ms < 800) return "A bit sleepy";
      return "Box, box... eventually";
    }

    function startSequence() {
      state = "arming";
      resetBulbs();
      resultEl.style.display = "none";
      pitBtn.disabled = true;
      statusEl.textContent = "Get ready…";

      bulbs.forEach((bulb, i) => {
        const t = setTimeout(() => {
          bulb.classList.add("lit");
          if (i === bulbs.length - 1) {
            state = "waiting";
            const delay = 600 + Math.random() * 2000;
            const t2 = setTimeout(() => {
              resetBulbs();
              state = "live";
              goAt = performance.now();
              statusEl.textContent = "GO!";
              pitBtn.disabled = false;
              pitBtn.textContent = "GO!";
              bulbs.forEach((b) => b.classList.add("go"));
            }, delay);
            timers.push(t2);
          }
        }, 700 + i * 550);
        timers.push(t);
      });
    }

    pitBtn.addEventListener("click", () => {
      if (state === "idle") {
        startSequence();
        pitBtn.textContent = "Wait for it…";
        return;
      }
      if (state === "live") {
        const reaction = Math.round(performance.now() - goAt);
        timeEl.textContent = reaction + " ms";
        gradeEl.textContent = grade(reaction);
        resultEl.style.display = "block";
        const best = parseInt(localStorage.getItem(BEST_KEY) || "999999", 10);
        if (reaction < best) localStorage.setItem(BEST_KEY, String(reaction));
        showBest();
        state = "idle";
        statusEl.textContent = "Nice one — go again?";
        pitBtn.textContent = "Go Again";
        pitBtn.disabled = false;
        resetBulbs();
        clearTimers();
      }
    });
  }

  /* ---------- contact form (static — mailto handoff) ---------- */
  const form = document.querySelector("#contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.querySelector("#name").value.trim();
      const email = form.querySelector("#email").value.trim();
      const message = form.querySelector("#message").value.trim();
      if (!name || !email || !message) return;
      const subject = encodeURIComponent(`Message from ${name} via JP Motorsport Journal`);
      const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
      window.location.href = `mailto:joshpenner49@gmail.com?subject=${subject}&body=${body}`;
      const note = document.querySelector(".form-note");
      if (note) note.classList.add("show");
    });
  }
});
