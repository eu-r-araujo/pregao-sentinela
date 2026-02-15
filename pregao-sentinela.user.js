// ==UserScript==
// @name           Pregão Sentinela (Licitanet)
// @namespace      PS
// @version        0.3
// @description    Alertas de Telegram a partir do chat da sala de disputa (Licitanet)
// @author         Ronaldo Araújo
// @match          https://portal.licitanet.com.br/sala-disputa/*
// @run-at         document-end
// @grant          none
// ==/UserScript==

(() => {
  // ===== CONFIG =====
  const BOT_TOKEN = "8335643146:AAGjtAPgywLSflgcXrCzP37kFjSh19IKaik"; // @psalfbot

  const UL_SEL = "ul.chat-list";
  const ITEM_SEL = "li.mt-4";
  const ALVOS = [/^Sistema\b/i, /^Pregoeiro\(a\)\b/i];

  const LS_CHATID = "ps_chat_id";

  // dedup
  let lastKey = null;

  // observer
  let currentUL = null;
  let obs = null;

  const getChatId = () => (localStorage.getItem(LS_CHATID) || "").trim();
  const setChatId = (v) => localStorage.setItem(LS_CHATID, (v || "").trim());

  function ehAlvo(autor) {
    return ALVOS.some(rx => rx.test(autor));
  }

  function extrair(li) {
    const header = li.querySelector("h5")?.innerText?.trim() || "";
    const autor = header.split("-")[0]?.trim() || "";

    const corpo =
      li.querySelector(".message")?.innerText?.trim() ||
      li.innerText?.trim() ||
      "";

    const id =
      li.querySelector("[data-id-mensagem]")?.getAttribute("data-id-mensagem") ||
      li.getAttribute("data-id-mensagem") ||
      "";

    const key = id || (header + " | " + corpo.slice(0, 160));
    return { autor, header, corpo, key };
  }

  function pegarMaisRecente(ul) {
    const itens = ul.querySelectorAll(ITEM_SEL);
    if (!itens.length) return null;

    for (let i = 0; i < itens.length; i++) {
      const li = itens[i];
      const h = li.querySelector("h5")?.innerText?.trim();
      const txt = li.querySelector(".message")?.innerText?.trim() || li.innerText?.trim();
      if ((h && h.length) || (txt && txt.length > 3)) return li;
    }
    return itens[0];
  }

  async function sendTelegram(text) {
    const chatId = getChatId();
    if (!chatId) {
      console.log("⚠️ PS: Sem CHAT_ID salvo.");
      return false;
    }
    if (!BOT_TOKEN || BOT_TOKEN.includes("COLE_")) {
      console.log("❌ PS: Configure BOT_TOKEN no script.");
      return false;
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    };

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return r.ok;
    } catch (e) {
      console.log("❌ PS: Falha Telegram:", e);
      return false;
    }
  }

  function onboarding() {
    if (getChatId()) return;

    setTimeout(async () => {
      const v = prompt("Digite seu CHAT_ID do Telegram (ex: 6254583509):", "");
      if (v && v.trim()) {
        setChatId(v.trim());
        console.log("✅ PS: CHAT_ID salvo.");
        await sendTelegram("✅ Pregão Sentinela: Telegram configurado com sucesso.");
      } else {
        console.log("⚠️ PS: CHAT_ID não informado. Recarregue a página para tentar novamente.");
      }
    }, 700);
  }

  function montarTextoTelegram(m) {
    // Queremos exatamente o padrão que o analista já vê no chat:
    // "Sistema - 06/02/2026 10:16:52"
    const cabecalho = (m.header && m.header.length) ? m.header : m.autor;
    return `${cabecalho}\n\n${m.corpo}`.trim();
  }

  function processar(ul) {
    const li = pegarMaisRecente(ul);
    if (!li) return;

    const m = extrair(li);
    if (!ehAlvo(m.autor)) return;

    if (m.key !== lastKey) {
      lastKey = m.key;
      const text = montarTextoTelegram(m);
      console.log("📣 PS:", m.header || m.autor, "\n" + m.corpo);
      sendTelegram(text);
    }
  }

  function detach() {
    if (obs) obs.disconnect();
    obs = null;
    currentUL = null;
  }

  function attach(ul) {
    if (!ul) return;
    if (currentUL === ul && obs) return;

    detach();
    currentUL = ul;

    // inicializa dedup (não dispara histórico)
    const initLI = pegarMaisRecente(currentUL);
    if (initLI) lastKey = extrair(initLI).key || null;

    obs = new MutationObserver(() => processar(currentUL));
    obs.observe(currentUL, { childList: true, subtree: true });

    console.log("✅ PS: Observer ligado no chat.");
  }

  function loopAttach() {
    const ul = document.querySelector(UL_SEL);
    if (ul) attach(ul);
  }

  // ===== boot =====
  console.log("🟡 PS: carregou.");
  onboarding();

  loopAttach();
  setInterval(loopAttach, 800);
})();
