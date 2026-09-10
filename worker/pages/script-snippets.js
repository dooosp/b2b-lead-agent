export function getEscScript() {
  return `function esc(s) { if(!s) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }`;
}

export function getSafeUrlScript() {
  return `function safeUrl(u) { if(!u) return '#'; try { const parsed = new URL(String(u)); return (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? esc(parsed.href) : '#'; } catch { return '#'; } }`;
}

export function getStoredTokenScript() {
  return `function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
function getToken() { return sessionStorage.getItem('b2b_token') || ''; }`;
}

export function getPasswordTokenScript(inputId = 'password') {
  return `function authHeaders() { const t=sessionStorage.getItem('b2b_token'); return t ? {'Authorization':'Bearer '+t} : {}; }
function getToken() { const p=document.getElementById('${inputId}').value; if(p) sessionStorage.setItem('b2b_token',p); return p; }
(function(){ const s=sessionStorage.getItem('b2b_token'); if(s) document.getElementById('${inputId}').value=s; })();`;
}

export function getProfileScript(defaultProfile = 'danfoss') {
  return `function getProfile() { return new URLSearchParams(window.location.search).get('profile') || '${defaultProfile}'; }`;
}

export function getLeadListReturnScript() {
  return `function getLeadListReturnUrl() {
    const fallback = '/leads?profile=' + encodeURIComponent(getProfile());
    const requested = new URLSearchParams(window.location.search).get('returnTo');
    if (!requested) return fallback;
    try {
      const target = new URL(requested, window.location.origin);
      return target.origin === window.location.origin && target.pathname === '/leads'
        ? target.pathname + target.search : fallback;
    } catch { return fallback; }
  }`;
}
