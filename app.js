const THEMES = ["dark", "pastel", "matcha", "y2k", "sunset", "espresso", "cyber", "cloud"];
const K = { accounts: "cmmAccounts_v1", user: "cmmCurrentUser_v1", guest: "cmmGuestData_v1" };
const $ = s => document.querySelector(s);
let mode = "login", toastTimer;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = dateKey(new Date());

function read(k, fallback) {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    $("#saveStatus").textContent = "Saved on this device";
  } catch {
    $("#saveStatus").textContent = "Could not save";
    toast("Browser storage is unavailable.");
  }
}

function user() {
  try {
    return localStorage.getItem(K.user) || "";
  } catch {
    return "";
  }
}

function dataKey() {
  return user() ? `cmmData_${user().toLowerCase()}` : K.guest;
}

function getData() {
  const d = read(dataKey(), {});
  return {
    movies: Array.isArray(d.movies) ? d.movies : [],
    theme: THEMES.includes(d.theme) ? d.theme : "dark"
  };
}

function save(d) {
  write(dataKey(), d);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayKey() {
  return dateKey(new Date());
}

function prettyDate(
  key,
  options = { month: "long", day: "numeric", year: "numeric" }
) {
  return parseDate(key).toLocaleDateString(undefined, options);
}

function theme(t, saveIt = true) {
  if (!THEMES.includes(t)) t = "dark";

  document.body.dataset.theme = t;
  $("#theme").value = t;

  if (saveIt) {
    const d = getData();
    d.theme = t;
    save(d);
  }
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2200);
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

/* MOVIE CARD */

function card(m) {
  const r = Number(m.rating) || 0;

  return `
    <article class="movie-card">
      <div class="movie-top">
        <div class="movie-poster">▶</div>

        <div>
          <div class="movie-title">${esc(m.title)}</div>

          <div class="meta">
            ${[m.year, m.genre].filter(Boolean).map(esc).join(" · ") || "Movie night pick"}
          </div>

          ${
            m.status === "watched" && m.watchedAt
              ? `<div class="meta">Watched ${esc(
                  prettyDate(m.watchedAt, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                )}</div>`
              : ""
          }
        </div>
      </div>

      ${
        r
          ? `<div class="rating" aria-label="${r} out of 5">
              ${"★".repeat(r)}${"☆".repeat(5 - r)}
            </div>`
          : ""
      }

      ${m.notes ? `<div class="notes">${esc(m.notes)}</div>` : ""}

      <div class="movie-actions">
        ${
          m.status === "next"
            ? `<button class="small" data-act="watched" data-id="${esc(m.id)}">
                ✓ Mark watched
              </button>`
            : `<button class="small" data-act="next" data-id="${esc(m.id)}">
                ↶ Move to next
              </button>`
        }

        <button class="small" data-act="edit" data-id="${esc(m.id)}">
          Edit
        </button>

        <button class="small danger" data-act="delete" data-id="${esc(m.id)}">
          Delete
        </button>
      </div>
    </article>
  `;
}

/* RENDER MOVIE LISTS AND STATS */

function render() {
  const d = getData();

  const n = d.movies.filter(m => m.status === "next");
  const w = d.movies.filter(m => m.status === "watched");
  const r = w.filter(m => Number(m.rating) > 0);

  $("#nextList").innerHTML = n.map(card).join("");
  $("#watchedList").innerHTML = w.map(card).join("");

  $("#nextEmpty").hidden = !!n.length;
  $("#watchedEmpty").hidden = !!w.length;

  $("#nextCount").textContent = $("#nextNum").textContent = n.length;
  $("#watchedCount").textContent = $("#watchedNum").textContent = w.length;

  $("#average").textContent = r.length
    ? (
        r.reduce((s, m) => s + Number(m.rating), 0) / r.length
      ).toFixed(1) + "/5"
    : "—";

  $("#greeting").textContent = user()
    ? `Welcome to your shelf, ${user()}.`
    : "A little order for movie night.";

  $("#accountBtn").textContent = user()
    ? `Hi, ${user()} · Sign out`
    : "Sign in";

  renderCalendar();
}

/* ADD OR EDIT A MOVIE */

function openMovie(status = "next", m = null) {
  $("#movieForm").reset();

  $("#movieId").value = m?.id || "";
  $("#title").value = m?.title || "";
  $("#year").value = m?.year || "";
  $("#genre").value = m?.genre || "";
  $("#notes").value = m?.notes || "";
  $("#rating").value = m?.rating || "";
  $("#status").value = m?.status || status;

  $("#watchedDate").value = m?.watchedAt || todayKey();

  updateWatchedFields();

  $("#movieDialogTitle").textContent = m
    ? "Edit movie"
    : "Add a movie";

  $("#movieDialog").showModal();
  $("#title").focus();
}

function updateWatchedFields() {
  const watched = $("#status").value === "watched";

  $("#ratingLabel").hidden = !watched;
  $("#watchedDateLabel").hidden = !watched;

  if (watched && !$("#watchedDate").value) {
    $("#watchedDate").value = todayKey();
  }
}

/* WATCH CALENDAR — FIX ADDED HERE */

function renderCalendar() {
  // Check that the calendar elements actually exist before using them.
  const monthHeading = $("#calendarMonth");
  const calendarGrid = $("#calendarGrid");

  if (!monthHeading || !calendarGrid) {
    console.error(
      "Calendar elements missing. Check index.html and make sure the correct tracker page is loaded."
    );
    return;
  }

  const d = getData();

  const watched = d.movies.filter(
    m => m.status === "watched" && m.watchedAt
  );

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  monthHeading.textContent = calendarMonth.toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric"
    }
  );

  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  let html = "";

  for (let i = 0; i < 42; i++) {
    let day;
    let date;
    let outside = false;

    if (i < startOffset) {
      day = prevDays - startOffset + i + 1;
      date = new Date(year, month - 1, day);
      outside = true;
    } else if (i >= startOffset + days) {
      day = i - startOffset - days + 1;
      date = new Date(year, month + 1, day);
      outside = true;
    } else {
      day = i - startOffset + 1;
      date = new Date(year, month, day);
    }

    const key = dateKey(date);

    const movies = watched.filter(
      m => m.watchedAt === key
    );

    const classes = [
      "calendar-cell",
      outside ? "outside" : "",
      key === selectedDate ? "selected" : "",
      key === todayKey() ? "today" : "",
      movies.length ? "has-movies" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button
        type="button"
        class="${classes}"
        role="gridcell"
        aria-label="${esc(prettyDate(key))}${
          movies.length
            ? `, ${movies.length} movie${
                movies.length === 1 ? "" : "s"
              } watched`
            : ""
        }"
        aria-pressed="${key === selectedDate}"
        data-date="${key}">

        <span class="calendar-day-number">
          ${day}
        </span>

        ${
          movies.length
            ? `
              <span class="calendar-dots" aria-hidden="true">
                <span class="calendar-dot"></span>
                ${
                  movies.length > 1
                    ? `<span class="calendar-count">+${movies.length - 1}</span>`
                    : ""
                }
              </span>
            `
            : ""
        }
      </button>
    `;
  }

  calendarGrid.innerHTML = html;

  const selectedMovies = watched.filter(
    m => m.watchedAt === selectedDate
  );

  $("#selectedDateTitle").textContent = prettyDate(selectedDate);

  $("#selectedDateCount").textContent =
    `${selectedMovies.length} movie${selectedMovies.length === 1 ? "" : "s"}`;

  $("#calendarDayMovies").innerHTML = selectedMovies.map(m => `
    <article class="day-movie">
      <strong>${esc(m.title)}</strong>

      <span>
        ${
          [m.year, m.genre].filter(Boolean).map(esc).join(" · ") || "Movie night"
        }${
          Number(m.rating)
            ? ` · ${"★".repeat(Number(m.rating))}`
            : ""
        }
      </span>

      <button
        type="button"
        class="small"
        data-calendar-edit="${esc(m.id)}">
        Edit movie
      </button>
    </article>
  `).join("");

  $("#calendarDayEmpty").hidden = !!selectedMovies.length;

  $("#calendarDayEmpty").textContent = selectedMovies.length
    ? ""
    : "No movies recorded for this day yet. Mark a movie as watched or add one with this watch date.";
}

/* THEME AND PAGE BUTTONS */

$("#theme").addEventListener("change", e => {
  theme(e.target.value);
});

$("#addTop").addEventListener("click", () => {
  openMovie();
});

/* MOVIE ACTIONS */

document.addEventListener("click", e => {
  const add = e.target.closest("[data-add]");

  if (add) {
    openMovie(add.dataset.add);
  }

  const close = e.target.closest("[data-close]");

  if (close) {
    $("#" + close.dataset.close).close();
  }

  const day = e.target.closest("[data-date]");

  if (day) {
    selectedDate = day.dataset.date;

    const dt = parseDate(selectedDate);

    calendarMonth = new Date(
      dt.getFullYear(),
      dt.getMonth(),
      1
    );

    renderCalendar();
    return;
  }

  const calEdit = e.target.closest("[data-calendar-edit]");

  if (calEdit) {
    const m = getData().movies.find(
      x => x.id === calEdit.dataset.calendarEdit
    );

    if (m) {
      openMovie(m.status, m);
    }

    return;
  }

  const b = e.target.closest("[data-act]");

  if (!b) return;

  const d = getData();

  const m = d.movies.find(
    x => x.id === b.dataset.id
  );

  if (!m) return;

  if (b.dataset.act === "edit") {
    openMovie(m.status, m);
    return;
  }

  if (b.dataset.act === "delete") {
    if (!confirm(`Delete "${m.title}"?`)) return;

    d.movies = d.movies.filter(
      x => x.id !== m.id
    );
  } else if (b.dataset.act === "watched") {
    m.status = "watched";
    m.watchedAt = todayKey();
    m.rating = "";

    selectedDate = m.watchedAt;

    calendarMonth = new Date();
    calendarMonth.setDate(1);
  } else {
    m.status = "next";
    m.rating = "";

    delete m.watchedAt;
  }

  save(d);
  render();
  toast("Your list has been updated.");
});

/* CALENDAR NAVIGATION */

$("#prevMonth").addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() - 1,
    1
  );

  renderCalendar();
});

$("#nextMonth").addEventListener("click", () => {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1
  );

  renderCalendar();
});

$("#todayMonth").addEventListener("click", () => {
  const now = new Date();

  calendarMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  selectedDate = todayKey();

  renderCalendar();
});

/* MOVIE FORM SUBMISSION */

$("#status").addEventListener(
  "change",
  updateWatchedFields
);

$("#movieForm").addEventListener("submit", e => {
  e.preventDefault();

  const d = getData();

  const id = $("#movieId").value || (
    crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now())
  );

  const old = d.movies.find(m => m.id === id);
  const status = $("#status").value;

  const m = {
    id,
    title: $("#title").value.trim(),
    year: $("#year").value,
    genre: $("#genre").value.trim(),
    notes: $("#notes").value.trim(),
    status,
    rating: status === "watched"
      ? $("#rating").value
      : "",
    createdAt: old?.createdAt || Date.now()
  };

  if (status === "watched") {
    m.watchedAt =
      $("#watchedDate").value ||
      old?.watchedAt ||
      todayKey();

    selectedDate = m.watchedAt;

    const dt = parseDate(selectedDate);

    calendarMonth = new Date(
      dt.getFullYear(),
      dt.getMonth(),
      1
    );
  }

  if (!m.title) {
    toast("Please enter a movie title.");
    $("#title").focus();
    return;
  }

  const i = d.movies.findIndex(
    x => x.id === id
  );

  if (i < 0) {
    d.movies.unshift(m);
  } else {
    d.movies[i] = m;
  }

  save(d);

  $("#movieDialog").close();

  render();

  toast(old ? "Movie updated." : "Movie saved.");
});

/* ACCOUNT DIALOG */

function accountDialog(m = "login") {
  mode = m;

  $("#accountForm").reset();
  $("#accountError").textContent = "";

  updateMode();

  $("#accountDialog").showModal();
}

function updateMode() {
  const reg = mode === "register";

  $("#accountTitle").textContent = reg
    ? "Create your profile"
    : "Welcome back";

  $("#accountIntro").textContent = reg
    ? "Create a separate profile for this browser."
    : "Sign in to a profile saved in this browser.";

  $("#accountSubmit").textContent = reg
    ? "Create profile"
    : "Sign in";

  $("#switchPrompt").textContent = reg
    ? "Already have a profile?"
    : "New here?";

  $("#switchMode").textContent = reg
    ? "Sign in"
    : "Create a profile";

  $("#password").autocomplete = reg
    ? "new-password"
    : "current-password";
}

$("#switchMode").addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";

  $("#accountError").textContent = "";

  updateMode();
});

/* PASSWORD HASHING */

async function hash(p, s) {
  if (!crypto.subtle) {
    throw Error(
      "Password hashing needs HTTPS or localhost. Use GitHub Pages to run this app."
    );
  }

  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(p),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const b = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(s),
      iterations: 120000,
      hash: "SHA-256"
    },
    k,
    256
  );

  return [...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

/* SIGN IN AND CREATE PROFILE */

$("#accountForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("#username").value.trim();
  const pass = $("#password").value;
  const err = $("#accountError");

  err.textContent = "";

  if (!/^[a-zA-Z0-9_-]{3,24}$/.test(name)) {
    err.textContent = "Username: 3–24 letters, numbers, _ or -.";
    return;
  }

  if (pass.length < 6) {
    err.textContent = "Password must be at least 6 characters.";
    return;
  }

  const accounts = read(K.accounts, {});
  const key = name.toLowerCase();

  try {
    if (mode === "register") {
      if (accounts[key]) {
        err.textContent = "That username already exists in this browser.";
        return;
      }

      const salt = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

      accounts[key] = {
        username: name,
        salt,
        hash: await hash(pass, salt)
      };

      write(K.accounts, accounts);

      write(`cmmData_${key}`, {
        movies: [],
        theme: "dark"
      });

      toast("Profile created.");
    } else {
      const a = accounts[key];

      if (!a || await hash(pass, a.salt) !== a.hash) {
        err.textContent = "Username or password is incorrect.";
        return;
      }

      toast("Signed in.");
    }

    localStorage.setItem(K.user, name);

    $("#accountDialog").close();

    theme(getData().theme, false);
    render();

  } catch (ex) {
    err.textContent = ex.message || "Could not open profile.";
  }
});

/* SIGN OUT */

function signOut() {
  localStorage.removeItem(K.user);

  theme("dark", false);
  render();

  toast("Signed out. Guest list is available.");
}

$("#accountBtn").addEventListener("click", () => {
  if (user()) {
    if (confirm("Sign out? Your profile stays saved in this browser.")) {
      signOut();
    }
  } else {
    accountDialog("login");
  }
});

$("#profileBtn").addEventListener("click", () => {
  accountDialog(user() ? "login" : "register");
});

/* CLOSE DIALOGS WHEN CLICKING OUTSIDE */

document.querySelectorAll("dialog").forEach(d => {
  d.addEventListener("click", e => {
    if (e.target === d) {
      d.close();
    }
  });
});

/* START THE TRACKER */

theme(getData().theme || "dark", false);
render();


/* Random Movie Picker */
const randomPickBtn = $("#randomPickBtn");

if (randomPickBtn) {
  randomPickBtn.addEventListener("click", () => {
    const result = $("#randomPickResult");

    const choices = getData().movies.filter(movie =>
      movie.status === "next" && movie.title?.trim()
    );

    if (choices.length === 0) {
      result.textContent =
        "Your Next to Watch list is empty. Add a movie first!";
      return;
    }

    const pick = choices[Math.floor(Math.random() * choices.length)];

    const details = [pick.year, pick.genre].filter(Boolean).join(" · ");

    result.textContent = `🍿 Tonight's pick: ${pick.title}${
      details ? ` (${details})` : ""
    }`;
  });
}
