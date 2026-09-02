(() => {
  'use strict';

  const STYLE_ID = 'magi-auth-v271-style';
  const GATE_ID = 'magiAuthGate';
  const config = window.MAGI_AUTH_CONFIG || {};
  let client = null;
  let authSubscription = null;
  let rendering = false;

  function returnUrl() {
    return `${location.origin}/`;
  }

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
      .magiAuthGoogle,.magiAuthSubmit,.magiAuthSecondary{width:100%;min-height:50px;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer}
      .magiAuthGoogle{display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #d7e0e8;background:#fff;color:#142033}.magiAuthGoogle svg{width:20px;height:20px}
      .magiAuthDivider{display:flex;align-items:center;gap:10px;margin:18px 0;color:#7f98ae;font-size:11px}.magiAuthDivider:before,.magiAuthDivider:after{content:"";height:1px;flex:1;background:#29445d}
      .magiAuthLabel{display:block;margin-bottom:7px;color:#d9e6f2;font-size:13px;font-weight:700}.magiAuthInput{width:100%;min-height:50px;padding:12px 13px;border:1px solid #31516e;border-radius:12px;background:#061522;color:#fff;font:inherit;font-size:16px;outline:none}.magiAuthInput:focus{border-color:#5d94ce;box-shadow:0 0 0 3px rgba(63,134,255,.14)}
      .magiAuthSubmit{margin-top:10px;border:0;background:#dce8f3;color:#07111f}.magiAuthSecondary{margin-top:10px;border:1px solid #315574;background:#142d47;color:#d7e9fa}.magiAuthGoogle:disabled,.magiAuthSubmit:disabled,.magiAuthSecondary:disabled{opacity:.55;cursor:wait}
      .magiAuthStatus{min-height:20px;margin-top:12px;color:#9fb6cc;font-size:12px;line-height:1.6}.magiAuthStatus.error{color:#ff9ca6}.magiAuthStatus.ok{color:#77d6a7}
      .magiAuthNotice{padding:13px;border:1px solid #315574;border-left:4px solid #e3a512;border-radius:12px;background:#071827;color:#c9d8e6;font-size:13px;line-height:1.7}.magiAuthNotice strong{color:#fff}.magiAuthIdentity{margin-top:12px;color:#8fa8be;font-size:11px;word-break:break-all}
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

  function setBusy(root, busy) {
    root.querySelectorAll('button,input').forEach((el) => { el.disabled = busy; });
  }

  function setStatus(root, message, type = '') {
    const status = root.querySelector('[data-auth-status]');
    if (!status) return;
    status.textContent = message;
    status.className = `magiAuthStatus${type ? ` ${type}` : ''}`;
  }

  function brandMarkup() {
    return `<div class="magiAuthBrand"><img src="/magi-official-symbol-v125.svg?v=271" alt=""><div><strong>MAGI</strong><span>MARUOKA ADVANCED GAME INTELLIGENCE</span></div></div>`;
  }

  function renderConfigError(message) {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">${brandMarkup()}<h1>認証設定を準備中です</h1><div class="magiAuthNotice"><strong>まだ公開前の設定が残っています。</strong><br>${message}</div></div>`;
  }

  function renderLogin(message = '') {
    const root = gate();
    root.innerHTML = `<div class="magiAuthCard">
      ${brandMarkup()}
      <h1>チームアカウントでログイン</h1>
      <p class="magiAuthLead">Google、またはメールアドレスで本人確認します。初回ログイン後は管理者の承認が必要です。</p>
      <button type="button" class="magiAuthGoogle" data-google-login aria-label="Googleで続行">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.32 2.98-7.42Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.07 12c0-.67.12-1.33.32-1.93V7.45H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.55l3.34-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.45l3.34 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
        Googleで続行
      </button>
      <div class="magiAuthDivider">または</div>
      <form data-email-form>
        <label class="magiAuthLabel" for="magiAuthEmail">メールアドレス</label>
        <input class="magiAuthInput" id="magiAuthEmail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" required>
        <button type="submit" class="magiAuthSubmit">ログインリンクを受け取る</button>
      </form>
      <div class="magiAuthStatus${message ? ' error' : ''}" data-auth-status>${message}</div>
    </div>`;

    root.querySelector('[data-google-login]').addEventListener('click', async () => {
      setBusy(root, true);
      setStatus(root, 'Googleのログイン画面を開いています…');
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: returnUrl() }
      });
      if (error) {
        setBusy(root, false);
        setStatus(root, `Googleログインを開始できませんでした：${error.message}`, 'error');
      }
    });

    root.querySelector('[data-email-form]').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = String(new FormData(event.currentTarget).get('email') || '').trim();
      if (!email) return;
      setBusy(root, true);
      setStatus(root, 'ログイン用メールを送信しています…');
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: returnUrl(), shouldCreateUser: true }
      });
      setBusy(root, false);
      if (error) {
        setStatus(root, `メールを送信できませんでした：${error.message}`, 'error');
        return;
      }
      event.currentTarget.reset();
      setStatus(root, 'メールを送信しました。届いたログインリンクを開いてください。', 'ok');
    });
  }

  function renderPending(user, profile, errorMessage = '') {
    const root = gate();
    const email = String(user?.email || 'メールアドレス未取得');
    root.innerHTML = `<div class="magiAuthCard">
      ${brandMarkup()}
      <h1>${errorMessage ? '利用登録を確認できません' : '管理者の承認待ちです'}</h1>
      <p class="magiAuthLead">${errorMessage || '本人確認後にMAGIを利用できるようになります。承認されるまで、この画面のままで問題ありません。'}</p>
      <div class="magiAuthNotice"><strong>ログイン済み</strong><br>${email.replace(/[&<>"']/g, '')}<br>状態：${profile?.status === 'disabled' ? '利用停止' : '承認待ち'}</div>
      <button type="button" class="magiAuthSecondary" data-refresh>承認状態を再確認</button>
      <button type="button" class="magiAuthSecondary" data-logout>別のアカウントでログイン</button>
      <div class="magiAuthStatus" data-auth-status></div>
      <div class="magiAuthIdentity">本人確認ID：${String(user?.id || '')}</div>
    </div>`;
    root.querySelector('[data-refresh]').addEventListener('click', () => renderCurrentState());
    root.querySelector('[data-logout]').addEventListener('click', async () => {
      setBusy(root, true);
      await client.auth.signOut();
      renderLogin();
    });
  }

  function addUserBar(user, profile) {
    document.getElementById('magiAuthBar')?.remove();
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const bar = document.createElement('div');
    bar.id = 'magiAuthBar';
    bar.className = 'magiAuthBar';
    const identity = document.createElement('div');
    const name = String(profile?.display_name || user?.email || 'ログイン済み');
    identity.append('認証：');
    const strong = document.createElement('b');
    strong.textContent = name;
    identity.appendChild(strong);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'ログアウト';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { if (typeof window.disconnectDrive === 'function') window.disconnectDrive(false); } catch (_) {}
      await client.auth.signOut();
      location.replace(returnUrl());
    });
    bar.append(identity, button);
    hero.parentNode.insertBefore(bar, hero);
  }

  async function renderCurrentState() {
    if (rendering) return;
    rendering = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.user) {
        renderLogin(error ? 'ログイン状態を確認できませんでした。もう一度お試しください。' : '');
        return;
      }
      const user = data.session.user;
      const { data: profile, error: profileError } = await client
        .from('magi_members')
        .select('status,role,display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileError) {
        renderPending(user, null, '承認情報を確認できませんでした。管理者に連絡してください。');
        return;
      }
      if (!profile || profile.status !== 'active') {
        renderPending(user, profile);
        return;
      }
      unlock();
      addUserBar(user, profile);
    } finally {
      rendering = false;
    }
  }

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase?.createClient) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('認証ライブラリを読み込めませんでした'));
      document.head.appendChild(script);
    });
  }

  async function init() {
    addStyles();
    if (!config.supabaseUrl || !config.publishableKey || config.publishableKey.includes('__SUPABASE_')) {
      renderConfigError('Supabaseの公開用キーを設定すると、ログイン画面を有効化できます。');
      return;
    }
    try {
      await loadSupabase();
      client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.MAGI_SUPABASE = client;
      await renderCurrentState();
      const { data } = client.auth.onAuthStateChange(() => {
        setTimeout(() => renderCurrentState(), 0);
      });
      authSubscription = data?.subscription || null;
      window.addEventListener('pagehide', () => authSubscription?.unsubscribe(), { once: true });
    } catch (error) {
      renderConfigError(error?.message || '認証の初期化に失敗しました。');
    }
  }

  init();
})();
