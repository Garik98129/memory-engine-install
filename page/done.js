// The page «it worked» (the engine's docs/DESIGN_PHASE3.md §5a): her AI's last message of setup links here
// (INSTALL-12, a rules' PR) — her AI never opens the link itself. The link carries her AI, her language and her
// country as the map holds them: done.html?p=chatgpt&l=ru&c=IL. One line goes to the counter only when she presses.

import { DATA } from "./data.js";
import { T } from "./i18n.js";
import { el, languageSwitch, setDirection, send, uiLanguage, TEST } from "./app.js";
import { line, doneAnswers } from "./build.js";

const params = new URLSearchParams(location.search);
// What she chose here — «sent» or «skipped» — kept outside a render: a change of language draws the page again, and
// her answer stands, so a second press cannot send a second line (as `sentOnce` on the setup page).
let ended = null;

function render(code) {
  const t = T[code];
  setDirection(code);
  document.title = t.done_title;
  const a = doneAnswers(params);
  const status = el("p", { class: "sent", role: "status" });
  const tell = el("button", { type: "button", class: "build", text: t.done_tell, disabled: !a || ended !== null });
  const skip = el("button", { type: "button", class: "build", text: t.done_skip, disabled: !a || ended !== null });
  const end = (how) => {
    ended = how;
    tell.disabled = true;
    skip.disabled = true;
    status.textContent = how === "sent" ? t.done_sent : t.done_skipped;
  };
  if (ended !== null) status.textContent = ended === "sent" ? t.done_sent : t.done_skipped;
  tell.addEventListener("click", () => {
    if (ended !== null) return;
    send(line("done", a, TEST));
    end("sent");
  });
  skip.addEventListener("click", () => end("skipped"));
  document.getElementById("app").replaceChildren(
    languageSwitch(code, (c) => {
      const url = new URL(location.href);
      url.searchParams.set("lang", c);
      history.replaceState(null, "", url);
      render(c);
    }),
    el("h1", { text: t.done_title }),
    el("p", { text: a ? t.done_text : t.done_bad }),
    el("div", { class: "buttons" }, tell, skip),
    status,
    el("footer", {}, el("p", { class: "hint", text: t.footer(DATA.release) })),
  );
}

render(uiLanguage());
