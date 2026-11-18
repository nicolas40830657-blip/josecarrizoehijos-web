/* =========================================================
   DIAGNÓSTICO INTERACTIVO · video gratis "¿Vale la pena recuperar tu piscina?"
   ---------------------------------------------------------
   - Se activa en la clase GRATIS del módulo "shock" (Recuperá tu piscina verde).
   - En el segundo PAUSA_SEG el video se pausa y aparecen 4 botones encima.
   - Debajo del video queda siempre la calculadora: estado + medidas → productos,
     costo, días y qué conviene hacer (comprar el paquete o vaciar).
   Usa funciones de clases.html: el, esc, plata, wa, comprar, tieneProducto, cerrar.
   ========================================================= */
var DIAG_CONFIG = {
  MODULO: 'shock',
  PAUSA_SEG: 210,            // segundo del video en que se pausa (3:30). Cambialo cuando el video esté editado.

  /* Precios de venta en pesos. Si un precio queda en 0, se muestra la cantidad sin el costo. */
  PRECIOS: {
    cloro_kg: 0,             // Cloro granulado 70%, precio por kg
    reductor_kg: 0,          // Reductor de pH (pH−), precio por kg
    floculante_l: 0          // Floculante / clarificador, precio por litro
  },

  /* Dosis por m³ de UNA aplicación. Ajustalas a la etiqueta de los productos que vendés. */
  DOSIS: {
    reductor_g_m3: 10,       // reductor de pH, gramos por m³ por dosis
    floculante_ml_m3: 20     // floculante, ml por m³ por dosis
  },

  /* Los 4 estados del video */
  ESTADOS: [
    { id:1, color:'#2FBF71', titulo:'Turbia, no verde', corto:'Turbia',
      cloro:[10,10], reductor:1, floc:1, dias:'1 a 2 días', recuperar:true,
      veredicto:'Sí, se recupera fácil',
      texto:'Todavía no hay algas o recién empiezan. Con ajustar el pH, una dosis de cloro y un clarificador la tenés lista.' },
    { id:2, color:'#2FBF71', titulo:'Verde y turbia, se ve el fondo', corto:'Verde clara',
      cloro:[15,20], reductor:1, floc:1, dias:'2 a 3 días', recuperar:true,
      veredicto:'Sí, se recupera con el método',
      texto:'Es el caso típico del curso: con el tratamiento de shock en el orden correcto queda cristalina.' },
    { id:3, color:'#F29A2E', titulo:'Verde oscura, con hojas en el fondo', corto:'Verde oscura',
      cloro:[60,60], reductor:2, floc:2, dias:'4 a 6 días', recuperar:false,
      veredicto:'Se puede intentar, pero no es lo que más conviene',
      texto:'Las hojas se pudren y se comen el cloro: vas a necesitar repetir el shock. Muchas veces sale más barato y más rápido vaciarla y limpiarla a fondo.' },
    { id:4, color:'#E5484D', titulo:'Con barro en el fondo', corto:'Con barro',
      cloro:[90,90], reductor:2, floc:3, dias:'7 días o más', recuperar:false,
      veredicto:'Lo recomendable es vaciarla',
      texto:'El barro no lo saca ningún químico: vas a gastar mucho y el resultado no está garantizado. Conviene vaciarla, sacar el barro y limpiarla a fondo.' }
  ]
};

