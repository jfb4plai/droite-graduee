'use strict';
import { supabase } from './supabase.js';

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
const SVG = 'http://www.w3.org/2000/svg';
function $id(id){ return document.getElementById(id); }
function svgEl(tag, attrs){
  const el = document.createElementNS(SVG, tag);
  for(const[k,v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
function snap(val, step){ return Math.round(val / step) * step; }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function round3(v){ return Math.round(v * 1000) / 1000; }

// ─────────────────────────────────────────────────
// APP SHELL
// ─────────────────────────────────────────────────
const App = {
  user: null,
  userId: null,
  mode: 'teacher',
  _signupMode: false,
  _resetMode: false,
  passwordRecovery: false,

  async init(){
    // Vérifier la session existante
    const { data: { session } } = await supabase.auth.getSession();
    if(session?.user){
      this.user = session.user.email;
      this.userId = session.user.id;
      this._showTeacher();
    }

    // Écouter les changements d'authentification
    supabase.auth.onAuthStateChange((event, session) => {
      if(event === 'PASSWORD_RECOVERY'){
        this.passwordRecovery = true;
        this._show('sc-recovery');
        return;
      }
      if(event === 'INITIAL_SESSION') return;
      if(session?.user && !this.passwordRecovery){
        this.user = session.user.email;
        this.userId = session.user.id;
        this._showTeacher();
      } else if(!session?.user){
        this.user = null;
        this.userId = null;
        this._show('sc-login');
        $id('hdr-ctrl').classList.add('hidden');
      }
    });

    T.initGrids();
    T.buildA2Lines();
    T.buildA3Lines();
    T.preview();
    window.addEventListener('resize', ()=>{ if(this.mode==='teacher') T.preview(); });
  },

  async login(){
    const email = $id('l-user').value.trim();
    const p = $id('l-pass').value.trim();
    if(!email || !p){ this._err('Champs requis.'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password: p });
    if(error){ this._err('Email ou mot de passe incorrect.'); return; }
    $id('l-err').classList.add('hidden');
    // La session est gérée par onAuthStateChange
  },

  async signup(){
    const email = $id('l-user').value.trim();
    const p = $id('l-pass').value.trim();
    if(!email || !p){ this._err('Champs requis.'); return; }
    if(p.length < 6){ this._err('Mot de passe : 6 caractères minimum.'); return; }
    const { error } = await supabase.auth.signUp({ email, password: p });
    if(error){ this._err(error.message); return; }
    const errEl = $id('l-err');
    errEl.style.color = '#4caf50';
    errEl.textContent = 'Compte créé ! Vérifiez votre email puis connectez-vous.';
    errEl.classList.remove('hidden');
  },

  async sendReset(){
    const email = $id('l-user').value.trim();
    if(!email){ this._err('Entrez votre email.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    const errEl = $id('l-err');
    if(error){ this._err(error.message); return; }
    errEl.style.color = '#4caf50';
    errEl.textContent = 'Email envoyé ! Vérifiez votre boîte mail pour créer un nouveau mot de passe.';
    errEl.classList.remove('hidden');
  },

  async updatePassword(){
    const p = $id('r-pass').value.trim();
    const errEl = $id('r-err');
    if(p.length < 6){ errEl.textContent='6 caractères minimum.'; errEl.style.color='red'; errEl.classList.remove('hidden'); return; }
    const { error } = await supabase.auth.updateUser({ password: p });
    if(error){ errEl.textContent=error.message; errEl.style.color='red'; errEl.classList.remove('hidden'); return; }
    this.passwordRecovery = false;
    const { data: { session } } = await supabase.auth.getSession();
    if(session?.user){
      this.user = session.user.email;
      this.userId = session.user.id;
    }
    this._showTeacher();
  },

  async logout(){
    await supabase.auth.signOut();
  },

  goStudent(){
    this._show('sc-student');
    this.mode = 'student';
  },

  toggleMode(){
    if(this.mode==='teacher'){
      this.mode='student';
      this._show('sc-student');
      $id('btn-mode').textContent='Mode enseignant';
    } else {
      this.mode='teacher';
      this._show('sc-teacher');
      $id('btn-mode').textContent='Mode élève';
      T.preview();
    }
  },

  toggleSignup(){
    this._signupMode = !this._signupMode;
    this._resetMode = false;
    const errEl = $id('l-err');
    errEl.classList.add('hidden');
    errEl.style.color = 'red';
    $id('l-pwd-group').classList.remove('hidden');
    $id('l-reset-btn').classList.add('hidden');
    $id('l-forgot-hint').classList.remove('hidden');
    $id('l-reset-cancel-hint').classList.add('hidden');
    if(this._signupMode){
      $id('l-title').textContent = 'Créer un compte';
      $id('l-login-btn').classList.add('hidden');
      $id('l-signup-btn').classList.remove('hidden');
      $id('l-toggle-hint').classList.add('hidden');
      $id('l-signin-hint').classList.remove('hidden');
      $id('l-forgot-hint').classList.add('hidden');
    } else {
      $id('l-title').textContent = 'Connexion Enseignant';
      $id('l-login-btn').classList.remove('hidden');
      $id('l-signup-btn').classList.add('hidden');
      $id('l-toggle-hint').classList.remove('hidden');
      $id('l-signin-hint').classList.add('hidden');
    }
  },

  toggleReset(){
    this._resetMode = !this._resetMode;
    this._signupMode = false;
    const errEl = $id('l-err');
    errEl.classList.add('hidden');
    errEl.style.color = 'red';
    $id('l-toggle-hint').classList.add('hidden');
    $id('l-signin-hint').classList.add('hidden');
    if(this._resetMode){
      $id('l-title').textContent = 'Mot de passe oublié';
      $id('l-pwd-group').classList.add('hidden');
      $id('l-login-btn').classList.add('hidden');
      $id('l-signup-btn').classList.add('hidden');
      $id('l-reset-btn').classList.remove('hidden');
      $id('l-forgot-hint').classList.add('hidden');
      $id('l-reset-cancel-hint').classList.remove('hidden');
    } else {
      $id('l-title').textContent = 'Connexion Enseignant';
      $id('l-pwd-group').classList.remove('hidden');
      $id('l-login-btn').classList.remove('hidden');
      $id('l-reset-btn').classList.add('hidden');
      $id('l-toggle-hint').classList.remove('hidden');
      $id('l-forgot-hint').classList.remove('hidden');
      $id('l-reset-cancel-hint').classList.add('hidden');
    }
  },

  _showTeacher(){
    this._show('sc-teacher');
    this.mode='teacher';
    const displayName = this.user?.split('@')[0] || this.user;
    $id('hdr-user').textContent='👤 '+displayName;
    const ctrl = $id('hdr-ctrl');
    ctrl.classList.remove('hidden');
    ctrl.style.display='flex';
    $id('btn-mode').textContent='Mode élève';
    T.loadSaved();
    T.preview();
  },

  _show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $id(id).classList.add('active');
  },

  _err(msg){ $id('l-err').textContent=msg; $id('l-err').classList.remove('hidden'); },

  async cfgStore(){
    if(!this.userId) return {};
    const { data, error } = await supabase
      .from('droite_configs')
      .select('name, data')
      .eq('user_id', this.userId);
    if(error || !data) return {};
    const store = {};
    data.forEach(row => { store[row.name] = row.data; });
    return store;
  },

  async saveCfg(name, data){
    if(!this.userId) return;
    await supabase.from('droite_configs').upsert(
      { user_id: this.userId, name, data },
      { onConflict: 'user_id,name' }
    );
  },

  async delCfg(name){
    if(!this.userId) return;
    await supabase.from('droite_configs')
      .delete()
      .eq('user_id', this.userId)
      .eq('name', name);
  }
};

// ─────────────────────────────────────────────────
// NUMBER LINE RENDERER
// ─────────────────────────────────────────────────
const NL = {
  ML: 32, MR: 24,

  draw(svg, cfg, svgW, y, label){
    const { start, end, step, showTicks, showNums, everyN } = cfg;
    if(start >= end || step <= 0) return null;
    const ml = this.ML, mr = this.MR;
    const lw = svgW - ml - mr;

    if(label){
      const t = svgEl('text',{x:ml, y:y-18, 'font-size':'11','font-family':'Segoe UI,Arial',fill:'#999'});
      t.textContent = label;
      svg.appendChild(t);
    }

    svg.appendChild(svgEl('line',{x1:ml,y1:y,x2:ml+lw,y2:y,stroke:'#333','stroke-width':'2'}));
    svg.appendChild(svgEl('polygon',{
      points:`${ml+lw},${y-5} ${ml+lw+12},${y} ${ml+lw},${y+5}`,fill:'#333'
    }));

    let ticks = [];
    if(showTicks === 'all'){
      for(let v=start; v<=end+1e-9; v+=step) ticks.push(round3(v));
    } else if(showTicks === 'custom'){
      ticks = (cfg.customTicks||[]).filter(t=>t>=start&&t<=end);
      if(!ticks.includes(start)) ticks.unshift(start);
      if(!ticks.includes(end))   ticks.push(end);
    }

    ticks.forEach(v=>{
      const x = this.v2x(v, start, end, ml, lw);
      const isEnd = (v===start||v===end);
      const th = isEnd ? 14 : 8;
      svg.appendChild(svgEl('line',{x1:x,y1:y-th,x2:x,y2:y+th,stroke:'#333','stroke-width': isEnd?'2':'1.5'}));

      let show = false;
      if(showNums === 'all') show = true;
      else if(showNums === 'every'){
        const idx = Math.round((v-start)/step);
        show = (idx % (everyN||1) === 0);
      }
      if(show){
        const t = svgEl('text',{x,y:y+26,'text-anchor':'middle','font-size':'12','font-family':'Segoe UI,Arial',fill:'#333'});
        t.textContent = v;
        svg.appendChild(t);
      }
    });

    return { ml, lw, y, start, end, step };
  },

  v2x(v, start, end, ml, lw){ return ml + ((v-start)/(end-start))*lw; },
  x2v(x, start, end, ml, lw, step){
    const raw = start + ((x-ml)/lw)*(end-start);
    return clamp(snap(raw, step), start, end);
  }
};

// ─────────────────────────────────────────────────
// PIECE RENDERER
// ─────────────────────────────────────────────────
const PR = {
  W: 46, HR: 32, HT: 18,

  make(value, cx, cy, stroke='#1a1a1a', fill='#fff'){
    const g = document.createElementNS(SVG,'g');
    g.classList.add('piece');
    const w=this.W, hr=this.HR, ht=this.HT;
    g.appendChild(svgEl('rect',{x:cx-w/2,y:cy,width:w,height:hr,rx:'3',fill,stroke,'stroke-width':'2.5'}));
    g.appendChild(svgEl('polygon',{
      points:`${cx-w/2},${cy+hr} ${cx+w/2},${cy+hr} ${cx},${cy+hr+ht}`,
      fill, stroke,'stroke-width':'2.5','stroke-linejoin':'round'
    }));
    const fs = String(value).length > 2 ? '12' : '15';
    const t = svgEl('text',{x:cx,y:cy+hr/2+5.5,'text-anchor':'middle','font-size':fs,'font-weight':'bold',fill:stroke,'font-family':'Segoe UI,Arial','pointer-events':'none'});
    t.textContent = value;
    g.appendChild(t);
    g._tipY = cy + hr + ht;
    g._tipOffsetY = hr + ht;
    return g;
  },

  tipY(cy){ return cy + this.HR + this.HT; },
  totalH(){ return this.HR + this.HT; }
};

// ─────────────────────────────────────────────────
// DRAG UTILITIES
// ─────────────────────────────────────────────────
function getClientXY(e){
  if(e.touches && e.touches.length) return [e.touches[0].clientX, e.touches[0].clientY];
  if(e.changedTouches && e.changedTouches.length) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
  return [e.clientX, e.clientY];
}

// ─────────────────────────────────────────────────
// TEACHER MODULE  (T)
// ─────────────────────────────────────────────────
const T = {
  act: 1,

  selectAct(n){
    this.act = n;
    [1,2,3].forEach(i=>{
      $id('tab'+i).classList.toggle('active', i===n);
      $id('cfg'+i).classList.toggle('active', i===n);
      $id('cfg'+i).classList.toggle('hidden', i!==n);
    });
    this.preview();
  },

  initGrids(){
    this._buildGrid('a1-pgrid', 4);
    this._buildGrid('a3-pgrid', 4);
  },

  _buildGrid(gridId, n){
    const g = $id(gridId); g.innerHTML='';
    for(let i=0;i<n;i++) g.appendChild(this._inp(i+1));
  },

  _inp(idx){
    const i = document.createElement('input');
    i.type='number'; i.className='piece-inp';
    i.placeholder='Nbr '+(idx); i.min='0';
    return i;
  },

  addPiece(a){
    const g = $id('a'+a+'-pgrid');
    if(g.children.length>=20) return;
    g.appendChild(this._inp(g.children.length+1));
  },

  rmPiece(a){
    const g = $id('a'+a+'-pgrid');
    if(g.children.length>1) g.removeChild(g.lastChild);
  },

  getPieces(a){
    return Array.from($id('a'+a+'-pgrid').children)
      .map(i=>parseFloat(i.value)).filter(v=>!isNaN(v));
  },

  toggleTicks(a){
    const all = $id('a'+a+'-allticks')?.checked;
    $id('a'+a+'-cticks')?.classList.toggle('hidden', all);
  },

  onShowNumsChange(a){
    const v = $id('a'+a+'-shownums')?.value;
    $id('a'+a+'-everyrow')?.classList.toggle('hidden', v!=='every');
  },

  getA1(){
    const start = parseFloat($id('a1-start').value)||0;
    const end   = parseFloat($id('a1-end').value)||10;
    const step  = parseFloat($id('a1-step').value)||1;
    const allT  = $id('a1-allticks').checked;
    const sn    = $id('a1-shownums').value;
    const en    = parseInt($id('a1-everyn').value)||2;
    let ct = [];
    if(!allT){
      ct = $id('a1-ticklist').value.split(',').map(x=>parseFloat(x.trim())).filter(x=>!isNaN(x)).slice(0,10);
    }
    const keepHistory = $id('a1-keephistory')?.checked ?? false;
    return { start, end, step, showTicks: allT?'all':'custom', customTicks:ct, showNums:sn, everyN:en, keepHistory };
  },

  getA2(){
    const n    = parseInt($id('a2-nlines').value)||3;
    const unit = parseInt($id('a2-unit').value)||2;
    const task = $id('a2-task').value;
    const l1n  = $id('a2-l1nums')?.checked ?? true;
    const l1start = parseInt($id('a2-l1start')?.value) || 0;
    const l1end   = parseInt($id('a2-l1end')?.value)   || 100;
    const lines = [{ start:l1start, end:l1end, step:1, showNums: l1n?'all':'none' }];
    for(let i=2;i<=n;i++){
      const start= parseInt($id('a2-l'+i+'start')?.value) || 0;
      const end  = parseInt($id('a2-l'+i+'end')?.value)   || 100;
      const s    = parseInt($id('a2-l'+i+'step')?.value)  || unit*(i-1);
      const sn   = $id('a2-l'+i+'nums')?.checked ? 'all':'none';
      lines.push({ start, end, step:s, showNums:sn });
    }
    return { n, unit, task, lines };
  },

  getA3(){
    const nAdd = parseInt($id('a3-nlines')?.value)||2;
    const n = nAdd + 1;
    const l1sn = $id('a3-l1-shownums')?.value || 'every';
    const l1en = parseInt($id('a3-l1-everyn')?.value)||10;
    const lines = [{start:0, end:100, step:1, showTicks:'all', showNums:l1sn, everyN:l1en, customTicks:[]}];
    for(let i=2; i<=n; i++){
      const start = parseFloat($id(`a3-l${i}-start`)?.value)||0;
      const end   = parseFloat($id(`a3-l${i}-end`)?.value)||100;
      const step  = parseFloat($id(`a3-l${i}-step`)?.value)||10;
      const allT  = $id(`a3-l${i}-allticks`)?.checked ?? true;
      const sn    = $id(`a3-l${i}-shownums`)?.value || 'all';
      const en    = parseInt($id(`a3-l${i}-everyn`)?.value)||step;
      let ct = [];
      if(!allT) ct = ($id(`a3-l${i}-ticklist`)?.value||'').split(',').map(x=>parseFloat(x.trim())).filter(x=>!isNaN(x)).slice(0,10);
      lines.push({start, end, step, showTicks: allT?'all':'custom', showNums:sn, everyN:en, customTicks:ct});
    }
    const keepHistory = $id('a3-keephistory')?.checked ?? false;
    const showLine1   = $id('a3-l1-show')?.checked ?? true;
    return { n, lines, pieces: this.getPieces(3), keepHistory, showLine1 };
  },

  buildA2Lines(){
    const n    = parseInt($id('a2-nlines')?.value)||3;
    const unit = parseInt($id('a2-unit')?.value)||2;
    const cont = $id('a2-linescfg'); if(!cont) return;
    cont.innerHTML='';
    for(let i=2;i<=n;i++){
      const def = unit*(i-1);
      cont.insertAdjacentHTML('beforeend',`
        <div class="cfg-row"><label>Droite ${i} – Début</label>
          <input type="number" id="a2-l${i}start" value="0" oninput="T.preview()"></div>
        <div class="cfg-row"><label>Droite ${i} – Fin</label>
          <input type="number" id="a2-l${i}end" value="100" min="1" oninput="T.preview()"></div>
        <div class="cfg-row"><label>Droite ${i} – Pas</label>
          <input type="number" id="a2-l${i}step" value="${def}" min="1" oninput="T.preview()"></div>
        <div class="cfg-row"><label>Droite ${i} – Afficher nombres</label>
          <input type="checkbox" id="a2-l${i}nums" checked onchange="T.preview()"></div>
      `);
    }
    this.preview();
  },

  buildA3Lines(){
    const nAdd = parseInt($id('a3-nlines')?.value)||2;
    const cont = $id('a3-linescfg'); if(!cont) return;
    cont.innerHTML='';
    for(let i=2; i<=nAdd+1; i++){
      const defStep = i===2 ? 10 : i===3 ? 5 : 2;
      cont.insertAdjacentHTML('beforeend',`
        <div class="cfg-box" style="margin-bottom:10px;">
          <h3>Droite ${i}</h3>
          <div class="cfg-row"><label>Début</label>
            <input type="number" id="a3-l${i}-start" value="0" min="0" oninput="T.preview()"></div>
          <div class="cfg-row"><label>Fin</label>
            <input type="number" id="a3-l${i}-end" value="100" min="1" oninput="T.preview()"></div>
          <div class="cfg-row"><label>Pas</label>
            <input type="number" id="a3-l${i}-step" value="${defStep}" min="1" oninput="T.preview()"></div>
          <div class="cfg-row"><label>Toutes les graduations</label>
            <input type="checkbox" id="a3-l${i}-allticks" checked
              onchange="T.toggleA3Ticks(${i});T.preview()"></div>
          <div id="a3-l${i}-cticks" class="hidden" style="margin-bottom:6px;">
            <div style="font-size:.75rem;color:#999;margin-bottom:2px;">Graduations (virgule, max 10)</div>
            <input type="text" id="a3-l${i}-ticklist" placeholder="Ex: 0,25,50,75,100"
              style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:.82rem;"
              oninput="T.preview()">
          </div>
          <div class="cfg-row"><label>Afficher les nombres</label>
            <select id="a3-l${i}-shownums" onchange="T.onA3ShowNums(${i});T.preview()">
              <option value="all">Toutes les graduations</option>
              <option value="every">Tous les X pas</option>
              <option value="none">Aucun</option>
            </select></div>
          <div class="cfg-row hidden" id="a3-l${i}-everyrow">
            <label>Tous les X pas</label>
            <input type="number" id="a3-l${i}-everyn" value="${defStep}" min="1" oninput="T.preview()"></div>
        </div>
      `);
    }
    this.preview();
  },

  toggleA3Ticks(i){
    const all = $id(`a3-l${i}-allticks`)?.checked;
    $id(`a3-l${i}-cticks`)?.classList.toggle('hidden', all);
  },

  onA3ShowNums(i){
    const v = $id(`a3-l${i}-shownums`)?.value;
    $id(`a3-l${i}-everyrow`)?.classList.toggle('hidden', v!=='every');
  },

  preview(){
    if(this.act===1) this._prev1();
    else if(this.act===2) this._prev2();
    else this._prev3();
  },

  _svgW(svgEl){ return (svgEl.parentElement?.clientWidth||600) - 4; },

  _prev1(){
    const svg = $id('a1-prev'); if(!svg) return;
    svg.innerHTML='';
    const w = this._svgW(svg);
    svg.setAttribute('width', w);
    const cfg = {...this.getA1()};
    NL.draw(svg, cfg, w, 55);
  },

  _prev2(){
    const svg = $id('a2-prev'); if(!svg) return;
    svg.innerHTML='';
    const cfg = this.getA2();
    const w = this._svgW(svg);
    const h = 40 + cfg.n*70;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    cfg.lines.forEach((l,i)=>{
      NL.draw(svg,{start:0,end:100,step:l.step,showTicks:'all',showNums:l.showNums,everyN:1},w,40+i*70,`Droite ${i+1}  (0→100, pas=${l.step})`);
    });
  },

  _prev3(){
    const svg = $id('a3-prev'); if(!svg) return;
    svg.innerHTML='';
    const cfg = this.getA3();
    const w = this._svgW(svg);
    const h = 40 + cfg.n*70;
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    cfg.lines.forEach((l,i)=>{
      const lbl = i===0 ? `Droite 1 – Référence (0→100, pas=1)` : `Droite ${i+1}  (${l.start}→${l.end}, pas=${l.step})`;
      NL.draw(svg, l, w, 40+i*70, lbl);
    });
  },

  async save(){
    const name = $id('save-name').value.trim();
    if(!name){ alert('Entrez un nom.'); return; }
    if(!App.user) return;
    await App.saveCfg(name, {
      act: this.act,
      a1: this.getA1(), a1p: this.getPieces(1),
      a2: this.getA2(),
      a3: this.getA3()
    });
    await this.loadSaved();
    alert(`"${name}" sauvegardé.`);
  },

  async loadSaved(){
    if(!App.user) return;
    const store = await App.cfgStore();
    const cont = $id('saved-list');
    cont.innerHTML='';
    Object.keys(store).forEach(name=>{
      cont.insertAdjacentHTML('beforeend',`
        <div class="saved-item">
          <span class="sname" title="${name}">${name}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-grey btn-sm" onclick="T.load('${name}')">↓</button>
            <button class="btn btn-sm" style="background:#fdd;color:red;" onclick="T.del('${name}')">✕</button>
          </div>
        </div>
      `);
    });
  },

  async load(name){
    const store = await App.cfgStore();
    const cfg = store[name];
    if(!cfg) return;
    this.selectAct(cfg.act||1);
    if(cfg.a1){
      const c=cfg.a1;
      $id('a1-start').value=c.start; $id('a1-end').value=c.end; $id('a1-step').value=c.step;
      $id('a1-allticks').checked=(c.showTicks==='all');
      $id('a1-shownums').value=c.showNums||'all';
      $id('a1-everyn').value=c.everyN||2;
      if(c.showTicks!=='all') $id('a1-ticklist').value=(c.customTicks||[]).join(',');
      this.toggleTicks(1); this.onShowNumsChange(1);
      $id('a1-keephistory').checked = c.keepHistory ?? false;
    }
    if(cfg.a1p){
      const g=$id('a1-pgrid'); g.innerHTML='';
      cfg.a1p.forEach((v,i)=>{ const inp=this._inp(i+1); inp.value=v; g.appendChild(inp); });
    }
    if(cfg.a3) $id('a3-keephistory').checked = cfg.a3.keepHistory ?? false;
    $id('save-name').value=name;
    this.buildA2Lines(); this.buildA3Lines(); this.preview();
  },

  async del(name){
    if(!confirm(`Supprimer "${name}" ?`)) return;
    await App.delCfg(name);
    await this.loadSaved();
  },

  async exportJSON(){
    if(!App.user){ alert('Connectez-vous d\'abord.'); return; }
    const store = await App.cfgStore();
    const data = {
      version: 1,
      user: App.user,
      exportDate: new Date().toISOString().slice(0,10),
      configs: store
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plai-droite-${App.user}-${data.exportDate}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importJSON(input){
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if(!data.configs || typeof data.configs !== 'object')
          throw new Error('Format invalide');
        const store = await App.cfgStore();
        let count = 0;
        for(const [name, cfg] of Object.entries(data.configs)){
          if(store[name]){
            if(!confirm(`La config "${name}" existe déjà. Remplacer ?`)) continue;
          }
          await App.saveCfg(name, cfg);
          count++;
        }
        await this.loadSaved();
        alert(`${count} configuration(s) importée(s) avec succès.`);
      } catch(err) {
        alert('Fichier invalide : ' + err.message);
      }
      input.value = '';
    };
    reader.readAsText(file);
  },

  launch(){
    ['s1','s2','s3'].forEach(id=>$id(id).classList.add('hidden'));
    const act=this.act;
    App.mode='student';
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $id('sc-student').classList.add('active');
    $id('btn-mode').textContent='Mode enseignant';
    $id('s'+act).classList.remove('hidden');
    const cfg1=this.getA1(), p1=this.getPieces(1);
    const cfg2=this.getA2(), cfg3=this.getA3();
    requestAnimationFrame(()=>{
      if(act===1) A1.init(cfg1, p1);
      else if(act===2) A2.init(cfg2);
      else A3.init(cfg3);
    });
  }
};

// ─────────────────────────────────────────────────
// ACTIVITY 1 – ESTIMATION
// ─────────────────────────────────────────────────
const A1 = {
  cfg:null, pieces:[], idx:0,
  pos:null,
  li:null,
  svgW:0,
  history:[],

  init(cfg, pieces){
    this.cfg=cfg; this.pieces=pieces.slice(); this.idx=0;
    this.pos=cfg.start;
    this.history=[];
    this._reset();
    this._drawLine();
    this._drawPieceOnLine();
    this._drawTray();
    this._updateProgress();
  },

  _reset(){
    $id('s1-fb').classList.add('hidden');
    $id('s1-validate').classList.remove('hidden');
    $id('s1-next').classList.add('hidden');
    $id('s1-svg').querySelectorAll('.correct-mark').forEach(e=>e.remove());
  },

  _drawLine(){
    const svg=$id('s1-svg'); svg.innerHTML='';
    const area=$id('s1-nlarea');
    this.svgW = area.clientWidth > 40 ? area.clientWidth - 20 : 700;
    svg.setAttribute('width', this.svgW);
    this.li = NL.draw(svg, {...this.cfg}, this.svgW, 70);
    if(!this.li) this.li={ml:NL.ML, lw:this.svgW-NL.ML-NL.MR, y:70, ...this.cfg};
    if(this.cfg.keepHistory){
      const li=this.li;
      this.history.forEach(h=>{
        const hx=NL.v2x(h.pos, li.start, li.end, li.ml, li.lw);
        const topY=li.y-PR.totalH();
        const g=PR.make(h.val, hx, topY, '#bbb', '#f5f5f5');
        svg.appendChild(g);
      });
    }
  },

  _drawTray(){
    const svg=$id('s1-tray'); svg.innerHTML='';
    if(this.idx>=this.pieces.length) return;
    const g = PR.make(this.pieces[this.idx], 35, 5);
    svg.appendChild(g);
  },

  _drawPieceOnLine(){
    const svg=$id('s1-svg');
    svg.querySelectorAll('.piece-draggable').forEach(e=>e.remove());
    if(this.idx>=this.pieces.length) return;
    const val=this.pieces[this.idx];
    const li=this.li;
    const x = NL.v2x(this.pos, li.start, li.end, li.ml, li.lw);
    const tipTargetY = li.y;
    const topY = tipTargetY - PR.totalH();
    const g = PR.make(val, x, topY);
    g.classList.add('piece-draggable');
    g.style.cursor='grab';
    this._bindDrag(g, svg, li);
    svg.appendChild(g);
  },

  _bindDrag(g, svg, li){
    const onStart = (e) => {
      e.preventDefault();
      g.style.cursor='grabbing';
      const move = (ev) => {
        ev.preventDefault();
        const [cx] = getClientXY(ev);
        const rect = svg.getBoundingClientRect();
        const svgX = cx - rect.left;
        const v = NL.x2v(svgX, li.start, li.end, li.ml, li.lw, li.step);
        this.pos = v;
        const nx = NL.v2x(v, li.start, li.end, li.ml, li.lw);
        this._movePieceX(g, nx);
      };
      const up = () => {
        g.style.cursor='grab';
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', up);
      };
      document.addEventListener('mousemove', move, {passive:false});
      document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, {passive:false});
      document.addEventListener('touchend', up);
    };
    g.addEventListener('mousedown', onStart);
    g.addEventListener('touchstart', onStart, {passive:false});
  },

  _movePieceX(g, newX){
    const rect = g.querySelector('rect');
    const oldCX = parseFloat(rect.getAttribute('x')) + PR.W/2;
    const dx = newX - oldCX;
    rect.setAttribute('x', parseFloat(rect.getAttribute('x'))+dx);
    const poly = g.querySelector('polygon');
    const pts = poly.getAttribute('points').split(' ').map(pt=>{
      const[px,py]=pt.split(',').map(Number);
      return `${px+dx},${py}`;
    });
    poly.setAttribute('points', pts.join(' '));
    const txt = g.querySelector('text');
    txt.setAttribute('x', parseFloat(txt.getAttribute('x'))+dx);
  },

  validate(){
    if(this.idx>=this.pieces.length) return;
    const correct = this.pieces[this.idx];
    const li = this.li;
    const svg = $id('s1-svg');
    const cx = NL.v2x(correct, li.start, li.end, li.ml, li.lw);
    const vl = svgEl('line',{x1:cx,y1:li.y-22,x2:cx,y2:li.y+22,stroke:'#e91e8c','stroke-width':'2','stroke-dasharray':'5,3',class:'correct-mark blink'});
    svg.appendChild(vl);
    const lbl = svgEl('text',{x:cx,y:li.y+40,'text-anchor':'middle','font-size':'14','font-weight':'bold',fill:'#e91e8c',class:'correct-mark blink'});
    lbl.textContent = correct;
    svg.appendChild(lbl);
    const placed = this.pos;
    const fb = $id('s1-fb');
    fb.classList.remove('hidden');
    if(placed === correct){
      fb.textContent='✓ Parfait !'; fb.style.color='#4caf50';
    } else {
      fb.textContent=`Ta réponse : ${placed}  |  Bonne position : ${correct}`; fb.style.color='#e91e8c';
    }
    $id('s1-validate').classList.add('hidden');
    $id('s1-next').classList.remove('hidden');
  },

  next(){
    if(this.cfg.keepHistory){
      this.history.push({ val: this.pieces[this.idx], pos: this.pos });
    }
    this.idx++;
    if(this.idx>=this.pieces.length){ $id('end-overlay').classList.remove('hidden'); return; }
    this.pos = this.cfg.start;
    this._reset();
    this._drawLine();
    this._drawPieceOnLine();
    this._drawTray();
    this._updateProgress();
  },

  _updateProgress(){
    $id('s1-prog').textContent=`Pièce ${this.idx+1} / ${this.pieces.length}`;
    $id('s1-info').textContent=`Positionne la pièce ${this.pieces[this.idx]||''} sur la droite graduée`;
  }
};

// ─────────────────────────────────────────────────
// ACTIVITY 2 – APPRENTISSAGE  (blocs)
// ─────────────────────────────────────────────────
const A2 = {
  cfg:null, linesInfo:[], placements:[], svgW:0,

  init(cfg){
    this.cfg=cfg;
    this.placements = cfg.lines.map(()=>[]);
    this._render();
    this._buildTray();
  },

  _render(){
    const svg=$id('s2-svg'); svg.innerHTML='';
    const area=$id('s2-nlarea');
    this.svgW = area.clientWidth > 40 ? area.clientWidth-20 : 700;
    const n=this.cfg.n;
    const h = 40+n*80;
    svg.setAttribute('width',this.svgW); svg.setAttribute('height',h);
    this.linesInfo=[];
    this.cfg.lines.forEach((l,i)=>{
      const start = l.start ?? 0;
      const end   = l.end   ?? 100;
      const y=50+i*80;
      const li=NL.draw(svg,{start,end,step:l.step,showTicks:'all',showNums:l.showNums||'all',everyN:1},
        this.svgW, y, `Droite ${i+1}  (${start}→${end}, pas=${l.step})`);
      this.linesInfo.push(li||{ml:NL.ML,lw:this.svgW-NL.ML-NL.MR,y,start,end,step:l.step});
    });
    this._renderPlaced(svg);
  },

  _blocPx(){
    const lw    = this.linesInfo[0]?.lw || 600;
    const li0   = this.cfg.lines[0];
    const range = ((li0?.end ?? 100) - (li0?.start ?? 0)) || 100;
    return Math.max(16, Math.round(this.cfg.unit * (lw / range)));
  },

  _renderPlaced(svg){
    svg.querySelectorAll('.a2-placed').forEach(e=>e.remove());
    const NAVY='#1e3a8a', NAVY_FILL='rgba(30,58,138,0.18)';
    this.placements.forEach((arr,li_idx)=>{
      const li=this.linesInfo[li_idx];
      const range = ((li.end ?? 100) - (li.start ?? 0)) || 100;
      const bw = this.cfg.unit * (li.lw / range);
      arr.forEach(v=>{
        const x1=NL.v2x(v, li.start, li.end, li.ml, li.lw);
        const cx=x1 + bw/2;
        const r=svgEl('rect',{x:x1, y:li.y-14, width:bw, height:28, rx:'3',
          fill:NAVY_FILL, stroke:NAVY, 'stroke-width':'2', class:'a2-placed'});
        const t=svgEl('text',{x:cx, y:li.y+5, 'text-anchor':'middle',
          'font-size':'12','font-weight':'bold', fill:NAVY,
          'font-family':'Segoe UI,Arial', class:'a2-placed'});
        t.textContent=this.cfg.unit;
        svg.appendChild(r); svg.appendChild(t);
      });
    });
  },

  _buildTray(){
    const tray=$id('s2-tray');
    Array.from(tray.children).forEach(c=>{ if(!c.classList.contains('piece-tray-label')) c.remove(); });
    const NAVY='#1e3a8a', NAVY_FILL='rgba(30,58,138,0.15)';
    const count = 50;
    const bw = this._blocPx();
    const bh = 28;
    for(let i=0;i<count;i++){
      const wrap=document.createElement('div');
      wrap.style.cssText='display:inline-block;cursor:grab;vertical-align:middle;';
      wrap.dataset.blocW=bw; wrap.dataset.blocH=bh;
      const s=document.createElementNS(SVG,'svg');
      s.setAttribute('width', bw+4); s.setAttribute('height', bh+4);
      s.setAttribute('overflow','visible');
      s.appendChild(svgEl('rect',{x:'2',y:'2',width:bw,height:bh,rx:'3',
        fill:NAVY_FILL, stroke:NAVY,'stroke-width':'2'}));
      const t=svgEl('text',{x:bw/2+2, y:bh/2+7,
        'text-anchor':'middle','font-size': bw>30?'13':'10',
        'font-weight':'bold',fill:NAVY,'font-family':'Segoe UI,Arial'});
      t.textContent=this.cfg.unit;
      s.appendChild(t); wrap.appendChild(s);
      wrap.addEventListener('mousedown',e=>this._dragBlock(e,wrap));
      wrap.addEventListener('touchstart',e=>this._dragBlock(e,wrap),{passive:false});
      tray.appendChild(wrap);
    }
  },

  _dragBlock(e, blockEl){
    e.preventDefault();
    const bw=parseInt(blockEl.dataset.blocW)||50;
    const bh=parseInt(blockEl.dataset.blocH)||30;
    const clone=blockEl.cloneNode(true);
    clone.style.cssText='position:fixed;pointer-events:none;z-index:100;opacity:.9;';
    document.body.appendChild(clone);
    const move=(ev)=>{
      ev.preventDefault();
      const[cx,cy]=getClientXY(ev);
      clone.style.left=(cx - bw/2)+'px';
      clone.style.top=(cy - bh/2)+'px';
    };
    const up=(ev)=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      document.removeEventListener('touchmove',move);
      document.removeEventListener('touchend',up);
      clone.remove();
      const[cx,cy]=getClientXY(ev);
      this._drop(cx,cy);
    };
    document.addEventListener('mousemove',move,{passive:false});
    document.addEventListener('mouseup',up);
    document.addEventListener('touchmove',move,{passive:false});
    document.addEventListener('touchend',up);
    move(e);
  },

  _drop(cx,cy){
    const svg=$id('s2-svg');
    const r=svg.getBoundingClientRect();
    const sx=cx-r.left, sy=cy-r.top;
    let best=-1, bestD=60;
    this.linesInfo.forEach((li,i)=>{
      if(i===0) return;
      const d=Math.abs(sy-li.y);
      if(d<bestD){ bestD=d; best=i; }
    });
    if(best<0) return;
    const li=this.linesInfo[best];
    const v=NL.x2v(sx, li.start, li.end, li.ml, li.lw, this.cfg.unit);
    if(v >= 100) return;
    this.placements[best].push(v);
    this._renderPlaced(svg);
  },

  finish(){ $id('end-overlay').classList.remove('hidden'); },

  reset(){
    this.placements=this.cfg.lines.map(()=>[]);
    this._renderPlaced($id('s2-svg'));
  }
};

// ─────────────────────────────────────────────────
// ACTIVITY 3 – MIX
// ─────────────────────────────────────────────────
const A3 = {
  cfg:null, pieces:[], idx:0,
  linesInfo:[], svgW:0,
  placed:[],
  doneLine:[],

  init(cfg){
    this.cfg=cfg; this.pieces=cfg.pieces.slice(); this.idx=0;
    this.placed=cfg.pieces.map(()=>cfg.lines.map(()=>null));
    this.doneLine=cfg.lines.map(()=>false);
    this._reset();
    this._renderLines();
    this._renderTray();
    this._updateProgress();
  },

  _reset(){
    $id('s3-fb').classList.add('hidden');
    $id('s3-validate').classList.remove('hidden');
    $id('s3-next').classList.add('hidden');
    $id('s3-svg').querySelectorAll('.correct-mark3').forEach(e=>e.remove());
  },

  _renderLines(){
    const svg=$id('s3-svg'); svg.innerHTML='';
    const area=$id('s3-nlarea');
    this.svgW=area.clientWidth > 40 ? area.clientWidth-20 : 700;
    const n=this.cfg.n;
    const visibleN = this.cfg.showLine1 !== false ? n : n-1;
    const h=40+visibleN*80;
    svg.setAttribute('width',this.svgW); svg.setAttribute('height',h);
    this.linesInfo=[];
    let renderIdx=0;
    this.cfg.lines.forEach((l,i)=>{
      if(i===0 && this.cfg.showLine1===false){
        this.linesInfo.push(null);
        return;
      }
      const y=50+renderIdx*80;
      renderIdx++;
      const lbl = i===0
        ? `Droite 1 – Référence (0→100, pas=1)`
        : `Droite ${i+1}  (${l.start}→${l.end}, pas=${l.step})`;
      const li=NL.draw(svg, l, this.svgW, y, lbl);
      this.linesInfo.push(li||{ml:NL.ML,lw:this.svgW-NL.ML-NL.MR,y,...l});
    });
    this._renderAllPlaced(svg);
  },

  _renderAllPlaced(svg){
    svg.querySelectorAll('.a3-placed').forEach(e=>e.remove());
    if(this.cfg.keepHistory){
      this.placed.forEach((round,ri)=>{
        if(ri===this.idx) return;
        round.forEach((v,li_idx)=>{
          if(v===null) return;
          const li=this.linesInfo[li_idx];
          if(!li) return;
          const x=NL.v2x(v,li.start,li.end,li.ml,li.lw);
          const topY=li.y-PR.totalH();
          const g=PR.make(this.pieces[ri],x,topY,'#999','#f9f9f9');
          g.classList.add('a3-placed');
          svg.appendChild(g);
        });
      });
    }
    this.doneLine.forEach((done,li_idx)=>{
      if(!done) return;
      const v=this.placed[this.idx][li_idx];
      if(v===null) return;
      const li=this.linesInfo[li_idx];
      if(!li) return;
      const x=NL.v2x(v,li.start,li.end,li.ml,li.lw);
      const topY=li.y-PR.totalH();
      const g=PR.make(this.pieces[this.idx],x,topY,'#e91e8c','#fff3f8');
      g.classList.add('a3-placed');
      svg.appendChild(g);
    });
  },

  _renderTray(){
    const tray=$id('s3-tray');
    Array.from(tray.children).forEach(c=>{
      if(!c.classList.contains('piece-tray-label')) c.remove();
    });
    if(this.idx>=this.pieces.length) return;
    const val=this.pieces[this.idx];
    const PW=PR.W, PH=PR.HR+PR.HT;
    for(let i=1;i<this.cfg.n;i++){
      if(this.doneLine[i]) continue;
      const li = this.linesInfo[i];
      if(!li) continue; // droite masquée (showLine1=false sur droite 0 ne s'applique pas ici)
      const wrap=document.createElement('div');
      wrap.style.cssText='display:inline-block;cursor:grab;vertical-align:middle;margin-right:12px;';
      const s=document.createElementNS(SVG,'svg');
      s.setAttribute('width', PW+4); s.setAttribute('height', PH+4);
      s.style.cssText='overflow:visible;display:block;';
      s.appendChild(PR.make(val, (PW+4)/2, 2, '#e91e8c', '#fff3f8'));
      wrap.appendChild(s);
      wrap.addEventListener('mousedown', e=>this._dragPiece(e, val));
      wrap.addEventListener('touchstart', e=>this._dragPiece(e, val), {passive:false});
      tray.appendChild(wrap);
    }
  },

  _dragPiece(e, val){
    e.preventDefault();
    const PW=PR.W, PH=PR.HR+PR.HT;
    const floatDiv=document.createElement('div');
    floatDiv.style.cssText='position:fixed;pointer-events:none;z-index:200;';
    const floatSvg=document.createElementNS(SVG,'svg');
    floatSvg.setAttribute('width', PW+4); floatSvg.setAttribute('height', PH+4);
    floatSvg.style.cssText='overflow:visible;display:block;';
    floatSvg.appendChild(PR.make(val, (PW+4)/2, 2, '#e91e8c', '#fff3f8'));
    floatDiv.appendChild(floatSvg);
    document.body.appendChild(floatDiv);

    const move=(ev)=>{
      ev.preventDefault();
      const[cx,cy]=getClientXY(ev);
      floatDiv.style.left=(cx - (PW+4)/2)+'px';
      floatDiv.style.top =(cy - PH - 2)+'px';
    };

    const up=(ev)=>{
      document.removeEventListener('mousemove',move);
      document.removeEventListener('mouseup',up);
      document.removeEventListener('touchmove',move);
      document.removeEventListener('touchend',up);
      floatDiv.remove();
      const[cx,cy]=getClientXY(ev);
      const svg=$id('s3-svg');
      const r=svg.getBoundingClientRect();
      const sx=cx-r.left;
      const sy=cy-r.top;
      let best=-1, bestD=60;
      this.linesInfo.forEach((li,i)=>{
        if(i===0) return;
        if(!li) return;
        if(this.doneLine[i]) return;
        const d=Math.abs(sy-li.y);
        if(d<bestD){ bestD=d; best=i; }
      });
      if(best<0) return;
      const li=this.linesInfo[best];
      if(val>li.end) return;
      const v=NL.x2v(sx, li.start, li.end, li.ml, li.lw, 1);
      this.placed[this.idx][best]=v;
      this.doneLine[best]=true;
      this._renderAllPlaced($id('s3-svg'));
      this._renderTray();
    };

    document.addEventListener('mousemove',move,{passive:false});
    document.addEventListener('mouseup',up);
    document.addEventListener('touchmove',move,{passive:false});
    document.addEventListener('touchend',up);
    move(e);
  },

  validate(){
    if(this.idx>=this.pieces.length) return;
    const val=this.pieces[this.idx];
    const svg=$id('s3-svg');
    this.linesInfo.forEach((li,i)=>{
      if(i===0) return;
      if(!li) return;
      if(val>li.end) return;
      const cx=NL.v2x(val,li.start,li.end,li.ml,li.lw);
      const vl=svgEl('line',{x1:cx,y1:li.y-22,x2:cx,y2:li.y+22,stroke:'#e91e8c','stroke-width':'2',
        'stroke-dasharray':'5,3',class:'correct-mark3 blink'});
      svg.appendChild(vl);
      const lbl=svgEl('text',{x:cx,y:li.y+38,'text-anchor':'middle','font-size':'13','font-weight':'bold',
        fill:'#e91e8c',class:'correct-mark3 blink'});
      lbl.textContent=val; svg.appendChild(lbl);
    });
    const fb=$id('s3-fb');
    fb.classList.remove('hidden');
    fb.textContent='Bonne(s) position(s) indiquée(s) en rose ↑';
    fb.style.color='#e91e8c';
    $id('s3-validate').classList.add('hidden');
    $id('s3-next').classList.remove('hidden');
  },

  next(){
    this.idx++;
    this.doneLine=this.cfg.lines.map(()=>false);
    if(this.idx>=this.pieces.length){ $id('end-overlay').classList.remove('hidden'); return; }
    this._reset();
    this._renderLines();
    this._renderTray();
    this._updateProgress();
  },

  _updateProgress(){
    $id('s3-prog').textContent=`Nombre ${this.idx+1} / ${this.pieces.length}`;
    const val=this.pieces[this.idx];
    const nAdd=this.cfg.n-1;
    $id('s3-info').textContent=`Place le nombre ${val||''} sur chaque droite (${nAdd} pièce${nAdd>1?'s':''})`;
  }
};

// ─────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', ()=>{
  App.init();
  $id('l-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') App.login(); });
});

// Exposer les modules pour les handlers onclick dans le HTML
window.App = App;
window.T   = T;
window.A1  = A1;
window.A2  = A2;
window.A3  = A3;
