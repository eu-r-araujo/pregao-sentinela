// ==UserScript==
// @name         Pregão Sentinela (Licitanet)
// @namespace    PS
// @version      0.6
// @description  Alertas a partir do chat da sala de disputa e renovação de sessão (Licitanet)
// @author       Ronaldo Araújo
// @match        https://portal.licitanet.com.br/sala-disputa/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://raw.githubusercontent.com/eu-r-araujo/pregao-sentinela/main/pregao-sentinela.user.js
// @downloadURL  https://raw.githubusercontent.com/eu-r-araujo/pregao-sentinela/main/pregao-sentinela.user.js
// ==/UserScript==

(() => {

  // ================= CONFIG =================
  const BOT_TOKEN = "8335643146:AAGjtAPgywLSflgcXrCzP37kFjSh19IKaik"; // @psalfbot
  const UL_SEL   = "ul.chat-list";
  const ITEM_SEL = "li.mt-4";
  const ALVOS    = [/^Sistema\b/i, /^Pregoeiro\(a\)\b/i];

  const LS_CHATID = "ps_chat_id";

  // ===== AUTO RENEW SELECTORS (SEU PADRÃO) =====
  const TIMER_SEL = "#time-session";
  const BTN_SEL   = "#btn-renova-sessao";

  // dedup
  let lastKey = null;

  // observer
  let currentUL = null;
  let obs = null;

  let renewFired = false;

  const getChatId = () => (localStorage.getItem(LS_CHATID) || "").trim();
  const setChatId = (v) => localStorage.setItem(LS_CHATID, (v || "").trim());

  function ehAlvo(autor){
    return ALVOS.some(rx => rx.test(autor));
  }

  function extrair(li){

    const header = li.querySelector("h5")?.innerText?.trim() || "";
    const autor  = header.split("-")[0]?.trim() || "";

    const corpo =
      li.querySelector(".message")?.innerText?.trim() ||
      li.innerText?.trim() ||
      "";

    const id =
      li.querySelector("[data-id-mensagem]")?.getAttribute("data-id-mensagem") ||
      li.getAttribute("data-id-mensagem") ||
      "";

    const key = id || (header + " | " + corpo.slice(0,160));

    return {autor, header, corpo, key};
  }

  function pegarMaisRecente(ul){

    const itens = ul.querySelectorAll(ITEM_SEL);
    if(!itens.length) return null;

    for(let i=0;i<itens.length;i++){
      const li = itens[i];
      const h  = li.querySelector("h5")?.innerText?.trim();
      const txt = li.querySelector(".message")?.innerText?.trim() || li.innerText?.trim();
      if((h && h.length) || (txt && txt.length>3)) return li;
    }
    return itens[0];
  }

  async function sendTelegram(text){

    const chatId = getChatId();
    if(!chatId) return false;

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    };

    try{
      const r = await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      return r.ok;
    }catch(e){
      console.log("❌ PS: Falha Telegram:",e);
      return false;
    }
  }

  function onboarding(){

    if(getChatId()) return;

    setTimeout(async()=>{

      const v = prompt("\nDigite seu CHAT_ID do Telegram:", "");
      if(v && v.trim()){
        setChatId(v.trim());
        console.log("✅ PS: CHAT_ID salvo.");
        await sendTelegram("✅ Pregão Sentinela configurado.");
      }

    },700);
  }

  function montarTextoTelegram(m){
    const cabecalho = (m.header && m.header.length) ? m.header : m.autor;
    return `${cabecalho}\n\n${m.corpo}`.trim();
  }

  function processar(ul){

    const li = pegarMaisRecente(ul);
    if(!li) return;

    const m = extrair(li);
    if(!ehAlvo(m.autor)) return;

    if(m.key !== lastKey){

      lastKey = m.key;

      const text = montarTextoTelegram(m);
      console.log("📣 PS:", text);

      sendTelegram(text);
    }
  }

  function detach(){
    if(obs) obs.disconnect();
    obs = null;
    currentUL = null;
  }

  function attach(ul){

    if(!ul) return;
    if(currentUL === ul && obs) return;

    detach();
    currentUL = ul;

    const initLI = pegarMaisRecente(currentUL);
    if(initLI) lastKey = extrair(initLI).key || null;

    obs = new MutationObserver(()=>processar(currentUL));
    obs.observe(currentUL,{childList:true,subtree:true});

    console.log("✅ PS: Observer ligado.");
  }

  function loopAttach(){
    const ul = document.querySelector(UL_SEL);
    if(ul) attach(ul);
  }

  // =====================
  // 🔄 ROTINA ORIGINAL DE RENOVAÇÃO (NÃO ALTERADA)
  // =====================

  function getTimer(){
    return (document.querySelector(TIMER_SEL)?.textContent || "").trim();
  }

  function renovar(){

    const btn = document.querySelector(BTN_SEL);

    if(btn){
      btn.click();
      console.log("🔄 PS: sessão renovada");
      return true;
    }
    return false;
  }

  setInterval(()=>{

    const t = getTimer();
    if(!t) return;

    // reset quando volta perto de 2h
    if(t.startsWith("02:")) renewFired = false;

    // SEU GATILHO ORIGINAL
    if(!renewFired && t.startsWith("00:10")){
      if(renovar()){
        renewFired = true;

        // 🔥 INJEÇÃO DO TG SEM ALTERAR LÓGICA
        sendTelegram(`🔄  Sessão Renovada Automaticamente!`);
      }
    }

  },2000);

  // ===== boot =====
  console.log("🟡 PS carregado.");
  onboarding();

  loopAttach();
  setInterval(loopAttach,800);

})();
