/* ==========================================================================
   Mis piletas / Mi pileta — conexión, utilidades y pantalla de ingreso
   (misma cuenta que la videoteca: Supabase de la web)
   ========================================================================== */
var SUPABASE_URL = 'https://jxdvrwjkcluskdaeockt.supabase.co';
var SUPABASE_KEY = 'sb_publishable_exDDyjuvHrCqCGd1i4IHfg_X1HfuSct';
var SITIO = 'https://www.josecarrizoehijos.ar/';
var DEMO = /[?&]demo=1/.test(location.search) || !window.supabase;
var sb = !DEMO ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

var $ = function(s, r){ return (r || document).querySelector(s); };
var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }
function peso(n){ return '$' + Math.round(+n || 0).toLocaleString('es-AR'); }
function ymd(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function hoy(){ return ymd(new Date()); }
function fechaTxt(f, largo){ var d = new Date(f + 'T12:00'); return d.toLocaleDateString('es-AR', largo ? { weekday:'long', day:'numeric', month:'long' } : { day:'numeric', month:'short' }); }
var DIAS = ['Sin día fijo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
var DN = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
var MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now()); }

// Teléfonos argentinos al formato de WhatsApp (549 + área + número)
function waNum(t){
  var d = String(t || '').replace(/\D/g, ''); if(!d) return '';
  if(d.indexOf('54') === 0) d = d.slice(2);
  if(d.charAt(0) === '9' && d.length === 11) d = d.slice(1);
  d = d.replace(/^0/, '');
  var m = d.match(/^(\d{2,4})15(\d+)$/); if(m && m[1].length + m[2].length === 10) d = m[1] + m[2];
  return d.length === 10 ? '549' + d : d;
}
function wa(tel, txt){ return 'https://wa.me/' + waNum(tel) + '?text=' + encodeURIComponent(txt || ''); }

var toastT;
function toast(t){ var e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function(){ e.classList.remove('on'); }, 2800); }

