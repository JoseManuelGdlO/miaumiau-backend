(function () {
  const root = document.getElementById('vincular-root');
  const FB_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com']);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tokenFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('vincular');
    return idx >= 0 ? decodeURIComponent(parts[idx + 1] || '') : '';
  }

  function parseEmbeddedSignupMessage(data) {
    let parsed = data;
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== 'object' || parsed.type !== 'WA_EMBEDDED_SIGNUP') return null;
    const info = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
    const asId = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);
    return {
      event: parsed.event ? String(parsed.event) : null,
      wabaId: asId(info.waba_id),
      phoneNumberId: asId(info.phone_number_id),
      businessId: asId(info.business_id)
    };
  }

  function loadFacebookSdk(appId, version) {
    return new Promise((resolve, reject) => {
      if (window.FB) {
        window.FB.init({ appId, cookie: true, xfbml: false, version, autoLogAppEvents: true });
        resolve();
        return;
      }
      window.fbAsyncInit = () => {
        window.FB.init({ appId, cookie: true, xfbml: false, version, autoLogAppEvents: true });
        resolve();
      };
      if (document.getElementById('facebook-jssdk')) return;
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de Facebook.'));
      document.body.appendChild(script);
    });
  }

  function launchEmbeddedSignup(opts) {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('El SDK de Facebook no está listo. Recarga la página.'));
        return;
      }
      let session = null;
      const onMessage = (event) => {
        if (!FB_ORIGINS.has(event.origin)) return;
        const parsed = parseEmbeddedSignupMessage(event.data);
        if (parsed) session = parsed;
      };
      window.addEventListener('message', onMessage);
      window.FB.login(
        (response) => {
          window.removeEventListener('message', onMessage);
          const code = String(response?.authResponse?.code || '').trim();
          if (!code) {
            reject(new Error('El flujo de WhatsApp se canceló o no devolvió un código.'));
            return;
          }
          resolve({ code, session });
        },
        {
          config_id: opts.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: opts.featureType,
            sessionInfoVersion: opts.sessionInfoVersion || '3'
          }
        }
      );
    });
  }

  function renderError(message) {
    root.innerHTML = `
      <h1>No se puede vincular</h1>
      <p class="error">${escapeHtml(message)}</p>
      <p class="muted">Si el link venció, pide uno nuevo a quien administra la ciudad.</p>
    `;
  }

  function renderSuccess(data) {
    root.innerHTML = `
      <h1>WhatsApp vinculado</h1>
      <div class="stack">
        <p>El número <strong>${escapeHtml(data.displayPhoneNumber || 'conectado')}</strong> ya está vinculado.</p>
        <p class="muted">${data.coexistenceEnabled
          ? 'El número puede seguir funcionando en la app de WhatsApp Business y también quedó conectado a la Cloud API.'
          : 'La cuenta quedó conectada a la Cloud API.'}</p>
      </div>
    `;
  }

  async function start() {
    const token = tokenFromPath();
    if (!token) {
      renderError('Falta el token del link.');
      return;
    }

    let invite;
    try {
      const res = await fetch(`/api/public/meta/invite/${encodeURIComponent(token)}`);
      invite = await res.json();
      if (!res.ok) throw new Error(invite.error || 'Link inválido');
    } catch (error) {
      renderError(error.message);
      return;
    }

    if (!invite.configured || !invite.config?.appId || !invite.config?.configId) {
      root.innerHTML = `
        <h1>Falta configurar Meta</h1>
        <p>El link es válido, pero el servidor no tiene Embedded Signup. Quien administra el panel debe configurar y reiniciar:</p>
        <ul>
          <li><code>META_APP_ID</code></li>
          <li><code>META_APP_SECRET</code></li>
          <li><code>META_EMBEDDED_SIGNUP_CONFIG_ID</code></li>
        </ul>
        <p class="muted">El dueño del WhatsApp no puede completar la vinculación hasta que la configuración esté disponible.</p>
      `;
      return;
    }

    root.innerHTML = `
      <h1>Vincular WhatsApp</h1>
      <p class="muted">Vas a conectar el WhatsApp Business de <strong>${escapeHtml(invite.cityName)}</strong>.</p>
      <form id="vincular-form" class="stack">
        <p>Usa la cuenta de Facebook que administra ese WhatsApp Business. El mismo número puede seguir usándose en la app de WhatsApp Business.</p>
        <label class="check">
          <input type="checkbox" id="accept-legal" required>
          <span>Confirmo que administro el WhatsApp Business de esta ciudad.</span>
        </label>
        <p id="vincular-error" class="error" hidden></p>
        <button type="submit" id="connect-btn">Conectar WhatsApp</button>
      </form>
    `;

    const form = document.getElementById('vincular-form');
    const errorEl = document.getElementById('vincular-error');
    const button = document.getElementById('connect-btn');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl.hidden = true;
      if (!document.getElementById('accept-legal').checked) {
        errorEl.textContent = 'Debes confirmar que administras el WhatsApp Business de esta ciudad.';
        errorEl.hidden = false;
        return;
      }
      button.disabled = true;
      button.textContent = 'Conectando…';
      try {
        await loadFacebookSdk(invite.config.appId, invite.config.graphVersion);
        const { code, session } = await launchEmbeddedSignup({
          configId: invite.config.configId,
          featureType: invite.config.featureType,
          sessionInfoVersion: invite.config.sessionInfoVersion
        });
        const res = await fetch('/api/public/meta/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            code,
            wabaId: session?.wabaId || null,
            phoneNumberId: session?.phoneNumberId || null,
            businessId: session?.businessId || null,
            event: session?.event || null
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo completar la vinculación');
        renderSuccess(data);
      } catch (error) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
        button.disabled = false;
        button.textContent = 'Conectar WhatsApp';
      }
    });
  }

  start();
})();