var Diag = (function(){
  var C = DIAG_CONFIG;
  var box = null, overlay = null, pjs = null, pausado = false, estado = null, mod = null;
  var med = { forma:'rect', largo:'', ancho:'', diam:'', prof:'', m3:'' };
  try { var g = JSON.parse(localStorage.getItem('jc_diag')||'null'); if(g){ med = Object.assign(med, g.med||{}); estado = g.estado||null; } } catch(e){}
  function guardar(){ try { localStorage.setItem('jc_diag', JSON.stringify({med:med, estado:estado})); } catch(e){} }

  function aplica(m, c){ return m && c && m.id === C.MODULO && c.gratis; }
  function num(v){ v = String(v==null?'':v).replace(',', '.'); var n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; }
  function fmt(n, d){ return Number(n).toLocaleString('es-AR', {maximumFractionDigits: d==null?1:d}); }
  function est(id){ return C.ESTADOS.filter(function(e){ return e.id === id; })[0] || null; }

  function m3(){
    if(med.forma === 'm3') return num(med.m3);
    var p = num(med.prof);
    if(med.forma === 'redonda') return num(med.diam) * num(med.diam) * 0.785 * p;
    var f = med.forma === 'oval' ? 0.89 : 1;
    return num(med.largo) * num(med.ancho) * f * p;
  }

  /* ---------- Botones de estado (los mismos encima y debajo del video) ---------- */
  function botones(cls){
    return '<div class="'+cls+'">' + C.ESTADOS.map(function(e){
      return '<button type="button" data-est="'+e.id+'" style="--c:'+e.color+'"'+(estado===e.id?' aria-pressed="true"':'')+'>'+
        '<span class="n">'+e.id+'</span><span class="t">'+esc(e.titulo)+'</span></button>';
    }).join('') + '</div>';
  }

  /* ---------- Panel debajo del video ---------- */
  function pintar(){
    if(!box) return;
    var campos =
      med.forma === 'm3' ? campo('m3', 'Metros cúbicos', 'Ej: 45') :
      med.forma === 'redonda' ? campo('diam', 'Diámetro (m)', 'Ej: 4') + campo('prof', 'Profundidad promedio (m)', 'Ej: 1,2') :
      campo('largo', 'Largo (m)', 'Ej: 8') + campo('ancho', 'Ancho (m)', 'Ej: 4') + campo('prof', 'Profundidad promedio (m)', 'Ej: 1,4');
    box.innerHTML =
      '<div class="diag__head"><span class="k">Calculadora gratis</span><h4>¿Cuál es el estado de tu pileta?</h4>'+
        '<p>Elegí el estado, cargá las medidas y te decimos si conviene recuperarla, cuánto vas a gastar y cuánto vas a tardar.</p></div>'+
      botones('diag__estados')+
      '<div class="diag__med">'+
        '<div class="diag__formas">'+
          [['rect','Rectangular'],['redonda','Redonda'],['oval','Ovalada'],['m3','Sé los m³']].map(function(f){
            return '<button type="button" data-forma="'+f[0]+'"'+(med.forma===f[0]?' aria-pressed="true"':'')+'>'+f[1]+'</button>';
          }).join('')+
        '</div>'+
        '<div class="diag__campos">'+campos+'</div>'+
        '<p class="diag__hint">Profundidad promedio = (parte baja + parte honda) ÷ 2.</p>'+
      '</div>'+
      '<div class="diag__res" id="diagRes" aria-live="polite"></div>';
    resultado();
  }
  function campo(k, label, ph){
    return '<label><span>'+label+'</span><input inputmode="decimal" data-k="'+k+'" value="'+esc(med[k])+'" placeholder="'+ph+'"></label>';
  }

  function resultado(){
    var r = box && box.querySelector('#diagRes'); if(!r) return;
    var e = est(estado), v = m3();
    if(!e){ r.innerHTML = '<p class="diag__vacio">Tocá uno de los 4 estados para ver el resultado.</p>'; return; }
    var P = C.PRECIOS, D = C.DOSIS;
    var html = '<div class="diag__card" style="--c:'+e.color+'">'+
      '<span class="diag__tag">Estado '+e.id+' · '+esc(e.corto)+'</span>'+
      '<h5>'+esc(e.veredicto)+'</h5><p>'+esc(e.texto)+'</p>';

    if(!v){
      html += '<p class="diag__falta">Cargá las medidas de tu pileta para calcular los productos y el costo.</p>';
    } else {
      var cl = [e.cloro[0]*v/1000, e.cloro[1]*v/1000];                 // kg
      var rd = D.reductor_g_m3 * v * e.reductor / 1000;                   // kg
      var fl = D.floculante_ml_m3 * v * e.floc / 1000;                    // litros
      var hayPrecio = P.cloro_kg && P.reductor_kg && P.floculante_l;
      var costo = [cl[0]*P.cloro_kg + rd*P.reductor_kg + fl*P.floculante_l, cl[1]*P.cloro_kg + rd*P.reductor_kg + fl*P.floculante_l];
      var r100 = function(n){ return Math.round(n/100)*100; };
      var kg = cl[0] === cl[1] ? fmt(cl[0]) : fmt(cl[0])+' a '+fmt(cl[1]);
      html +=
        '<div class="diag__nums">'+
          '<div><small>Tu pileta</small><b>'+fmt(v)+' m³</b><span>'+fmt(v*1000,0)+' litros</span></div>'+
          '<div><small>Tiempo estimado</small><b>'+e.dias+'</b><span>con la bomba y el filtro andando</span></div>'+
          '<div><small>Gasto en productos</small><b>'+(hayPrecio ? (r100(costo[0])===r100(costo[1]) ? plata(r100(costo[0])) : plata(r100(costo[0]))+' a '+plata(r100(costo[1]))) : 'Consultá precio')+'</b><span>'+(hayPrecio?'aproximado':'según lo que compres')+'</span></div>'+
        '</div>'+
        '<ul class="diag__prod">'+
          '<li><b>'+kg+' kg</b> de cloro granulado 70%'+(e.cloro[0]>=60 ? ' (en '+(e.cloro[0]/30)+' aplicaciones)' : '')+'</li>'+
          '<li><b>'+fmt(rd)+' kg</b> de reductor de pH (según lo que midas)</li>'+
          '<li><b>'+fmt(fl)+' l</b> de '+(e.id===1?'clarificador':'floculante')+'</li>'+
        '</ul>';
    }

    html += '<div class="diag__btns" id="diagBtns"></div>'+
      '<p class="diag__nota">Valores orientativos. Siempre respetá la etiqueta de tu producto.</p></div>';
    r.innerHTML = html;

    var b = r.querySelector('#diagBtns');
    var yaLoTiene = typeof tieneProducto === 'function' && tieneProducto('paquete-shock');
    var resumen = 'Mi pileta: estado '+e.id+' ('+e.titulo+')'+(v ? ', '+fmt(v)+' m³' : '')+'.';
    if(e.recuperar){
      if(!yaLoTiene) b.appendChild(btn('btn btn--brand', 'Comprar el paquete · '+plata(PRODUCTOS['paquete-shock'].precio), function(){ if(typeof cerrar==='function') cerrar(); comprar('paquete-shock'); }));
      else b.appendChild(btn('btn btn--brand', 'Ya tenés el paquete · ver el video 1', function(){ irAlCurso(); }));
      b.appendChild(link('btn btn--ghost', 'Prefiero que lo hagan ustedes', wa('Hola! Hice el diagnóstico de la web. '+resumen+' Quiero que me recuperen la pileta.')));
    } else {
      b.appendChild(link('btn btn--brand', 'Pedir vaciado y limpieza por WhatsApp', wa('Hola! Hice el diagnóstico de la web. '+resumen+' Quiero un presupuesto de vaciado y limpieza a fondo.')));
      if(!yaLoTiene) b.appendChild(btn('btn btn--ghost', 'Igual quiero intentarlo: comprar el paquete', function(){ if(typeof cerrar==='function') cerrar(); comprar('paquete-shock'); }));
    }
    if(pjs) b.appendChild(btn('btn btn--ghost', 'Seguir viendo el video', seguir));
  }
  function btn(cls, txt, fn){ var x = el('button', {'class':cls, type:'button'}, esc(txt)); x.onclick = fn; return x; }
  function link(cls, txt, href){ return el('a', {'class':cls, href:href, target:'_blank', rel:'noopener'}, esc(txt)); }
  function irAlCurso(){ if(mod && mod.clases){ var sig = mod.clases.filter(function(x){ return !x.gratis; })[0]; if(sig) abrir(mod, sig); } }

  function elegir(id){
    estado = id; guardar();
    if(overlay) ocultarOverlay();
    pintar();
    var r = box.querySelector('#diagRes');
    if(r) setTimeout(function(){ r.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
    var inp = box.querySelector('.diag__campos input');
    if(inp && !m3()) setTimeout(function(){ try{ inp.focus({preventScroll:true}); }catch(e){} }, 400);
  }

  /* ---------- Overlay encima del video ---------- */
  function mostrarOverlay(){
    var pl = document.getElementById('player'); if(!pl || overlay) return;
    overlay = el('div', {'class':'diag-ov', role:'dialog', 'aria-label':'Elegí el estado de tu pileta'},
      '<b>Tocá el estado de tu pileta</b>'+botones('diag-ov__grid')+
      '<button type="button" class="diag-ov__seguir">Seguir viendo ▸</button>');
    overlay.addEventListener('click', function(ev){
      var t = ev.target.closest('[data-est]'); if(t){ elegir(+t.getAttribute('data-est')); return; }
      if(ev.target.closest('.diag-ov__seguir')) seguir();
    });
    pl.appendChild(overlay);
  }
  function ocultarOverlay(){ if(overlay){ overlay.remove(); overlay = null; } }
  function seguir(){ ocultarOverlay(); if(pjs) try{ pjs.play(); }catch(e){} var pl=document.getElementById('player'); if(pl) pl.scrollIntoView({behavior:'smooth', block:'start'}); }

  /* ---------- Control del video de Bunny (player.js) ---------- */
  function cargarPlayerJs(cb){
    if(window.playerjs) return cb();
    var s = document.createElement('script');
    s.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
    s.onload = cb; s.onerror = function(){};   // si no carga, la calculadora igual funciona
    document.head.appendChild(s);
  }
  function conectar(iframe){
    cargarPlayerJs(function(){
      if(!window.playerjs || !iframe.isConnected) return;
      var p = new playerjs.Player(iframe);
      p.on('ready', function(){
        pjs = p; resultado();
        p.on('timeupdate', function(d){
          var s = d && (d.seconds != null ? d.seconds : d.currentTime);
          if(!pausado && s >= C.PAUSA_SEG && s < C.PAUSA_SEG + 5){
            pausado = true; try{ p.pause(); }catch(e){}
            mostrarOverlay();
          }
          if(s < C.PAUSA_SEG - 2) pausado = false;   // si vuelve atrás, se vuelve a pausar
        });
      });
    });
  }

  /* ---------- Lo que llama clases.html ---------- */
  function alAbrir(m, c, iframe){
    salir();
    if(!aplica(m, c)) return;
    mod = m;
    box = document.getElementById('diag'); if(!box) return;
    box.hidden = false;
    box.addEventListener('click', onClick);
    box.addEventListener('input', onInput);
    pintar();
    if(iframe) conectar(iframe);
  }
  function onClick(ev){
    var t = ev.target.closest('[data-est]'); if(t){ elegir(+t.getAttribute('data-est')); return; }
    var f = ev.target.closest('[data-forma]'); if(f){ med.forma = f.getAttribute('data-forma'); guardar(); pintar(); }
  }
  function onInput(ev){
    var k = ev.target.getAttribute('data-k'); if(!k) return;
    med[k] = ev.target.value; guardar(); resultado();
  }
  function salir(){
    ocultarOverlay(); pjs = null; pausado = false; mod = null;
    if(box){ box.removeEventListener('click', onClick); box.removeEventListener('input', onInput); box.hidden = true; box.innerHTML = ''; }
    box = null;
  }
  return { alAbrir: alAbrir, salir: salir, aplica: aplica, probarPausa: mostrarOverlay };
})();