/* ---------- Hoja inferior ---------- */
function sheet(html){
  var s = $('#sheet'); $('#sheetBody').innerHTML = '<i class="grab"></i>' + html;
  s.classList.add('on'); document.body.style.overflow = 'hidden';
  var p = $('.sheet__p', s); p.scrollTop = 0;
}
function cerrarSheet(){ $('#sheet').classList.remove('on'); document.body.style.overflow = ''; }
document.addEventListener('click', function(e){ if(e.target.id === 'sheet') cerrarSheet(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') cerrarSheet(); });

/* ---------- Fotos: achicar antes de subir ---------- */
function achicar(file, max){
  max = max || 1200;
  return new Promise(function(ok, no){
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(function(b){ b ? ok(b) : no(new Error('No se pudo leer la foto')); }, 'image/jpeg', .8);
    };
    img.onerror = function(){ no(new Error('No se pudo leer la foto')); };
    img.src = url;
  });
}
var urlCache = {};
function urlsFotos(paths){
  paths = (paths || []).filter(Boolean);
  if(!paths.length) return Promise.resolve([]);
  if(DEMO) return Promise.resolve(paths.map(function(p){ return urlCache[p] || p; }));
  var faltan = paths.filter(function(p){ return !urlCache[p]; });
  var pr = faltan.length ? sb.storage.from('mp-fotos').createSignedUrls(faltan, 3600).then(function(r){
    (r.data || []).forEach(function(x){ if(x.signedUrl) urlCache[x.path] = x.signedUrl; });
  }) : Promise.resolve();
  return pr.then(function(){ return paths.map(function(p){ return urlCache[p]; }).filter(Boolean); });
}

/* ---------- Pantalla de ingreso ---------- */
function pantallaIngreso(cfg){
  // cfg: { titulo, texto, alEntrar }
  var modo = cfg.modo || 'login';
  var g = $('#gate');
  function pintar(){
    g.innerHTML = '<div class="gate__box">' +
      '<img class="logo" src="img/logo.png" alt="José Carrizo e Hijos">' +
      '<h1>' + cfg.titulo + '</h1><p>' + (modo === 'reset' ? 'Te mandamos un mail para crear una contraseña nueva.' : cfg.texto) + '</p>' +
      (modo !== 'reset' ? '<button class="btn-google" type="button" id="gIn"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuar con Google</button><div class="o-sep">o con tu email</div>' : '') +
      '<form id="fIn" novalidate>' +
        '<label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>' +
        (modo === 'registro' ? '<label class="f"><span>Celular (opcional)</span><input name="tel" type="tel" autocomplete="tel" placeholder="223 555-1234"></label>' : '') +
        (modo !== 'reset' ? '<label class="f"><span>Contraseña</span><input name="pass" type="password" autocomplete="' + (modo === 'registro' ? 'new-password' : 'current-password') + '" minlength="6" required></label>' : '') +
        '<p class="err" id="inErr"></p>' +
        '<button class="btn btn--brand" type="submit">' + (modo === 'registro' ? 'Crear cuenta' : modo === 'reset' ? 'Mandar mail' : 'Ingresar') + '</button>' +
      '</form>' +
      '<p class="gate__sw">' + (modo === 'registro' ? '¿Ya tenés cuenta? <button data-m="login">Ingresá</button>'
        : modo === 'reset' ? '<button data-m="login">Volver</button>'
        : '¿Primera vez? <button data-m="registro">Creá tu cuenta</button> · <button data-m="reset">Olvidé mi contraseña</button>') + '</p>' +
    '</div>';
    g.hidden = false;
    $$('[data-m]', g).forEach(function(b){ b.onclick = function(){ modo = b.dataset.m; pintar(); }; });
    var gb = $('#gIn');
    if(gb) gb.onclick = function(){
      if(DEMO){ $('#inErr').textContent = 'En la vista de muestra no se puede ingresar.'; return; }
      gb.disabled = true;
      sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } }).then(function(r){
        if(r.error){ gb.disabled = false; $('#inErr').textContent = 'No se pudo abrir Google. Probá de nuevo.'; }
      });
    };
    $('#fIn').onsubmit = function(e){
      e.preventDefault();
      var f = e.target, err = $('#inErr'), btn = $('button[type=submit]', f);
      var email = f.email.value.trim(), pass = f.pass ? f.pass.value : '';
      if(!/^\S+@\S+\.\S+$/.test(email)){ err.textContent = 'Revisá el email.'; return; }
      if(modo !== 'reset' && pass.length < 6){ err.textContent = 'La contraseña tiene que tener al menos 6 caracteres.'; return; }
      btn.disabled = true; err.textContent = '';
      var volver = location.href.split('#')[0];
      var p = modo === 'login' ? sb.auth.signInWithPassword({ email: email, password: pass })
        : modo === 'registro' ? sb.auth.signUp({ email: email, password: pass, options: { emailRedirectTo: volver, data: { telefono: f.tel.value.trim() } } })
        : sb.auth.resetPasswordForEmail(email, { redirectTo: SITIO + 'clases.html' });
      p.then(function(r){
        btn.disabled = false;
        if(r.error){
          var m = r.error.message || '';
          err.textContent = /Invalid login/i.test(m) ? 'Email o contraseña incorrectos.' : /already registered/i.test(m) ? 'Ese email ya tiene cuenta: ingresá.' : /confirm/i.test(m) ? 'Confirmá tu email con el link que te mandamos.' : m;
          return;
        }
        if(modo === 'reset'){ err.style.color = 'var(--ok)'; err.textContent = 'Listo, revisá tu mail.'; return; }
        if(modo === 'registro' && !r.data.session){ err.style.color = 'var(--ok)'; err.textContent = 'Te mandamos un mail para confirmar tu cuenta. Después volvé a este link.'; return; }
        g.hidden = true; cfg.alEntrar(r.data.session.user);
      });
    };
  }
  pintar();
}
