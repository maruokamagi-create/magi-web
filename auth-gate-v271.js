(() => {
  'use strict';

  const STYLE_ID = 'magi-auth-v286-style';
  const GATE_ID = 'magiAuthGate';
  let barRetry = 0;

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.magi-auth-pending body{visibility:hidden}
      html.magi-auth-locked body{overflow:hidden}
      .magiAuthGate{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(circle at 50% -10%,#183552 0,#071422 38%,#030910 100%);color:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;overflow:auto}
      .magiAuthCard{width:min(100%,440px);padding:26px 22px;border:1px solid #294868;border-radius:22px;background:rgba(8,24,41,.97);box-shadow:0 24px 70px rgba(0,0,0,.4)}
      .magiAuthBrand{display:flex;align-items:center;gap:12px;margin-bottom:18px}.magiAuthBrand img{width:58px;height:58px;object-fit:contain}.magiAuthBrand strong{display:block;font-size:28px;letter-spacing:.08em}.magiAuthBrand span{display:block;margin-top:3px;color:#9fb6cc;font-size:11px;letter-spacing:.04em}
      .magiAuthCard h1{margin:0 0 8px;font-size:22px}.magiAuthLead{margin:0 0 20px;color:#b6c9da;font-size:14px;line-height:1.7}
      .magiAuthLine{width:100%;min-height:54px;border:0;border-radius:12px;background:#06c755;color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:11px;text-decoration:none;box-sizing:border-box;box-shadow:0 8px 24px rgba(6,199,85,.18)}
      .magiAuthLineMark{width:25px;height:25px;border-radius:7px;background:#fff;color:#06c755;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:1000;letter-spacing:-.06em}
      .magiAuthStatus{min-height:20px;margin-top:12px;color:#9fb6cc;font-size:12px;line-height:1.6}.magiAuthStatus.error{color:#ff9ca6}.magiAuthStatus.ok{color:#77d6a7}
      .magiAuthNotice{padding:13px;border:1px solid #315574;border-left:4px solid #e3a512;border-radius:12px;background:#071827;color:#c9d8e6;font-size:13px;line-height:1.7}.magiAuthNotice strong{color:#fff}
      .magiAuthFoot{margin-top:14px;color:#7f98ae;font-size:11px;line-height:1.6}
      .magiAuthBar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 4px 10px;padding:9px 11px;border:1px solid #294868;border-radius:12px;background:rgba(7,24,39,.9);color:#bcd0e2;font-size:11px}.magiAuthBar b{color:#fff}.magiAuthBar button{min-height:36px;padding:7px 10px;border:1px solid #315574;border-radius:9px;background:#142d47;color:#d7e9fa;font-size:11px;font-weight:800}
      @media(max-width:430px){.magiAuthGate{align-items:flex-start;padding:18px 12px}.magiAuthCard{margin-top:5vh;padding:22px 18px}.magiAuthBrand strong{font-size:25px}}
    `;
    document.head.appendChild(style);
  }

  function gate() {
    let node = document.getElementById(GATE_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = GATE_ID;
      node.className = 'magiAuthGate';
      document.body.appendChild(node);
    }
    document.documentElement.classList.add('magi-auth-locked');
    document.documentElement.classList.remove('magi-auth-pending');
    return node;
  }

  function unlock() {
    document.getElementById(GATE_ID)?.remove();
    document.documentElement.classList.remove('magi-auth-locked', 'magi-auth-pending');
  }

  function brandMarkup() {
    return `<div class="magiAuthBrand"><img src="/magi-official-symbol-v125.svg?v=271" alt=""><div><strong>MAGI</strong><span>MARUOKA ADVANCED GAME INTELLIGENCE</span></div></div>`;
  }

  function renderConfigError() {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">${brandMarkup()}<h1>LINE認証を準備中です</h1><div class="magiAuthNotice"><strong>LINE Loginの設定を確認しています。</strong><br>管理者が設定を完了すると利用できます。</div></div>`;
  }

  function renderLogin(message = '') {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">
      ${brandMarkup()}
      <h1>MAGI-WEBにログイン</h1>
      <p class="magiAuthLead">LINEで本人確認してMAGI-WEBを利用します。</p>
      <a class="magiAuthLine" href="/api/auth/line/start"><span class="magiAuthLineMark">LINE</span><span>LINEでログイン</span></a>
      <div class="magiAuthStatus${message ? ' error' : ''}">${message}</div>
      <div class="magiAuthFoot">表示名ではなく、LINEの内部識別子で本人を識別します。</div>
    </div>`;
  }

  function addUserBar() {
    document.getElementById('magiAuthBar')?.remove();
    const hero = document.querySelector('.hero');
    if (!hero) {
      if (barRetry++ < 20) setTimeout(addUserBar, 100);
      return;
    }
    const bar = document.createElement('div');
    bar.id = 'magiAuthBar';
    bar.className = 'magiAuthBar';
    const identity = document.createElement('div');
    identity.append('認証：');
    const strong = document.createElement('b');
    strong.textContent = '丸岡中学校軟式野球部';
    identity.appendChild(strong);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'ログアウト';
    button.addEventListener('click', () => {
      button.disabled = true;
      try { if (typeof window.disconnectDrive === 'function') window.disconnectDrive(false); } catch (_) {}
      location.assign('/api/auth/line/logout');
    });
    bar.append(identity, button);
    hero.parentNode.insertBefore(bar, hero);
  }

  function clearLoginResultQuery() {
    try {
      const url = new URL(location.href);
      if (!url.searchParams.has('line_login')) return;
      url.searchParams.delete('line_login');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch (_) {}
  }

  async function init() {
    addStyles();
    try {
      const response = await fetch('/api/auth/line/session', { cache: 'no-store', credentials: 'same-origin' });
      const state = await response.json();
      if (!response.ok || !state?.ok) throw new Error('session_check_failed');
      if (!state.configured) {
        renderConfigError();
        return;
      }
      if (!state.authenticated) {
        const result = new URLSearchParams(location.search).get('line_login');
        const message = result === 'failed' || result === 'invalid_state' ? 'LINEログインを完了できませんでした。もう一度お試しください。' : '';
        renderLogin(message);
        return;
      }
      clearLoginResultQuery();
      unlock();
      addUserBar();
    } catch (error) {
      console.error('[MAGI LINE auth]', error?.message || error);
      renderLogin('ログイン状態を確認できませんでした。もう一度お試しください。');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();