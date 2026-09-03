(() => {
  'use strict';

  const STYLE_ID = 'magi-auth-v287-style';
  const GATE_ID = 'magiAuthGate';
  const PANEL_ID = 'magiMemberPanel';
  let barRetry = 0;

  const roleLabel = (role) => ({ admin: '管理者', coach: '顧問', player: '選手', member: '許可利用者' }[role] || '許可利用者');
  const statusLabel = (status) => ({ pending: '承認待ち', active: '利用可', disabled: '利用停止' }[status] || status || '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

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
      .magiAuthFoot{margin-top:14px;color:#7f98ae;font-size:11px;line-height:1.6}.magiAuthSecondary{width:100%;min-height:46px;margin-top:10px;border:1px solid #315574;border-radius:11px;background:#142d47;color:#d7e9fa;font-size:14px;font-weight:800}
      .magiAuthBar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 4px 10px;padding:9px 11px;border:1px solid #294868;border-radius:12px;background:rgba(7,24,39,.9);color:#bcd0e2;font-size:11px}.magiAuthBarIdentity{min-width:0;flex:1}.magiAuthBar b{color:#fff}.magiAuthBarActions{display:flex;gap:6px;flex:0 0 auto}.magiAuthBar button{min-height:36px;padding:7px 10px;border:1px solid #315574;border-radius:9px;background:#142d47;color:#d7e9fa;font-size:11px;font-weight:800}
      .magiMemberPanel{position:fixed;inset:0;z-index:100500;background:rgba(1,8,14,.86);backdrop-filter:blur(8px);padding:16px;overflow:auto;color:#eef5fc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
      .magiMemberCard{width:min(100%,720px);margin:20px auto;padding:18px;border:1px solid #315574;border-radius:18px;background:#071827;box-shadow:0 28px 70px rgba(0,0,0,.42)}
      .magiMemberHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.magiMemberHead h2{margin:0;font-size:21px}.magiMemberClose{border:1px solid #315574;border-radius:9px;background:#142d47;color:#fff;min-width:40px;min-height:40px;font-size:20px}
      .magiMemberHelp{margin:0 0 14px;color:#9fb6cc;font-size:12px;line-height:1.6}.magiMemberList{display:grid;gap:9px}.magiMemberRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:12px;border:1px solid #24445f;border-radius:13px;background:#091f33}.magiMemberName{font-size:15px;font-weight:900;overflow-wrap:anywhere}.magiMemberMeta{margin-top:4px;color:#91a8bd;font-size:11px}.magiMemberControls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.magiMemberControls select,.magiMemberControls button{min-height:36px;border-radius:8px;border:1px solid #315574;background:#102b43;color:#fff;font-weight:800}.magiMemberControls select{padding:0 8px}.magiMemberControls button{padding:0 10px}.magiMemberControls .approve{border-color:#2d9d60;background:#0c4b31}.magiMemberControls .disable{border-color:#8f4e58;background:#4a1c25}.magiMemberBadge{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#16334d;color:#a9c7e1;font-size:10px}.magiMemberEmpty{padding:20px;text-align:center;color:#8ea6ba}.magiMemberError{padding:12px;border:1px solid #7b3a45;border-radius:10px;background:#35151b;color:#ffc4ca}
      @media(max-width:520px){.magiAuthGate{align-items:flex-start;padding:18px 12px}.magiAuthCard{margin-top:5vh;padding:22px 18px}.magiAuthBrand strong{font-size:25px}.magiAuthBarActions{gap:4px}.magiAuthBar button{padding:6px 8px}.magiMemberPanel{padding:9px}.magiMemberCard{margin:8px auto;padding:13px}.magiMemberRow{grid-template-columns:1fr}.magiMemberControls{justify-content:flex-start}}
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

  function renderConfigError(message = '管理者が設定を完了すると利用できます。') {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">${brandMarkup()}<h1>LINE認証を準備中です</h1><div class="magiAuthNotice"><strong>設定を確認しています。</strong><br>${esc(message)}</div></div>`;
  }

  function renderLogin(message = '') {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">
      ${brandMarkup()}
      <h1>MAGI-WEBにログイン</h1>
      <p class="magiAuthLead">LINEで本人確認してMAGI-WEBを利用します。</p>
      <a class="magiAuthLine" href="/api/auth/line/start"><span class="magiAuthLineMark">LINE</span><span>LINEでログイン</span></a>
      <div class="magiAuthStatus${message ? ' error' : ''}">${esc(message)}</div>
      <div class="magiAuthFoot">表示名ではなく、LINEの内部識別子で本人を識別します。</div>
    </div>`;
  }

  function renderPending(state) {
    const root = gate();
    const member = state.member || {};
    const name = member.displayName || state.user?.name || 'LINE認証済み';
    const disabled = member.status === 'disabled';
    root.innerHTML = `<div class="magiAuthCard">
      ${brandMarkup()}
      <h1>${disabled ? '現在は利用できません' : '管理者の承認待ちです'}</h1>
      <p class="magiAuthLead">${disabled ? 'このアカウントの利用は停止されています。管理者に確認してください。' : 'LINEでの本人確認は完了しています。管理者が利用を許可するとMAGI-WEBへ入れます。'}</p>
      <div class="magiAuthNotice"><strong>${esc(name)}</strong><br>状態：${esc(statusLabel(member.status))}</div>
      <button class="magiAuthSecondary" type="button" data-refresh>承認状態を再確認</button>
      <button class="magiAuthSecondary" type="button" data-logout>ログアウト</button>
    </div>`;
    root.querySelector('[data-refresh]').addEventListener('click', () => location.reload());
    root.querySelector('[data-logout]').addEventListener('click', () => location.assign('/api/auth/line/logout'));
  }

  async function memberAdminRequest(body = null) {
    const response = await fetch('/api/admin/line-members', {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || '利用者情報を取得できませんでした');
    return data;
  }

  async function openMemberPanel() {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'magiMemberPanel';
    panel.innerHTML = `<div class="magiMemberCard"><div class="magiMemberHead"><h2>利用者管理</h2><button class="magiMemberClose" type="button" aria-label="閉じる">×</button></div><p class="magiMemberHelp">初回LINEログインした人は「承認待ち」に入ります。本人を確認してから役割を選び、承認してください。</p><div class="magiMemberList"><div class="magiMemberEmpty">読み込み中…</div></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.magiMemberClose').addEventListener('click', () => panel.remove());
    panel.addEventListener('click', (event) => { if (event.target === panel) panel.remove(); });

    const list = panel.querySelector('.magiMemberList');
    const load = async () => {
      try {
        const data = await memberAdminRequest();
        const members = [...(data.members || [])].sort((a, b) => {
          const rank = { pending: 0, active: 1, disabled: 2 };
          return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        });
        if (!members.length) {
          list.innerHTML = '<div class="magiMemberEmpty">利用者はまだいません。</div>';
          return;
        }
        list.innerHTML = members.map((member) => {
          const options = ['admin','coach','player','member'].map((role) => `<option value="${role}"${role === member.role ? ' selected' : ''}>${roleLabel(role)}</option>`).join('');
          const mainAction = member.status === 'pending' ? '<button class="approve" type="button" data-action="approve">承認</button>' : member.status === 'disabled' ? '<button class="approve" type="button" data-action="approve">再許可</button>' : '<button type="button" data-action="update">役割更新</button>';
          const disable = member.status === 'active' && !member.isSelf ? '<button class="disable" type="button" data-action="disable">利用停止</button>' : '';
          return `<div class="magiMemberRow" data-id="${esc(member.id)}"><div><div class="magiMemberName">${esc(member.display_name || '名前未取得')}${member.isSelf ? '<span class="magiMemberBadge">自分</span>' : ''}</div><div class="magiMemberMeta">${esc(statusLabel(member.status))} ・ ${esc(roleLabel(member.role))}</div></div><div class="magiMemberControls"><select data-role ${member.isSelf ? 'disabled' : ''}>${options}</select>${member.isSelf ? '' : mainAction}${disable}</div></div>`;
        }).join('');

        list.querySelectorAll('[data-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const row = button.closest('.magiMemberRow');
            const id = row?.dataset.id;
            const role = row?.querySelector('[data-role]')?.value || 'member';
            const action = button.dataset.action;
            const status = action === 'disable' ? 'disabled' : 'active';
            button.disabled = true;
            try {
              await memberAdminRequest({ id, role, status });
              await load();
            } catch (error) {
              alert(error?.message || '更新できませんでした');
              button.disabled = false;
            }
          });
        });
      } catch (error) {
        list.innerHTML = `<div class="magiMemberError">${esc(error?.message || '利用者情報を取得できませんでした')}</div>`;
      }
    };
    await load();
  }

  function addUserBar(state) {
    document.getElementById('magiAuthBar')?.remove();
    const hero = document.querySelector('.hero');
    if (!hero) {
      if (barRetry++ < 25) setTimeout(() => addUserBar(state), 100);
      return;
    }
    const bar = document.createElement('div');
    bar.id = 'magiAuthBar';
    bar.className = 'magiAuthBar';
    const identity = document.createElement('div');
    identity.className = 'magiAuthBarIdentity';
    identity.append('認証：');
    const strong = document.createElement('b');
    strong.textContent = state.member?.displayName || state.user?.name || 'LINE認証済み';
    identity.appendChild(strong);
    if (state.member?.role) identity.append(` / ${roleLabel(state.member.role)}`);

    const actions = document.createElement('div');
    actions.className = 'magiAuthBarActions';
    if (state.memberStoreConfigured && state.member?.status === 'active' && state.member?.role === 'admin') {
      const manage = document.createElement('button');
      manage.type = 'button';
      manage.textContent = '利用者管理';
      manage.addEventListener('click', openMemberPanel);
      actions.appendChild(manage);
    }
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'ログアウト';
    logout.addEventListener('click', () => {
      logout.disabled = true;
      try { if (typeof window.disconnectDrive === 'function') window.disconnectDrive(false); } catch (_) {}
      location.assign('/api/auth/line/logout');
    });
    actions.appendChild(logout);
    bar.append(identity, actions);
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
      if (!response.ok || !state?.ok) throw new Error(state?.error || 'session_check_failed');
      if (!state.configured) return renderConfigError();
      if (!state.authenticated) {
        const result = new URLSearchParams(location.search).get('line_login');
        const message = result === 'failed' || result === 'invalid_state' ? 'LINEログインを完了できませんでした。もう一度お試しください。' : '';
        return renderLogin(message);
      }

      clearLoginResultQuery();
      if (state.memberStoreConfigured && (!state.member || state.member.status !== 'active')) {
        return renderPending(state);
      }

      unlock();
      addUserBar(state);
    } catch (error) {
      console.error('[MAGI LINE auth]', error?.message || error);
      renderConfigError('利用者情報を確認できませんでした。少し待ってから再読み込みしてください。');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
