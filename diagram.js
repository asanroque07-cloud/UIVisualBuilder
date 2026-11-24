'use strict';
/* Diagram Studio — ERD, DFD and use case diagrams, all local to this browser. */
const STORE='diagramstudio:diagrams', LAST='diagramstudio:last', OPTS='diagramstudio:opts', OLDSTORE='uivb:diagrams';
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const clone=o=>JSON.parse(JSON.stringify(o));
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
let toastT=null;
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}

/* ---------- diagram types ---------- */
const MODES={
  erd:{
    n:'ERD',full:'Entity relationship diagram',short:'Entity relationship',
    hint:'Tables, the columns inside them, and the relationships that join them.',
    kinds:{
      entity:{n:'Table',d:'Rows you store',w:200,cls:'ent',icon:'▤'},
      weak:{n:'Weak table',d:'Needs a parent table',w:200,cls:'ent weak',icon:'▥'},
      rel:{n:'Relationship',d:'Joins two tables',w:152,cls:'rel',icon:'◇'},
      attr:{n:'Attribute',d:'A column on its own',w:150,cls:'attr',icon:'○'}
    }
  },
  dfd:{
    n:'DFD',full:'Data flow diagram',short:'Data flow',
    hint:'Who sends data, which process changes it, and where it comes to rest.',
    kinds:{
      ext:{n:'External entity',d:'Person or system outside',w:176,cls:'ext',icon:'▢'},
      proc:{n:'Process',d:'Turns input into output',w:176,cls:'proc',icon:'◍'},
      store:{n:'Data store',d:'Where data rests',w:180,cls:'store',icon:'▤'}
    }
  },
  uc:{
    n:'Use case',full:'Use case diagram',short:'Actors and goals',
    hint:'Actors outside the system and the goals they can reach inside it.',
    kinds:{
      actor:{n:'Actor',d:'Person or system using it',w:156,cls:'actor',icon:'☺'},
      uc:{n:'Use case',d:'A goal the actor can reach',w:190,cls:'uc',icon:'◯'}
    }
  }
};
const CARD=['1:1','1:N','N:1','N:M','0..1:N'];

