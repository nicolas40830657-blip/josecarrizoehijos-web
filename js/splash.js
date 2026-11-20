/* Pantalla de inicio de José Carrizo e Hijos.
   Uso: <script src="js/splash.js" data-logo="img/logo-blanco.png" data-equipo="img/equipo-cut.webp"></script>
   justo después de <body>. Se muestra mientras carga la app (mínimo ~1,8 s) y se va sola. */
(function () {
  var s = document.currentScript || {};
  var ds = s.dataset || {};
  var LOGO = ds.logo || 'img/logo-blanco.png';
  var EQUIPO = ds.equipo || 'img/equipo-cut.webp';
  var MIN = +ds.min || 1800, MAX = 4500, t0 = Date.now();

  var fuente = document.createElement('link');
  fuente.rel = 'stylesheet';
  fuente.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,500;1,400&display=swap';
  document.head.appendChild(fuente);

  var css = document.createElement('style');
  css.textContent =
    '#jchSplash{position:fixed;inset:0;z-index:99999;overflow:hidden;display:flex;flex-direction:column;align-items:center;' +
    'background:radial-gradient(90% 60% at 50% 100%,rgba(140,200,255,.45) 0%,rgba(140,200,255,0) 60%),linear-gradient(165deg,#071B45 0%,#0B2F6B 55%,#1F63E8 100%);' +
    'transition:opacity .5s ease,transform .5s ease}' +
    '#jchSplash.fuera{opacity:0;transform:scale(1.03);pointer-events:none}' +
    '#jchSplash .lg{margin-top:calc(env(safe-area-inset-top) + 9vh);width:min(74vw,360px);height:auto;opacity:0;transform:translateY(-14px);animation:jchIn .7s .1s cubic-bezier(.2,.7,.2,1) forwards}' +
    '#jchSplash .fr{margin:3.2vh 24px 0;text-align:center;color:#fff;font:500 clamp(28px,8vw,44px)/1.02 "Inter Tight",system-ui,sans-serif;letter-spacing:-.05em;opacity:0;transform:translateY(10px);animation:jchIn .7s .35s cubic-bezier(.2,.7,.2,1) forwards}' +
    '#jchSplash .fr span{display:inline-block;background:#fff;color:#071B45;padding:0 .18em .06em;border-radius:.16em;font-style:italic;font-weight:400;transform:rotate(-2deg);margin:.08em 0}' +
    '#jchSplash .eq{position:absolute;left:50%;bottom:0;width:min(150vw,820px);max-width:none;height:auto;opacity:0;transform:translate(-50%,60px);animation:jchUp .9s .25s cubic-bezier(.2,.7,.2,1) forwards;' +
    '-webkit-mask-image:linear-gradient(to top,transparent 0,#000 14%);mask-image:linear-gradient(to top,transparent 0,#000 14%)}' +
    '#jchSplash .bar{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 18px);width:64px;height:4px;border-radius:2px;background:rgba(255,255,255,.25);transform:translateX(-50%);overflow:hidden;z-index:2}' +
    '#jchSplash .bar i{position:absolute;inset:0;width:40%;border-radius:2px;background:#fff;animation:jchBar 1.1s ease-in-out infinite}' +
    '@keyframes jchIn{to{opacity:1;transform:none}}' +
    '@keyframes jchUp{to{opacity:1;transform:translate(-50%,0)}}' +
    '@keyframes jchBar{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}' +
    '@media (min-aspect-ratio:4/3){#jchSplash .eq{width:auto;height:56vh}#jchSplash .lg{margin-top:7vh;width:min(30vw,340px)}}' +
    '@media (prefers-reduced-motion:reduce){#jchSplash *{animation-duration:.01s!important;animation-delay:0s!important}}';
  document.head.appendChild(css);

  var d = document.createElement('div');
  d.id = 'jchSplash';
  d.setAttribute('role', 'status');
  d.setAttribute('aria-label', 'Cargando José Carrizo e Hijos');
  d.innerHTML = '<img class="lg" src="' + LOGO + '" alt="José Carrizo e Hijos">' +
    '<div class="fr">Tu pileta, <span>cristalina</span><br>todo el año.</div>' +
    '<img class="eq" src="' + EQUIPO + '" alt="">' +
    '<div class="bar"><i></i></div>';
  (document.body || document.documentElement).appendChild(d);

  var listo = false, cargo = document.readyState === 'complete';
  function cerrar() {
    if (listo) return; listo = true;
    d.classList.add('fuera');
    setTimeout(function () { d.remove(); }, 550);
  }
  function intentar() { if (cargo && Date.now() - t0 >= MIN) cerrar(); }
  window.addEventListener('load', function () { cargo = true; setTimeout(intentar, Math.max(0, MIN - (Date.now() - t0))); });
  setTimeout(function () { cargo = true; intentar(); }, MIN);
  setTimeout(cerrar, MAX);
  d.addEventListener('click', cerrar);
})();