/* ---------- state ---------- */
const D={mode:'erd',id:null,name:'Untitled ERD',system:'Shop',nodes:[],edges:[],sel:null,selEdge:null,from:null,seq:1,cw:0,fit:false,ready:false,snap:true,flow:true,saved:0};
function def(kind){return (MODES[D.mode]||MODES.erd).kinds[kind]||null}
function nodeOf(id){return D.nodes.find(n=>n.id===id)||null}
function edgeOf(id){return D.edges.find(e=>e.id===id)||null}
function fieldsOf(n){
 return String(n.fields||'').split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{
  const m=line.match(/^([*#]+)\s*(.+)$/);
  if(!m)return {name:line,key:''};
  const k=m[1];
  return {name:m[2].trim(),key:k.indexOf('*')>=0&&k.indexOf('#')>=0?'PK,FK':k.indexOf('*')>=0?'PK':k.indexOf('#')>=0?'FK':''};
 });
}
function hasFields(n){return D.mode==='erd'&&(n.kind==='entity'||n.kind==='weak')}
function mk(kind,x,y,over){
 const d=def(kind)||{w:170};
 return {id:'n'+(D.seq++),kind,name:'',note:'',fields:'',x:Math.max(4,Math.round(x)),y:Math.max(4,Math.round(y)),w:(d&&d.w)||170,...(over||{})};
}
function link(a,b,card,label){return {id:'e'+(D.seq++),from:a,to:b,card:card==null?(D.mode==='erd'?'1:N':''):card,label:label||''}}

/* ---------- templates ---------- */
const TPL={
 erd:[
  {n:'Customer orders',s:'Four tables with keys and line items',build:()=>{
    const c=mk('entity',26,32,{name:'Customer',fields:'*id\nname\nemail'});
    const o=mk('entity',330,32,{name:'Order',fields:'*id\n#customer_id\ntotal\nplaced_at'});
    const p=mk('entity',26,236,{name:'Product',fields:'*id\nname\nprice'});
    const i=mk('entity',330,236,{name:'Order item',fields:'*id\n#order_id\n#product_id\nquantity'});
    return {nodes:[c,o,p,i],edges:[link(c.id,o.id,'1:N','places'),link(o.id,i.id,'1:N','contains'),link(p.id,i.id,'1:N','appears in')]};
  }},
  {n:'Blog',s:'Authors, posts and comments',build:()=>{
    const a=mk('entity',26,32,{name:'Author',fields:'*id\nname\nbio'});
    const p=mk('entity',330,32,{name:'Post',fields:'*id\n#author_id\ntitle\nbody\npublished_at'});
    const c=mk('entity',330,230,{name:'Comment',fields:'*id\n#post_id\n#author_id\nbody'});
    const t=mk('entity',26,230,{name:'Tag',fields:'*id\nlabel'});
    return {nodes:[a,p,c,t],edges:[link(a.id,p.id,'1:N','writes'),link(p.id,c.id,'1:N','has'),link(t.id,p.id,'N:M','labels')]};
  }}
 ],
 dfd:[
  {n:'Order fulfilment',s:'Customer, checkout, warehouse and order store',build:()=>{
    const c=mk('ext',24,58,{name:'Customer',note:'Places and tracks orders'});
    const k=mk('proc',300,44,{name:'Checkout',note:'Validates the cart and takes payment'});
    const s=mk('store',300,246,{name:'Orders',note:'One row per order'});
    const w=mk('proc',580,44,{name:'Warehouse',note:'Picks and packs the items'});
    const d=mk('ext',580,246,{name:'Courier',note:'Collects the parcel'});
    return {nodes:[c,k,s,w,d],edges:[link(c.id,k.id,'','cart and address'),link(k.id,s.id,'','order record'),link(s.id,w.id,'','pick list'),link(k.id,w.id,'','confirmed order'),link(w.id,d.id,'','dispatch note')]};
  }},
  {n:'Support desk',s:'Ticket intake, triage and a ticket store',build:()=>{
    const u=mk('ext',24,58,{name:'Reporter',note:'Raises a ticket'});
    const s=mk('store',300,44,{name:'Tickets',note:'Status and owner'});
    const t=mk('proc',300,236,{name:'Triage',note:'Routes the ticket by topic'});
    const a=mk('ext',580,236,{name:'Agent',note:'Answers the ticket'});
    return {nodes:[u,s,t,a],edges:[link(u.id,s.id,'','new ticket'),link(s.id,t.id,'','open ticket'),link(t.id,a.id,'','assignment')]};
  }}
 ],
 uc:[
  {n:'Online shop',s:'Shopper goals inside one system',sys:'Shop',build:()=>{
    const a=mk('actor',24,110,{name:'Shopper',note:'Person buying'});
    const b=mk('uc',300,60,{name:'Browse products'});
    const o=mk('uc',300,152,{name:'Place order'});
    const t=mk('uc',300,244,{name:'Track delivery'});
    return {nodes:[a,b,o,t],edges:[link(a.id,b.id,'','uses'),link(a.id,o.id,'','uses'),link(a.id,t.id,'','uses')]};
  }},
  {n:'Library app',s:'Member and librarian goals',sys:'Library system',build:()=>{
    const m=mk('actor',24,60,{name:'Member',note:'Borrows books'});
    const l=mk('actor',24,330,{name:'Librarian',note:'Runs the desk'});
    const b=mk('uc',300,50,{name:'Search catalogue'});
    const o=mk('uc',300,142,{name:'Borrow book'});
    const r=mk('uc',300,234,{name:'Return book'});
    const f=mk('uc',300,326,{name:'Collect fine'});
    return {nodes:[m,l,b,o,r,f],edges:[link(m.id,b.id,'','uses'),link(m.id,o.id,'','uses'),link(m.id,r.id,'','uses'),link(l.id,f.id,'','uses')]};
  }}
 ]
};

/* ---------- storage ---------- */
function readAll(){
 let list=[];
 try{list=JSON.parse(localStorage.getItem(STORE)||'[]')}catch(_){}
 if(!Array.isArray(list)){
  try{const old=JSON.parse(localStorage.getItem(OLDSTORE)||'[]');if(Array.isArray(old))list=old}catch(_){}
 }
 return list.filter(d=>d&&d.id).map(d=>({...d,mode:MODES[d.mode]?d.mode:'erd',nodes:Array.isArray(d.nodes)?d.nodes:[],edges:Array.isArray(d.edges)?d.edges:[]}));
}
function writeAll(list){try{localStorage.setItem(STORE,JSON.stringify(list.slice(0,40)))}catch(e){toast('Could not save here: '+(e.message||e));return false}return true}
function readOpts(){
 try{const o=JSON.parse(localStorage.getItem(OPTS)||'{}');
  if(MODES[o.mode])D.mode=o.mode;
  if(typeof o.snap==='boolean')D.snap=o.snap;
  if(typeof o.flow==='boolean')D.flow=o.flow;
 }catch(_){}
}
function writeOpts(){try{localStorage.setItem(OPTS,JSON.stringify({mode:D.mode,snap:D.snap,flow:D.flow}))}catch(_){}}

/* ---------- dirty state ---------- */
function setDirty(v){
 D.dirty=!!v;
 const d=$('#dirty');if(d)d.hidden=!v;
 const f=$('#footSaved');if(f)f.textContent=v?'Unsaved changes':(D.saved?'Saved '+new Date(D.saved).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not saved yet');
}
function markDirty(){setDirty(true)}

/* ---------- undo ---------- */
let undoStack=[],redoStack=[];
function state(){return JSON.stringify({mode:D.mode,id:D.id,name:D.name,system:D.system,nodes:D.nodes,edges:D.edges,seq:D.seq})}
function hist(pre){
 undoStack.push(pre||state());
 if(undoStack.length>80)undoStack.shift();
 redoStack=[];
 markDirty();syncHist();
}
function syncHist(){
 const u=$('#btnUndo'),r=$('#btnRedo');
 if(u)u.disabled=!undoStack.length;
 if(r)r.disabled=!redoStack.length;
}
function applyState(s){
 const o=JSON.parse(s);
 D.mode=MODES[o.mode]?o.mode:'erd'; D.id=o.id;D.name=o.name||'Untitled diagram';D.system=o.system||D.system;
 D.nodes=Array.isArray(o.nodes)?o.nodes:[];D.edges=Array.isArray(o.edges)?o.edges:[];
 D.seq=o.seq||1;D.sel=null;D.selEdge=null;D.from=null;
 render();setDirty(true);
}
function undo(){if(!undoStack.length)return;redoStack.push(state());applyState(undoStack.pop());syncHist();toast('Undone')}
function redo(){if(!redoStack.length)return;undoStack.push(state());applyState(redoStack.pop());syncHist();toast('Redone')}

/* ---------- geometry ---------- */
function box(el){return {x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}}
function clip(b,dx,dy){
 const cx=b.x+b.w/2,cy=b.y+b.h/2;
 const sx=dx?b.w/2/Math.abs(dx):Infinity,sy=dy?b.h/2/Math.abs(dy):Infinity;
 const s=Math.min(sx,sy);
 if(!isFinite(s))return {x:cx,y:cy};
 return {x:cx+dx*s,y:cy+dy*s};
}
function overlap(a,b,pad){
 pad=pad||0;
 return a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
}
function nodeEl(id){return $('#nodes .dgn[data-id="'+id+'"]')}
function clearLabels(){
 const svg=$('#labels');if(!svg)return;
 const cv=$('#canvas'),nodes=$$('#nodes .dgn').map(box),cw=cv.clientWidth;
 const rects=nodes;
 $$('text',svg).forEach(t=>{
  let x=parseFloat(t.getAttribute('x'))||0,y=parseFloat(t.getAttribute('y'))||0;
  for(let i=0;i<4;i++){
   const bb=t.getBBox();
   const hit=rects.find(r=>bb.x<r.x+r.w+3&&bb.x+bb.width>r.x-3&&bb.y<r.y+r.h+3&&bb.y+bb.height>r.y-3);
   if(!hit)break;
   const above=y<=hit.y+hit.h/2;
   const ny=above?hit.y-4:hit.y+hit.h+bb.height+4;
   y=(above&&ny-bb.height<1)?hit.y+hit.h+bb.height+4:ny;
   t.setAttribute('y',y);
  }
  const bb=t.getBBox();
  if(bb.x<3)t.setAttribute('x',x+(3-bb.x));
  else if(bb.x+bb.width>cw-3)t.setAttribute('x',x-(bb.x+bb.width-cw+3));
  if(bb.y<1)t.setAttribute('y',y+(1-bb.y));
 });
}

/* ---------- render ---------- */
function fieldsHtml(n){
 const f=fieldsOf(n);
 if(!f.length)return '<p class="mute">no columns yet</p>';
 return '<ul>'+f.map(x=>'<li><span>'+esc(x.name)+'</span>'+(x.key?'<em'+(x.key.indexOf('FK')>=0?' class="fk"':'')+'>'+x.key+'</em>':'')+'</li>').join('')+'</ul>';
}
function nodeHtml(n){
 const d=def(n.kind)||{n:'Object',cls:'',icon:'▢'};
 const cls=[d.cls||'',D.sel===n.id?'on':'',D.from===n.id?'from':''].filter(Boolean).join(' ');
 const w=n.w||d.w||170;
 const style='left:'+n.x+'px;top:'+n.y+'px;width:'+w+'px'+(n.h?'height:'+n.h+'px':'');
 let body='';
 if(hasFields(n))body=fieldsHtml(n);
 else if(n.note)body='<p class="sub">'+esc(n.note)+'</p>';
 return '<div class="dgn '+cls+'" data-id="'+n.id+'" style="'+style+'">'
  +'<header><i>'+d.icon+'</i><b>'+esc(n.name||'Untitled')+'</b><button type="button" data-link="'+n.id+'" title="Connect to another object" aria-label="Connect '+esc(n.name||'object')+' to another object">&rarr;</button></header>'
  +body+'</div>';
}
function renderNodes(){
 const box=$('#nodes');if(!box)return;
 // system boundaries always sit behind everything else
 box.innerHTML=D.nodes.map(nodeHtml).join('');
 const hint=$('#hint');if(hint)hint.hidden=D.nodes.length>0;
 paintLink();
}
function fit(force){
 const cv=$('#canvas');if(!cv)return false;
 const cw=cv.clientWidth,changed=D.cw!==cw;
 D.cw=cw;
 if(!D.nodes.length)return false;
 if(!changed&&!force)return false;
 const boxes=D.nodes.map(n=>{const el=nodeEl(n.id);return el?{n,b:box(el)}:null}).filter(Boolean);
 if(boxes.length<2)return false;
 let over=false;
 for(let i=0;i<boxes.length&&!over;i++)for(let j=i+1;j<boxes.length;j++){
  if(overlap(boxes[i].b,boxes[j].b,2)){over=true;break}
 }
 if(!over)return false;
 const pad=22,gap=18,gapY=26;
 const pack=(list)=>{let x=pad,y=pad,bottom=y;list.forEach(({n,b})=>{if(x+b.w>cw-12&&x>pad){x=pad;y=bottom+gapY}n.x=x;n.y=y;x+=b.w+gap;bottom=Math.max(bottom,y+b.h)});return bottom};
 let need=0;
 if(D.mode==='uc'){
  const actors=boxes.filter(o=>o.n.kind==='actor'),ucs=boxes.filter(o=>o.n.kind==='uc'),rest=boxes.filter(o=>o.n.kind!=='actor'&&o.n.kind!=='uc');
  let y=pad;
  const actorW=actors.length?Math.max(...actors.map(o=>o.b.w)):0;
  actors.forEach(({n,b})=>{n.x=pad;n.y=y;y+=b.h+gapY});
  const colX=pad+actorW+40;
  const ucW=ucs.length?Math.max(...ucs.map(o=>o.b.w)):0;
  if(ucs.length&&actors.length&&colX+ucW+38<=cw-4){
   let uy=pad;
   ucs.forEach(({n,b})=>{n.x=colX;n.y=uy;uy+=b.h+gapY});
   need=Math.max(y,uy);
  }else if(ucs.length){
   let ux=pad,uy=actors.length?y+56:pad,maxY=uy;
   ucs.forEach(({n,b})=>{
    if(ux+b.w>cw-12&&ux>pad){ux=pad;uy=maxY+gapY}
    n.x=ux;n.y=uy;ux+=b.w+gap;maxY=Math.max(maxY,uy+b.h);
   });
   need=Math.max(maxY,actors.length?y:0);
  }else need=y;
  if(rest.length)need=Math.max(need,pack(rest));
 }else need=pack(boxes);
 need+=pad;
 cv.style.minHeight=need>cv.clientHeight?need+'px':'';
 return true;
}
function draw(){
 const svg=$('#edges'),cv=$('#canvas');if(!svg||!cv)return;
 const cw=cv.clientWidth,ch=cv.clientHeight;
 svg.setAttribute('viewBox','0 0 '+cw+' '+ch);
 const out=['<defs><marker id="arw" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>'];
 const boxes=$$('#nodes .dgn').map(el=>({el,b:box(el)}));
 const boxFor=el=>{const f=boxes.find(o=>o.el===el);return f?f.b:box(el)};
 const labels=[];
 D.edges.forEach(e=>{
  const a=nodeEl(e.from),b=nodeEl(e.to);
  if(!a||!b)return;
  const A=boxFor(a),B=boxFor(b);
  const dx=B.x+B.w/2-(A.x+A.w/2),dy=B.y+B.h/2-(A.y+A.h/2);
  const p1=clip(A,dx,dy),p2=clip(B,-dx,-dy);
  const len=Math.hypot(p2.x-p1.x,p2.y-p1.y)||1;
  const g=Math.min(2.5,len/3),ux=(p2.x-p1.x)/len,uy=(p2.y-p1.y)/len;
  const x1=p1.x+ux*g,y1=p1.y+uy*g,x2=p2.x-ux*g,y2=p2.y-uy*g;
  const on=D.selEdge===e.id?' on':'';
  out.push('<line class="ln'+on+'" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" marker-end="url(#arw)"/>');
  out.push('<line class="hit" data-edge="'+e.id+'" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>');
  if(e.label){
   const mx=(x1+x2)/2,my=(y1+y2)/2,nx=-uy,ny=ux;
   const top=Math.min(A.y,B.y),bottom=Math.max(A.y+A.h,B.y+B.h);
   const cand=[{x:mx+nx*13,y:my+ny*13},{x:mx-nx*13,y:my-ny*13},{x:mx,y:top-11},{x:mx,y:bottom+19}];
   const tw=String(e.label).length*6.4+6,th=13;
   const hits=p=>boxes.some(o=>p.x-tw/2<o.b.x+o.b.w+3&&p.x+tw/2>o.b.x-3&&p.y-th/2<o.b.y+o.b.h+3&&p.y+th/2>o.b.y-3);
   const pick=cand.find(p=>!hits(p))||cand[0];
   labels.push('<text x="'+pick.x.toFixed(1)+'" y="'+pick.y.toFixed(1)+'" text-anchor="middle" dominant-baseline="middle">'+esc(e.label)+'</text>');
  }
 });
 svg.innerHTML=out.join('');
 const lsvg=$('#labels');
 if(lsvg){lsvg.setAttribute('viewBox','0 0 '+cw+' '+ch);lsvg.innerHTML=labels.join('');clearLabels()}
 drawBoundary();
}

/* ---------- panels ---------- */
function typesUI(){
 const el=$('#types');if(!el)return;
 el.innerHTML=Object.keys(MODES).map(k=>'<button type="button" role="tab" aria-selected="'+(D.mode===k)+'" class="'+(D.mode===k?'on':'')+'" data-mode="'+k+'"><b>'+MODES[k].n+'</b>'+MODES[k].short+'</button>').join('');
 const h=$('#typeHint');if(h)h.textContent=MODES[D.mode].hint;
 const b=$('#typeBadge');if(b)b.textContent=MODES[D.mode].n;
 const m=$('#modeLab');if(m)m.textContent=MODES[D.mode].n;
 const f=$('#footMode');if(f)f.textContent=MODES[D.mode].full;
}
function palUI(){
 const el=$('#pal');if(!el)return;
 const kinds=MODES[D.mode].kinds;
 el.innerHTML=Object.keys(kinds).map(k=>'<button class="pitem" type="button" data-kind="'+k+'"><i>'+kinds[k].icon+'</i><span><b>'+kinds[k].n+'</b><small>'+kinds[k].d+'</small></span></button>').join('');
}
function tplUI(){
 const el=$('#tpl');if(!el)return;
 el.innerHTML='<button type="button" data-tpl="blank"><b>Blank canvas</b><span>Empty diagram, start anywhere</span></button>'
  +(TPL[D.mode]||[]).map((t,i)=>'<button type="button" data-tpl="'+i+'"><b>'+esc(t.n)+'</b><span>'+esc(t.s)+'</span></button>').join('');
}
function counts(){
 const el=$('#countLab');if(el)el.textContent=D.nodes.length+' object'+(D.nodes.length===1?'':'s')+' · '+D.edges.length+' link'+(D.edges.length===1?'':'s');
}
function paintLink(){
 const msg=$('#linkMsg');if(msg)msg.hidden=!D.from;
 $$('#nodes .dgn').forEach(el=>el.classList.toggle('from',el.dataset.id===D.from));
}

/* ---------- inspector ---------- */
function emptyInspector(){
 const mode=D.mode;
 const steps=mode==='erd'
  ? ['Drag a <b>Table</b> onto the canvas and name it.','Type its columns on the right, one per line.','Start a line with <code>*</code> for the primary key, <code>#</code> for a foreign key.','Press <b>&rarr;</b> on a table, then click the table it relates to, and give the link a name and cardinality.']
  : mode==='dfd'
  ? ['Drag the <b>External entity</b> that sends data.','Add a <b>Process</b> that turns its input into output.','Add a <b>Data store</b> for whatever has to be remembered.','Link them with <b>&rarr;</b> and name each flow with the data it carries.']
  : ['Drag an <b>Actor</b> outside the system.','Name the system boundary on the left — it is drawn around every use case.','Drop <b>Use case</b> goals in the middle of the canvas.','Link each actor to the goals it can reach, labelled uses, includes or extends.'];
 return '<div class="sec"><h2>Inspector</h2></div><p class="hint">Nothing selected. Click an object or a link to edit it, or follow the steps to draw:</p><ol class="help">'+steps.map(s=>'<li>'+s+'</li>').join('')+'</ol>';
}
function inspector(){
 const el=$('#inspector');if(!el)return;
 const ed=edgeOf(D.selEdge);
 if(ed){
  const a=nodeOf(ed.from),b=nodeOf(ed.to);
  el.innerHTML='<div class="sec"><h2>Link</h2><span class="state">'+(D.mode==='erd'?esc(ed.card||'1:N'):esc(ed.label||'no label'))+'</span></div>'
   +'<div class="kv"><span>From</span><b>'+esc(a?a.name||'Untitled':'?')+'</b></div>'
   +'<div class="kv" style="margin-bottom:9px"><span>To</span><b>'+esc(b?b.name||'Untitled':'?')+'</b></div>'
   +'<label class="field"><span>Label <em>'+(D.mode==='dfd'?'data it carries':D.mode==='uc'?'uses / includes / extends':'what happens')+'</em></span><input id="fLabel" type="text" maxlength="48" value="'+esc(ed.label||'')+'" placeholder="'+(D.mode==='dfd'?'data name':D.mode==='uc'?'uses':'verb')+'"></label>'
   +(D.mode==='erd'?'<label class="field"><span>Cardinality</span><select id="fCard">'+CARD.map(c=>'<option'+(c===(ed.card||'1:N')?' selected':'')+'>'+c+'</option>').join('')+'</select></label>':'')
   +'<div class="rbtn"><button class="btn danger" type="button" data-act="edge-del">Delete link</button></div>';
  return;
 }
 const n=nodeOf(D.sel);
 if(!n){el.innerHTML=emptyInspector();return}
 const d=def(n.kind)||{n:'Object'};
 const links=D.edges.filter(e=>e.from===n.id||e.to===n.id);
 const erdFields=hasFields(n);
 el.innerHTML='<div class="sec"><h2>'+esc(d.n)+'</h2><span class="state">'+links.length+' link'+(links.length===1?'':'s')+'</span></div>'
  +'<label class="field"><span>Name</span><input id="fName" type="text" maxlength="48" value="'+esc(n.name||'')+'" placeholder="Name"></label>'
  +(erdFields?'<label class="field"><span>Columns <em>* PK · # FK</em></span><textarea id="fFields" spellcheck="false" placeholder="*id&#10;name">'+esc(n.fields||'')+'</textarea></label>':'')
  +'<label class="field"><span>'+(erdFields?'Notes':'Description')+'</span><textarea id="fNote" style="min-height:58px;font-family:inherit;font-size:12px" maxlength="240" placeholder="'+(D.mode==='dfd'?'What happens here':D.mode==='uc'?'What this covers':'Anything worth remembering')+'">'+esc(n.note||'')+'</textarea></label>'
  +'<label class="field"><span>Width</span><input id="fWidth" type="number" min="120" max="460" step="4" value="'+(n.w||d.w||170)+'"></label>'
  +'<p class="hint" style="margin:2px 0 6px">Links ('+links.length+')</p>'
  +'<ul class="linklist">'+(links.map(e=>{const o=nodeOf(e.from===n.id?e.to:e.from);return '<li><b>'+esc(o?o.name||'Untitled':'?')+'</b><span>'+esc(e.label||'')+'</span><button type="button" data-act="unlink" data-id="'+e.id+'" aria-label="Remove link">&times;</button></li>'}).join('')||'<li style="border-style:dashed;background:none">No links yet</li>')+'</ul>'
  +'<div class="rbtn"><button class="btn" type="button" data-act="connect">Connect to&hellip;</button><button class="btn" type="button" data-act="dup">Duplicate</button><button class="btn danger" type="button" data-act="node-del">Delete</button></div>';
}

/* ---------- explanation ---------- */
function cardWords(l,r){
 const w=c=>c==='1'?'one':(c==='N'||c==='n'||c==='M')?'many':c==='0..1'?'zero or one':c;
 return w(l)+' to '+(r===undefined?'many':w(r));
}
function nm(n){return '<b>'+esc(n&&n.name?n.name:'Untitled')+'</b>'}
function explanation(){
 const lines=[],issues=[];
 const add=(t)=>issues.push(t);
 if(!D.nodes.length){
  lines.push('The canvas is empty. Drag an object from the left, or pick one of the starting diagrams.');
  add('Add at least one object so the diagram can be read.');
 }
 if(D.mode==='erd'&&D.nodes.length){
  const tables=D.nodes.filter(n=>n.kind==='entity'||n.kind==='weak');
  const rels=D.nodes.filter(n=>n.kind==='rel');
  const attrs=D.nodes.filter(n=>n.kind==='attr');
  lines.push('This ERD describes '+nm({name:D.name||'Untitled'})+' with '+tables.length+' table'+(tables.length===1?'':'s')+(rels.length?', '+rels.length+' relationship'+(rels.length===1?'':'s'):'')+(attrs.length?', '+attrs.length+' standalone attribute'+(attrs.length===1?'':'s'):'')+' and '+D.edges.length+' link'+(D.edges.length===1?'':'s')+'.');
  tables.forEach(n=>{
   const f=fieldsOf(n),pk=f.filter(x=>x.key.indexOf('PK')>=0),fk=f.filter(x=>x.key.indexOf('FK')>=0);
   lines.push(nm(n)+' holds '+(f.length?f.length+' column'+(f.length===1?'':'s'):'no columns yet')+(pk.length?', keyed by '+pk.map(x=>'<code>'+esc(x.name)+'</code>').join(' and '):'')+(fk.length?' with '+fk.length+' foreign key'+(fk.length===1?'':'s'):'')+'.');
   if(!f.length)add(nm(n)+' has no columns yet — add at least an id.');
   else if(!pk.length)add(nm(n)+' has no primary key — start a column with * .');
   if(D.nodes.length>1&&!D.edges.some(e=>e.from===n.id||e.to===n.id))add(nm(n)+' is not linked to any other table.');
   const names=tables.map(t=>String(t.name||'').toLowerCase()).filter(Boolean);
   fk.forEach(x=>{
    const base=String(x.name).toLowerCase().replace(/_?id$/,'');
    if(base&&!names.some(t=>t===base||t===base+'s'||t.replace(/s$/,'')===base))add(nm(n)+' has foreign key <code>'+esc(x.name)+'</code> but no linked table called '+esc(base)+'.');
   });
  });
  rels.forEach(n=>{
   const l=D.edges.filter(e=>e.from===n.id||e.to===n.id);
   lines.push(nm(n)+' is a relationship object joining '+l.length+' side'+(l.length===1?'':'s')+'.');
   if(l.length<2)add(nm(n)+' is a relationship, so it needs two links.');
  });
  attrs.forEach(n=>lines.push(nm(n)+' is a standalone attribute.'));
  D.edges.forEach(e=>{
   const a=nodeOf(e.from),b=nodeOf(e.to);if(!a||!b)return;
   const p=String(e.card||'1:N').split(':');
   lines.push(nm(a)+' '+cardWords(p[0],p[1])+' '+nm(b)+(e.label?' through &ldquo;'+esc(e.label)+'&rdquo;':'')+'.');
   if(!e.label)add('The link '+nm(a)+' &rarr; '+nm(b)+' has no label.');
  });
  const dupe={};tables.forEach(t=>{const k=String(t.name||'').trim().toLowerCase();if(k)dupe[k]=(dupe[k]||0)+1});
  Object.keys(dupe).forEach(k=>{if(dupe[k]>1)add('Two tables are both called “'+esc(k)+'”.')});
 }
 if(D.mode==='dfd'&&D.nodes.length){
  const ext=D.nodes.filter(n=>n.kind==='ext'),proc=D.nodes.filter(n=>n.kind==='proc'),store=D.nodes.filter(n=>n.kind==='store');
  lines.push('This DFD describes '+nm({name:D.name||'Untitled'})+' with '+ext.length+' external entit'+(ext.length===1?'y':'ies')+', '+proc.length+' process'+(proc.length===1?'':'es')+', '+store.length+' data store'+(store.length===1?'':'s')+' and '+D.edges.length+' flow'+(D.edges.length===1?'':'s')+'.');
  D.edges.forEach(e=>{
   const a=nodeOf(e.from),b=nodeOf(e.to);if(!a||!b)return;
   const verb=b.kind==='store'?'writes':b.kind==='ext'?'returns data to':a.kind==='store'?'reads and passes':'passes';
   lines.push(nm(a)+' '+verb+' '+nm(b)+(e.label?' carrying &ldquo;'+esc(e.label)+'&rdquo;':' without a data name')+'.');
   if(!e.label)add('The flow '+nm(a)+' &rarr; '+nm(b)+' needs the name of the data it carries.');
   if(a.kind==='ext'&&b.kind==='ext')add(nm(a)+' and '+nm(b)+' are both external — data has to pass through a process.');
   if(a.kind==='store'&&b.kind==='store')add('Data cannot flow straight from one store to another — put a process between them.');
  });
  D.nodes.forEach(n=>{
   const inc=D.edges.filter(e=>e.to===n.id),out=D.edges.filter(e=>e.from===n.id);
   if(n.kind==='proc'){
    if(!inc.length)add('Process '+nm(n)+' has no input flow.');
    if(!out.length)add('Process '+nm(n)+' has no output flow.');
   }else if(!inc.length&&!out.length)add(nm(n)+' is not connected to any flow.');
   else if(n.kind==='store'&&!inc.length)add('Store '+nm(n)+' is read but never written to.');
  });
 }
 if(D.mode==='uc'&&D.nodes.length){
  const actors=D.nodes.filter(n=>n.kind==='actor'),ucs=D.nodes.filter(n=>n.kind==='uc'),sys=String(D.system||'').trim();
  lines.push('This use case diagram describes '+nm({name:D.name||'Untitled'})+' with '+actors.length+' actor'+(actors.length===1?'':'s')+', '+ucs.length+' goal'+(ucs.length===1?'':'s')+(sys?' inside the '+nm({name:sys})+' boundary':'')+' and '+D.edges.length+' link'+(D.edges.length===1?'':'s')+'.');
  actors.forEach(n=>{
   const l=D.edges.filter(e=>e.from===n.id||e.to===n.id);
   const goals=l.map(e=>nodeOf(e.from===n.id?e.to:e.from)).filter(o=>o&&o.kind==='uc');
   lines.push(nm(n)+' is an actor who can '+(goals.length?goals.map(g=>'&ldquo;'+esc(g.name||'Untitled')+'&rdquo;').join(', '):'not reach anything yet')+'.');
   if(!goals.length)add(nm(n)+' is an actor with no goals — link it to a use case.');
   if(n.name&&/system|service|api|server/i.test(n.name)&&!l.some(e=>{const o=nodeOf(e.from===n.id?e.to:e.from);return o&&o.kind==='uc'}))add(nm(n)+' sounds like a system, not an actor.');
  });
  ucs.forEach(n=>{
   const l=D.edges.filter(e=>e.from===n.id||e.to===n.id);
   const fromActors=l.map(e=>nodeOf(e.from===n.id?e.to:e.from)).filter(o=>o&&o.kind==='actor');
   lines.push(nm(n)+' is a goal'+(fromActors.length?' reached by '+fromActors.map(a=>esc(a.name||'Untitled')).join(' and '):'')+(n.note?' — '+esc(n.note):'')+'.');
   if(!l.length)add(nm(n)+' is not connected to an actor or another use case.');
  });
  D.edges.forEach(e=>{
   const a=nodeOf(e.from),b=nodeOf(e.to);if(!a||!b)return;
   const kind=String(e.label||'').toLowerCase();
   if(a.kind==='actor'&&b.kind==='actor')add('One actor cannot link straight to another in a use case diagram.');
   if(!e.label)add('The link '+nm(a)+' &rarr; '+nm(b)+' needs a label: uses, includes or extends.');
   else if(a.kind==='uc'&&b.kind==='uc'&&!['uses','include','includes','extend','extends','generalizes'].includes(kind))add('Between two use cases use includes or extends, not &ldquo;'+esc(e.label)+'&rdquo;.');
  });
  if(!sys&&ucs.length)add('Name the system boundary on the left so it is clear which goals live inside the system.');
 }
 if(D.nodes.length&&!issues.length)lines.push('Every object is connected and nothing is missing, so the diagram can be read end to end.');
 return {lines,issues};
}
function explain(){
 const el=$('#explain');if(!el)return;
 const {lines,issues}=explanation();
 el.innerHTML='<div class="sec"><h2>Live explanation</h2><span class="state '+(issues.length?'warn':'ok')+'">'+(issues.length?issues.length+' to review':'all good')+'</span></div>'
  +'<ol class="steps" id="steps">'+lines.map(t=>'<li>'+t+'</li>').join('')+'</ol>'
  +'<p class="hint" style="margin:12px 0 0">Checks</p>'
  +'<ul class="checks">'+(issues.length?issues.map(t=>'<li><i>check</i><span>'+t+'</span></li>').join(''):'<li class="ok"><i>ok</i><span>No problems found on the canvas.</span></li>')+'</ul>'
  +'<p class="verdict">'+(issues.length?issues.length+' thing'+(issues.length===1?'':'s')+' to review. Fixing the list sharpens the diagram — nothing here blocks saving.':'Reads cleanly: '+D.nodes.length+' object'+(D.nodes.length===1?'':'s')+' and '+D.edges.length+' link'+(D.edges.length===1?'':'s')+'.')+'</p>'
  +'<div class="rbtn"><button class="btn" type="button" id="btnCopy">Copy explanation</button></div>';
 const b=$('#btnCopy');
 if(b)b.onclick=()=>{
  const text=D.name+' ('+MODES[D.mode].full+')\n\n'+lines.map(t=>'- '+t.replace(/<[^>]+>/g,'')).join('\n')+'\n\nChecks\n'+issues.map(t=>'- '+t.replace(/<[^>]+>/g,'')).join('\n');
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(()=>toast('Explanation copied')).catch(()=>toast('Copy is not available here'));
  else toast('Copy is not available here');
 };
}

/* ---------- system boundary ---------- */
function drawBoundary(){
 const cv=$('#canvas');if(!cv)return;
 let el=$('#sysbox');
 const ucs=D.nodes.filter(n=>n.kind==='uc');
 const name=String(D.system||'').trim();
 const boxes=ucs.map(n=>{const e=nodeEl(n.id);return e?box(e):null}).filter(Boolean);
 if(D.mode!=='uc'||!name||!boxes.length){if(el)el.remove();return}
 const x0=Math.max(4,Math.min(...boxes.map(b=>b.x))-34);
 const y0=Math.max(4,Math.min(...boxes.map(b=>b.y))-40);
 const x1=Math.max(...boxes.map(b=>b.x+b.w))+34;
 const y1=Math.max(...boxes.map(b=>b.y+b.h))+30;
 if(!el){el=document.createElement('div');el.id='sysbox';cv.insertBefore(el,$('#nodes'))}
 el.style.left=x0+'px';el.style.top=y0+'px';
 el.style.width=(x1-x0)+'px';el.style.height=(y1-y0)+'px';
 el.innerHTML='<b>'+esc(name)+'</b>';
}
function sysUI(){
 const g=$('#sysGroup');if(g)g.hidden=D.mode!=='uc';
 const i=$('#sysName');
 if(i&&document.activeElement!==i)i.value=D.system||'';
}

/* ---------- main render ---------- */
function render(){
 if(!$('#canvas'))return;
 const nameEl=$('#dname');
 if(nameEl&&document.activeElement!==nameEl)nameEl.value=D.name;
 typesUI();palUI();tplUI();sysUI();
 renderNodes();
 if(fit(!!D.fit))renderNodes();
 D.fit=false;
 draw();inspector();explain();counts();paintLink();
 const flow=$('#flow'),snap=$('#snap');
 if(flow)flow.checked=D.flow;
 if(snap)snap.checked=D.snap;
 const es=$('#edges');if(es)es.classList.toggle('flow',D.flow);
 syncHist();
}

/* ---------- node operations ---------- */
function nextSpot(){
 const cv=$('#canvas'),W=cv?cv.clientWidth:620;
 const boxes=D.nodes.map(n=>{const el=nodeEl(n.id);return el?box(el):null}).filter(Boolean);
 const fits=(x,y)=>!boxes.some(b=>x<b.x+b.w+12&&x+200>b.x-12&&y<b.y+b.h+12&&y+76>b.y-12);
 for(let row=0;row<24;row++)for(let col=0;col<8;col++){
  const x=24+col*215,y=26+row*150;
  if(col>0&&x+200>W-12)continue;
  if(fits(x,y))return {x,y};
 }
 return {x:24,y:26+D.nodes.length*30};
}
function addNode(kind,x,y,over){
 const d=def(kind);if(!d)return null;
 hist();
 const cv=$('#canvas');
 const w=d.w||170;
 const maxX=Math.max(8,(cv?cv.clientWidth:700)-w-14),maxY=Math.max(8,(cv?cv.clientHeight:600)-80);
 const name=d.n+' '+(D.nodes.filter(n=>n.kind===kind).length+1);
 const n=mk(kind,Math.min(Math.max(8,x),maxX),Math.min(Math.max(8,y),maxY),{name,...(over||{})});
 D.nodes.push(n);D.sel=n.id;D.selEdge=null;D.from=null;
 render();
 return n;
}
function removeNode(id){
 hist();
 D.nodes=D.nodes.filter(n=>n.id!==id);
 D.edges=D.edges.filter(e=>e.from!==id&&e.to!==id);
 D.sel=null;D.selEdge=null;D.from=null;
 render();
}
function connect(from,to){
 if(!from||!to||from===to)return;
 if(!nodeOf(from)||!nodeOf(to))return;
 if(D.edges.some(e=>e.from===from&&e.to===to)){D.from=null;D.selEdge=null;render();toast('Those two are already linked');return}
 hist();
 const e=link(from,to,D.mode==='erd'?'1:N':'',D.mode==='uc'?'uses':'');
 D.edges.push(e);
 D.from=null;D.sel=null;D.selEdge=e.id;
 render();
}
function duplicateNode(){
 const n=nodeOf(D.sel);if(!n)return;
 hist();
 const c=mk(n.kind,n.x+26,n.y+26,{name:(n.name||'Untitled')+' copy',note:n.note,fields:n.fields,w:n.w,h:n.h});
 D.nodes.push(c);D.sel=c.id;D.selEdge=null;
 render();
}

/* ---------- arrangement ---------- */
function arrange(){
 if(D.nodes.length<2){toast('Add a second object first');return}
 hist();
 const cv=$('#canvas');
 const ids=new Set(D.nodes.map(n=>n.id));
 const outs={};D.nodes.forEach(n=>outs[n.id]=D.edges.filter(e=>e.from===n.id&&ids.has(e.to)).map(e=>e.to));
 const indeg={};D.nodes.forEach(n=>indeg[n.id]=0);
 Object.values(outs).forEach(list=>list.forEach(t=>{if(indeg[t]!=null)indeg[t]++}));
 const depth={},order=[];
 D.nodes.filter(n=>!indeg[n.id]).forEach(n=>{if(depth[n.id]==null){depth[n.id]=0;order.push(n.id)}});
 if(!order.length&&D.nodes.length){depth[D.nodes[0].id]=0;order.push(D.nodes[0].id)}
 for(let i=0;i<order.length;i++){
  const id=order[i];
  (outs[id]||[]).forEach(t=>{if(depth[t]==null){depth[t]=(depth[id]||0)+1;order.push(t)}});
 }
 D.nodes.forEach(n=>{if(depth[n.id]==null)depth[n.id]=0});
 const cols={};D.nodes.forEach(n=>{(cols[depth[n.id]]=cols[depth[n.id]]||[]).push(n)});
 const pad=24,gap=70,rowGap=26;
 let x=pad,bottom=pad+120;
 Object.keys(cols).map(Number).sort((a,b)=>a-b).forEach(dep=>{
  const list=cols[dep];
  const widths=list.map(n=>{const el=nodeEl(n.id);return el?el.offsetWidth:(n.w||170)});
  const colW=Math.max(...widths);
  let y=pad;
  list.forEach((n,i)=>{
   const el=nodeEl(n.id),h=el?el.offsetHeight:70;
   n.x=x;n.y=y;n.w=widths[i];
   y+=h+rowGap;
   bottom=Math.max(bottom,n.y+h);
  });
  x+=colW+gap;
 });
 if(cv)cv.style.minHeight=Math.max(cv.clientHeight,bottom+pad)+'px';
 D.fit=false;
 render();
 toast('Arranged into layers');
}

/* ---------- saving ---------- */
function save(){
 const rec={id:D.id||('d'+Date.now().toString(36)),name:(D.name||'Untitled diagram').trim(),mode:D.mode,system:D.system,nodes:clone(D.nodes),edges:clone(D.edges),updated:Date.now()};
 const list=readAll().filter(d=>d.id!==rec.id);
 list.unshift(rec);
 if(!writeAll(list))return;
 D.id=rec.id;D.name=rec.name;D.saved=Date.now();
 try{localStorage.setItem(LAST,D.id)}catch(_){}
 setDirty(false);libraryList();
 toast('Diagram saved');
}
function loadRec(rec){
 if(!rec)return;
 D.mode=MODES[rec.mode]?rec.mode:'erd';
 D.id=rec.id;D.name=rec.name||'Untitled diagram';
 D.system=rec.system||D.system;
 D.nodes=clone(rec.nodes||[]);D.edges=clone(rec.edges||[]);
 const ids=D.nodes.concat(D.edges).map(o=>parseInt(String(o.id).replace(/\D/g,''),10)||0);
 D.seq=(ids.length?Math.max.apply(null,ids):0)+1;
 D.sel=null;D.selEdge=null;D.from=null;D.fit=true;
 D.saved=rec.updated||0;
 undoStack=[];redoStack=[];
 try{localStorage.setItem(LAST,D.id)}catch(_){}
 writeOpts();
 render();setDirty(false);
}
function newDiagram(mode){
 D.mode=MODES[mode]?mode:D.mode;
 if(D.mode==='uc')D.system='System';
 D.id=null;D.name='Untitled '+MODES[D.mode].n;
 D.nodes=[];D.edges=[];D.sel=null;D.selEdge=null;D.from=null;D.seq=1;D.fit=false;D.saved=0;
 undoStack=[];redoStack=[];
 writeOpts();
 render();setDirty(false);
}
function useTemplate(id,mark){
 const t=id==='blank'?null:(TPL[D.mode]||[])[Number(id)];
 D.id=null;D.name=t?t.n:'Untitled '+MODES[D.mode].n;
 if(D.mode==='uc')D.system=(t&&t.sys)||'System';
 D.nodes=[];D.edges=[];D.seq=1;
 if(t){const out=t.build();D.nodes=out.nodes;D.edges=out.edges}
 D.sel=null;D.selEdge=null;D.from=null;D.fit=true;
 undoStack=[];redoStack=[];
 writeOpts();
 render();
 if(mark!==false)setDirty(true);
}

/* ---------- library ---------- */
function libraryList(){
 const grid=$('#libgrid');if(!grid)return;
 const list=readAll().sort((a,b)=>(b.updated||0)-(a.updated||0));
 grid.innerHTML='<button class="pcard new" type="button" data-lib="new"><strong>+</strong>New diagram</button>'
  +list.map(d=>'<div class="pcard"><div class="meta"><b>'+esc(d.name||'Untitled')+'</b><small>'+MODES[d.mode].n+' · '+(d.nodes||[]).length+' object'+((d.nodes||[]).length===1?'':'s')+' · '+(d.edges||[]).length+' link'+((d.edges||[]).length===1?'':'s')+'</small><small>'+(d.updated?new Date(d.updated).toLocaleDateString():'not dated')+'</small></div><div class="row"><button class="btn" type="button" data-lib="open" data-id="'+esc(d.id)+'">Open</button><button class="btn" type="button" data-lib="dup" data-id="'+esc(d.id)+'">Duplicate</button><button class="btn danger" type="button" data-lib="del" data-id="'+esc(d.id)+'">Delete</button></div></div>').join('');
 const empty=$('#libempty');if(empty)empty.hidden=list.length>0;
}
function openLib(){
 const lib=$('#lib');if(!lib)return;
 libraryList();lib.hidden=false;
}
function closeLib(){const lib=$('#lib');if(lib)lib.hidden=true}

/* ---------- export ---------- */
function exportSvg(){
 if(!D.nodes.length){toast('Draw something first');return}
 const pad=28;
 const items=D.nodes.map(n=>{
  const el=nodeEl(n.id);
  const b=el?box(el):{x:n.x,y:n.y,w:n.w||170,h:70};
  return {n,b,h:el?el.offsetHeight:70};
 });
 const ucs=items.filter(i=>i.n.kind==='uc');
 const bound=(D.mode==='uc'&&ucs.length&&String(D.system||'').trim())?{
  x0:Math.min(...ucs.map(i=>i.b.x))-32,
  y0:Math.min(...ucs.map(i=>i.b.y))-38,
  x1:Math.max(...ucs.map(i=>i.b.x+i.b.w))+32,
  y1:Math.max(...ucs.map(i=>i.b.y+i.b.h))+30
 }:null;
 const minX=Math.min(...items.map(i=>i.b.x),bound?bound.x0:Infinity),minY=Math.min(...items.map(i=>i.b.y),bound?bound.y0:Infinity);
 const maxX=Math.max(...items.map(i=>i.b.x+i.b.w),bound?bound.x1:-Infinity),maxY=Math.max(...items.map(i=>i.b.y+i.b.h),bound?bound.y1:-Infinity);
 const W=Math.max(320,maxX-minX+pad*2),H=Math.max(220,maxY-minY+pad*2);
 const ox=pad-minX,oy=pad-minY;
 const out=['<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="'+Math.round(W)+'" height="'+Math.round(H)+'" viewBox="0 0 '+Math.round(W)+' '+Math.round(H)+'" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">',
  '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5b6b8f"/></marker></defs>',
  '<rect width="100%" height="100%" fill="#ffffff"/>'];
 if(bound)out.push('<rect x="'+(bound.x0+ox).toFixed(1)+'" y="'+(bound.y0+oy).toFixed(1)+'" width="'+(bound.x1-bound.x0).toFixed(1)+'" height="'+(bound.y1-bound.y0).toFixed(1)+'" rx="12" fill="#f8f9ff" stroke="#b9c4e6" stroke-dasharray="6 5"/><text x="'+(bound.x0+ox+13).toFixed(1)+'" y="'+(bound.y0+oy+18).toFixed(1)+'" font-size="10.5" font-weight="800" fill="#6d7cff">'+esc(D.system)+'</text>');
 const bb=id=>{const f=items.find(i=>i.n.id===id);return f?{x:f.b.x+ox,y:f.b.y+oy,w:f.b.w,h:f.b.h}:null};
 D.edges.forEach(e=>{
  const A=bb(e.from),B=bb(e.to);if(!A||!B)return;
  const dx=B.x+B.w/2-(A.x+A.w/2),dy=B.y+B.h/2-(A.y+A.h/2);
  const p1=clip(A,dx,dy),p2=clip(B,-dx,-dy);
  const len=Math.hypot(p2.x-p1.x,p2.y-p1.y)||1,g=Math.min(2.5,len/3),ux=(p2.x-p1.x)/len,uy=(p2.y-p1.y)/len;
  const x1=p1.x+ux*g,y1=p1.y+uy*g,x2=p2.x-ux*g,y2=p2.y-uy*g;
  out.push('<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#5b6b8f" stroke-width="1.8" marker-end="url(#a)"/>');
  if(e.label)out.push('<text x="'+(((x1+x2)/2)).toFixed(1)+'" y="'+(((y1+y2)/2)-6).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#5b6b8f">'+esc(e.label)+'</text>');
 });
 items.forEach(({n,b})=>{
  const d=def(n.kind)||{};
  out.push('<rect x="'+(b.x+ox).toFixed(1)+'" y="'+(b.y+oy).toFixed(1)+'" width="'+b.w+'" height="'+b.h+'" rx="8" fill="#f3f5fb" stroke="#c9d1e4"/>');
  out.push('<rect x="'+(b.x+ox).toFixed(1)+'" y="'+(b.y+oy).toFixed(1)+'" width="'+b.w+'" height="28" rx="8" fill="#e4e9f7"/>');
  out.push('<text x="'+(b.x+ox+10).toFixed(1)+'" y="'+(b.y+oy+19).toFixed(1)+'" font-size="12.5" font-weight="700" fill="#1c2436">'+esc(n.name||'Untitled')+'</text>');
  if(hasFields(n)){
   fieldsOf(n).forEach((f,i)=>{
    out.push('<text x="'+(b.x+ox+10).toFixed(1)+'" y="'+(b.y+oy+44+i*15).toFixed(1)+'" font-size="11" fill="#4a5670">'+esc(f.name)+'</text>');
    if(f.key)out.push('<text x="'+(b.x+ox+b.w-10).toFixed(1)+'" y="'+(b.y+oy+44+i*15).toFixed(1)+'" font-size="9.5" font-weight="700" text-anchor="end" fill="#6d7cff">'+f.key+'</text>');
   });
  }else if(n.note){
   out.push('<text x="'+(b.x+ox+10).toFixed(1)+'" y="'+(b.y+oy+45).toFixed(1)+'" font-size="11" fill="#68748c">'+esc(n.note.slice(0,54))+'</text>');
  }
 });
 out.push('</svg>');
 const blob=new Blob([out.join('\n')],{type:'image/svg+xml'});
 const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);
 a.download=(D.name||'diagram').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.svg';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 toast('SVG exported');
}

/* ---------- wiring ---------- */
function boot(){
 readOpts();
 const q=new URLSearchParams(location.search);
 const all=readAll();
 const fresh=!!q.get('new')||!!q.get('mode');
 let rec=null;
 if(q.get('id'))rec=all.find(r=>r.id===q.get('id'))||null;
 else if(!fresh){let last=null;try{last=localStorage.getItem(LAST)}catch(_){}rec=all.find(r=>r.id===last)||all[0]||null}
 if(rec)loadRec(rec);
 else{
  if(q.get('mode')&&MODES[q.get('mode')])D.mode=q.get('mode');
  if(q.get('new'))newDiagram(D.mode);
  else useTemplate('0',false);
 }
 D.ready=true;

 $('#dname').oninput=e=>{D.name=e.target.value;markDirty();explain()};

 $('#types').addEventListener('click',e=>{
  const b=e.target.closest('[data-mode]');if(!b)return;
  const m=b.dataset.mode;if(m===D.mode)return;
  const had=D.nodes.length>0;
  if(had)hist();
  D.mode=m;D.nodes=[];D.edges=[];D.seq=1;D.sel=null;D.selEdge=null;D.from=null;D.fit=false;
  if(m==='uc'&&!String(D.system||'').trim())D.system='System';
  if(!D.id)D.name='Untitled '+MODES[m].n;
  writeOpts();render();markDirty();
  if(had)toast('Switched to '+MODES[m].n+' — the old canvas is still in Undo');
 });

 const pal=$('#pal');
 pal.addEventListener('pointerdown',e=>{
  const it=e.target.closest('.pitem');if(!it||e.button!==0)return;
  D.pal={kind:it.dataset.kind,x:e.clientX,y:e.clientY};
  e.preventDefault();
 });
 pal.addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ')return;
  const it=e.target.closest('.pitem');if(!it)return;
  e.preventDefault();
  const s=nextSpot();addNode(it.dataset.kind,s.x,s.y);
 });

 $('#tpl').addEventListener('click',e=>{
  const b=e.target.closest('[data-tpl]');if(!b)return;
  useTemplate(b.dataset.tpl);
  toast('Template loaded — Save keeps it as your own');
 });

 $('#snap').onchange=e=>{D.snap=e.target.checked;writeOpts()};
 $('#flow').onchange=e=>{D.flow=e.target.checked;const s=$('#edges');if(s)s.classList.toggle('flow',D.flow);writeOpts()};
 $('#sysName').oninput=e=>{D.system=e.target.value;markDirty();draw();explain()};
 $('#btnSave').onclick=save;
 $('#btnUndo').onclick=undo;
 $('#btnRedo').onclick=redo;
 $('#btnSvg').onclick=exportSvg;
 $('#btnArrange').onclick=arrange;
 $('#btnClear').onclick=()=>{
  if(!D.nodes.length)return;
  hist();D.nodes=[];D.edges=[];D.sel=null;D.selEdge=null;D.from=null;render();toast('Cleared — Undo brings it back');
 };
 $('#btnLibrary').onclick=openLib;
 $('#libClose').onclick=closeLib;
 $('#libNew').onclick=()=>{closeLib();newDiagram(D.mode)};
 $('#libgrid').addEventListener('click',e=>{
  const b=e.target.closest('[data-lib]');if(!b)return;
  const act=b.dataset.lib,id=b.dataset.id;
  if(act==='new'){closeLib();newDiagram(D.mode);return}
  if(act==='open'){const r=readAll().find(d=>d.id===id);if(r){closeLib();loadRec(r)}return}
  if(act==='dup'){const r=readAll().find(d=>d.id===id);if(!r)return;
   const list=readAll();list.unshift({...r,id:'d'+Date.now().toString(36),name:(r.name||'Untitled')+' copy',updated:Date.now()});
   writeAll(list);libraryList();toast('Duplicated');return;
  }
  if(act==='del'){
   if(b.dataset.s){const list=readAll().filter(d=>d.id!==id);writeAll(list);
    if(D.id===id){D.id=null;setDirty(true)}
    libraryList();toast('Diagram deleted');return;
   }
   b.dataset.s='1';b.textContent='Sure?';
  }
 });

 const ins=$('#inspector');
 let editPre=null;
 ins.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))editPre=state()});
 ins.addEventListener('input',e=>{
  const n=nodeOf(D.sel),ed=edgeOf(D.selEdge),id=e.target.id,v=e.target.value;
  if(!n&&!ed)return;
  if(editPre){hist(editPre);editPre=null}
  if(id==='fName'&&n){n.name=v;const b=$('#nodes .dgn[data-id="'+n.id+'"] header b');if(b)b.textContent=v||'Untitled';explain()}
  if(id==='fFields'&&n){n.fields=v;renderNodes();draw();explain()}
  if(id==='fNote'&&n){n.note=v;renderNodes();draw();explain()}
  if(id==='fWidth'&&n){const w=Math.max(120,Math.min(460,Number(v)||170));n.w=w;const el=nodeEl(n.id);if(el)el.style.width=w+'px';draw();clearLabels()}
  if(id==='fLabel'&&ed){ed.label=v;draw();paintLink();explain();const st=$('#inspector .sec .state');if(st)st.textContent=D.mode==='erd'?(ed.card||'1:N'):(v||'no label')}
 });
 ins.addEventListener('change',e=>{
  const ed=edgeOf(D.selEdge);
  if(e.target.id==='fCard'&&ed){hist();ed.card=e.target.value;draw();inspector();explain()}
 });
 ins.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,n=nodeOf(D.sel);
  if(act==='connect'&&n){D.from=n.id;D.selEdge=null;paintLink();inspector();return}
  if(act==='dup'&&n){duplicateNode();return}
  if(act==='node-del'&&n){removeNode(n.id);return}
  if(act==='edge-del'){hist();D.edges=D.edges.filter(x=>x.id!==D.selEdge);D.selEdge=null;render();return}
  if(act==='unlink'){hist();D.edges=D.edges.filter(x=>x.id!==b.dataset.id);render();return}
 });

 const cv=$('#canvas');
 cv.addEventListener('click',e=>{
  const lk=e.target.closest('[data-link]');
  if(lk){D.from=lk.dataset.link;D.sel=lk.dataset.link;D.selEdge=null;paintLink();inspector();explain();return}
  const hit=e.target.closest('[data-edge]');
  if(hit){D.selEdge=hit.dataset.edge;D.sel=null;D.from=null;render();return}
  const nd=e.target.closest('.dgn');
  if(nd){
   if(D.from&&D.from!==nd.dataset.id){connect(D.from,nd.dataset.id);return}
   D.sel=nd.dataset.id;D.selEdge=null;D.from=null;render();return;
  }
  if(D.from||D.sel||D.selEdge){D.from=null;D.sel=null;D.selEdge=null;render()}
 });
 cv.addEventListener('pointerdown',e=>{
  const nd=e.target.closest('.dgn');
  if(!nd||e.target.closest('button')||e.button!==0)return;
  const n=nodeOf(nd.dataset.id);if(!n)return;
  if(D.from&&D.from!==n.id)return;
  const r=cv.getBoundingClientRect();
  if(D.sel!==n.id||D.selEdge){D.sel=n.id;D.selEdge=null;inspector();explain();counts()}
  $$('#nodes .dgn').forEach(x=>x.classList.toggle('on',x===nd));
  D.drag={n,el:nd,dx:e.clientX-r.left-n.x,dy:e.clientY-r.top-n.y,r,pre:state(),moved:false};
  e.preventDefault();
 });
 const onMove=e=>{
  if(D.drag){
   const {r,n,el}=D.drag;
   const maxX=Math.max(4,r.width-el.offsetWidth-8),maxY=Math.max(4,r.height-el.offsetHeight-8);
   let nx=Math.min(Math.max(4,e.clientX-r.left-D.drag.dx),maxX);
   let ny=Math.min(Math.max(4,e.clientY-r.top-D.drag.dy),maxY);
   if(Math.abs(nx-n.x)>1||Math.abs(ny-n.y)>1)D.drag.moved=true;
   n.x=nx;n.y=ny;
   el.style.left=nx+'px';el.style.top=ny+'px';
   draw();
   return;
  }
  if(D.pal){
   if(!D.ghost&&Math.abs(e.clientX-D.pal.x)+Math.abs(e.clientY-D.pal.y)>6){
    const g=document.createElement('div');
    g.id='ghost';
    g.textContent=(def(D.pal.kind)||{n:'Object'}).n;
    g.style.cssText='position:fixed;z-index:90;pointer-events:none;transform:translate(-50%,-50%);background:#1a2130;border:1px solid #7c8cff;border-radius:9px;padding:6px 10px;font-size:12px;font-weight:700;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.4)';
    document.body.appendChild(g);D.ghost=g;
   }
   if(D.ghost){D.ghost.style.left=e.clientX+'px';D.ghost.style.top=e.clientY+'px'}
  }
 };
 const onUp=e=>{
  if(D.drag){
   const {n,el,moved,pre}=D.drag;D.drag=null;
   if(moved){
    if(D.snap){n.x=Math.round(n.x/22)*22;n.y=Math.round(n.y/22)*22;
     const maxX=Math.max(4,cv.clientWidth-el.offsetWidth-8),maxY=Math.max(4,cv.clientHeight-el.offsetHeight-8);
     n.x=Math.min(n.x,maxX);n.y=Math.min(n.y,maxY);
     el.style.left=n.x+'px';el.style.top=n.y+'px';draw();
    }
    hist(pre);
   }
   return;
  }
  if(!D.pal)return;
  const p=D.pal;D.pal=null;
  const dropped=!!D.ghost;
  if(D.ghost){D.ghost.remove();D.ghost=null}
  const r=cv.getBoundingClientRect();
  if(dropped&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){
   const w=(def(p.kind)||{w:170}).w;
   addNode(p.kind,e.clientX-r.left-w/2,e.clientY-r.top-18);
  }else if(!dropped){
   const s=nextSpot();addNode(p.kind,s.x,s.y);
  }
 };
 window.addEventListener('pointermove',onMove);
 window.addEventListener('pointerup',onUp);

 let rzT=0;
 window.addEventListener('resize',()=>{
  clearTimeout(rzT);
  rzT=setTimeout(()=>{renderNodes();if(fit(true))renderNodes();draw()},160);
 });

 document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  const typing=tag==='input'||tag==='textarea'||tag==='select';
  if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();save();return}
  if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){e.preventDefault();if(e.shiftKey)redo();else undo();return}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')){e.preventDefault();redo();return}
  if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')){e.preventDefault();duplicateNode();return}
  if(typing)return;
  if(e.key==='Escape'){D.from=null;D.sel=null;D.selEdge=null;D.drag=null;render();return}
  if(e.key==='Delete'||e.key==='Backspace'){
   if(D.selEdge){e.preventDefault();hist();D.edges=D.edges.filter(x=>x.id!==D.selEdge);D.selEdge=null;render();return}
   if(D.sel){e.preventDefault();removeNode(D.sel);return}
  }
  if(D.sel&&e.key.startsWith('Arrow')){
   e.preventDefault();const n=nodeOf(D.sel);if(!n)return;
   const step=e.shiftKey?1:11;
   if(e.key==='ArrowLeft')n.x=Math.max(4,n.x-step);
   if(e.key==='ArrowRight')n.x+=step;
   if(e.key==='ArrowUp')n.y=Math.max(4,n.y-step);
   if(e.key==='ArrowDown')n.y+=step;
   const el=nodeEl(n.id);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px'}
   draw();markDirty();
  }
 });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
