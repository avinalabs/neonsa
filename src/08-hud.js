/* ============================================================
   p8 :: HUD + MINIMAP + SHARE CARD
   ============================================================ */
function uiScale(){return clamp(Math.min(VW,VH)/760,0.72,1.35);}
const IS_TOUCH=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||false;

/* ============================================================
   HUD GEOMETRY
   The playfield is framed between a top instrument band and a bottom
   control band. Every panel lives in one of those bands — never over the
   middle of the screen, because that is where the flippers are.
   ============================================================ */
let hudTopSmooth=0;
function isShort(){return VH<560;}
function topBarH(){const U=uiScale();return isShort()?56*U:(VW<640?92:86)*U;}
function actionPanelH(){
  const U=uiScale();
  if(state!=="PLAY"&&state!=="BONUS")return 0;
  if(ballInPlunger)return 78*U;
  if(mission.active)return 62*U;
  if(cannon.loaded||bossReady||wizard.active)return 30*U;
  return 28*U;
}
function hudTopH(){return topBarH()+hudTopSmooth;}
function hudBottomH(){return IS_TOUCH?(isShort()?64:(VW<600?92:112)):Math.round(10*uiScale());}
function hudTick(dt){
  const want=actionPanelH();
  hudTopSmooth+=clamp(want-hudTopSmooth,-dt*900,dt*900);
}

function drawHUD(){
  if(state==="ATTRACT")return drawAttractHUD();
  setScreenTransform();
  ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.setLineDash([]);
  const U=uiScale();
  const narrow=VW<640&&!isShort();
  const short=isShort();
  const f=focusBall();
  const curDeck=f?DECKS[f.deck]:DECKS[0];
  const barH=topBarH();

  /* ---------- top band ---------- */
  ctx.save();
  const tg=ctx.createLinearGradient(0,0,0,hudTopH()+18*U);
  tg.addColorStop(0,"rgba(2,4,20,0.94)");
  tg.addColorStop(0.72,"rgba(2,4,20,0.86)");
  tg.addColorStop(1,"rgba(2,4,20,0)");
  ctx.fillStyle=tg;ctx.fillRect(0,0,VW,hudTopH()+18*U);

  ctx.textBaseline="alphabetic";ctx.textAlign="left";
  ctx.font=`900 ${Math.round((narrow?26:short?24:31)*U)}px Consolas,monospace`;
  ctx.fillStyle=WH;
  if(GLOW>0)ctx.shadowColor=CY,ctx.shadowBlur=11;
  ctx.fillText(fmt(score),14*U,(narrow?28:short?26:33)*U);
  ctx.shadowBlur=0;
  ctx.font=`700 ${Math.round(11*U)}px "Segoe UI"`;ctx.fillStyle="#7fb8d8";
  ctx.fillText("SCORE",15*U,(narrow?43:short?41:48)*U);
  const swid=ctx.measureText("SCORE").width;
  ctx.fillStyle="#587fa0";
  ctx.fillText("HI "+shortNum(high),15*U+swid+12*U,(narrow?43:48)*U);

  /* deck / altitude chip */
  const cw=Math.round((narrow?196:short?260:210)*U),chh=Math.round(short?40:44)*U;
  const cx=VW/2-cw/2, cyT=narrow?Math.round(46*U):Math.round(short?6:8)*U;
  ctx.fillStyle="rgba(4,6,26,0.8)";
  roundRect(cx,cyT,cw,chh,10*U);ctx.fill();
  ctx.strokeStyle=curDeck.hue+"0.7)";ctx.lineWidth=2;
  roundRect(cx,cyT,cw,chh,10*U);ctx.stroke();
  ctx.textAlign="center";
  ctx.fillStyle=curDeck.col;
  if(GLOW>0)ctx.shadowColor=curDeck.col,ctx.shadowBlur=13;
  ctx.font=`900 ${Math.round((short?15:17)*U)}px "Segoe UI"`;
  ctx.fillText(curDeck.name,VW/2,cyT+(short?17:19)*U);
  ctx.shadowBlur=0;
  ctx.font=`900 ${Math.round((short?12:13)*U)}px "Segoe UI"`;
  ctx.fillStyle=YL;
  ctx.fillText("ALT x"+curDeck.mult+"   TOTAL x"+Math.round(totalMult(f?f.y:2600))+
    (short?"   BALL "+Math.min(ballNum,BALLS_PER_GAME)+"/"+BALLS_PER_GAME:""),VW/2,cyT+(short?33:36)*U);

  /* ball + storm */
  if(short){
    /* the deck chip already carries the ball count — keep clear of the buttons */
  }else if(narrow){
    ctx.textAlign="left";
    ctx.font=`900 ${Math.round(13*U)}px "Segoe UI"`;
    ctx.fillStyle=CY;
    ctx.fillText("BALL "+Math.min(ballNum,BALLS_PER_GAME)+"/"+BALLS_PER_GAME+(extraBalls?" +"+extraBalls:""),15*U,62*U);
    ctx.fillStyle=mult>1?YL:"#7fb8d8";
    ctx.fillText("STORM x"+mult,15*U,78*U);
  }else{
    ctx.textAlign="right";
    ctx.font=`900 ${Math.round(16*U)}px "Segoe UI"`;
    ctx.fillStyle=CY;
    ctx.fillText("BALL "+Math.min(ballNum,BALLS_PER_GAME)+"/"+BALLS_PER_GAME+(extraBalls?" +"+extraBalls:""),VW-14*U,Math.round(60*U));
    ctx.font=`900 ${Math.round(14*U)}px "Segoe UI"`;
    ctx.fillStyle=mult>1?YL:"#7fb8d8";
    ctx.fillText("STORM x"+mult,VW-14*U,Math.round(79*U));
  }
  ctx.restore();

  /* ---------- action panel, docked under the top band ---------- */
  drawActionPanel(U,narrow,barH);

  /* ---------- left instrument column (inside the play window edge) ---------- */
  const mx=14*U,mw=Math.round((narrow?146:186)*U);
  let my=hudTopH()+Math.round(20*U);
  meter(mx,my,mw,9*U,stormMeter,[CY,PU,YL],stormMeter>0.95?"\u26a1 LIGHTNING READY":"STORM METER",stormMeter>0.95);
  my+=Math.round(34*U);
  meter(mx,my,mw,9*U,surgeT>0?(surgeT/14):surge,[GR,GR,"#a8ffce"],
        surgeT>0?"SURGE "+Math.ceil(surgeT)+"s":"SURGE CHARGE",surgeT>0);
  my+=Math.round(34*U);
  if(combo>0){
    meter(mx,my,mw,9*U,clamp(combo/40,0,1),[MG,MG,PU],"COMBO "+combo+"  (x"+comboTier()+")",combo>=16);
    my+=Math.round(34*U);
  }
  ctx.save();
  ctx.textAlign="left";ctx.font=`800 ${Math.round(11*U)}px "Segoe UI"`;
  ctx.fillStyle=magGrabs>0?PU:"#4a5a72";
  ctx.fillText("MAG-GRAB",mx,my+8*U);
  for(let i=0;i<3;i++){
    ctx.beginPath();ctx.arc(mx+80*U+i*15*U,my+4*U,5*U,0,7);
    ctx.fillStyle=i<magGrabs?PU:"rgba(178,107,255,0.2)";ctx.fill();
  }
  ctx.restore();
  my+=Math.round(26*U);

  const buffs=[];
  if(frenzyT>0)buffs.push(["CHAOS x3",MG,frenzyT]);
  if(superBumperT>0)buffs.push(["SUPER BUMPERS",OR,superBumperT]);
  if(mbActive)buffs.push(["MULTIBALL",MG,0]);
  if(wizard.active)buffs.push(["ASCENSION",YL,wizard.t]);
  if(slowmoT>0)buffs.push(["BULLET TIME",IC,slowmoT]);
  if(f&&f.plasma>0)buffs.push(["PLASMA",OR,f.plasma]);
  if(f&&f.phase>0)buffs.push(["PHASE",CY,f.phase]);
  if(f&&f.heavy>0)buffs.push(["HEAVY",MG,f.heavy]);
  if(f&&f.shield)buffs.push(["SHIELD",GR,0]);
  if(ballSaveT>0)buffs.push(["BALL SAVE",GR,ballSaveT]);
  ctx.save();
  ctx.textAlign="left";ctx.font=`900 ${Math.round(12*U)}px "Segoe UI"`;
  buffs.slice(0,6).forEach((b,i)=>{
    const yy=my+i*23*U;
    ctx.fillStyle="rgba(3,5,22,0.66)";
    roundRect(mx,yy-12*U,Math.round(146*U),18*U,5*U);ctx.fill();
    ctx.fillStyle=b[1];
    ctx.fillText(b[0]+(b[2]>0?"  "+Math.ceil(b[2])+"s":""),mx+7*U,yy+1*U);
  });
  my+=buffs.slice(0,6).length*23*U+Math.round(14*U);
  ctx.restore();

  /* ---------- toasts: left column, never over the flippers ---------- */
  ctx.save();
  toasts.slice(0,3).forEach((t,i)=>{
    const al=t.t<0.25?t.t*4:(t.t>t.life-0.5?(t.life-t.t)*2:1);
    const yy=my+i*Math.round(26*U);
    ctx.globalAlpha=clamp(al,0,1);
    let tfs=Math.round(12*U);
    ctx.font=`900 ${tfs}px "Segoe UI"`;
    let twd=ctx.measureText(t.icon+"  "+t.text).width;
    const cap=Math.min(VW*0.62,300*U);
    if(twd+20*U>cap){tfs=Math.max(8,Math.floor(tfs*(cap-20*U)/twd));ctx.font=`900 ${tfs}px "Segoe UI"`;twd=ctx.measureText(t.icon+"  "+t.text).width;}
    ctx.fillStyle="rgba(3,5,24,0.84)";roundRect(mx,yy-13*U,twd+20*U,20*U,6*U);ctx.fill();
    ctx.strokeStyle=t.col;ctx.lineWidth=1.5;roundRect(mx,yy-13*U,twd+20*U,20*U,6*U);ctx.stroke();
    ctx.fillStyle=t.col;ctx.textAlign="left";
    ctx.fillText(t.icon+"  "+t.text,mx+10*U,yy+1*U);
  });
  ctx.restore();

  /* ---------- tilt ---------- */
  if(tiltHeat>1.4&&!tilted){
    ctx.save();ctx.textAlign="center";
    ctx.fillStyle=RD;ctx.font=`900 ${Math.round(20*U)}px "Segoe UI"`;
    ctx.globalAlpha=0.5+0.5*Math.sin(timeSec*14);
    ctx.fillText("DANGER — TILT",VW/2,hudTopH()+Math.round(40*U));
    ctx.restore();
  }
  if(tilted){
    ctx.save();ctx.textAlign="center";
    ctx.fillStyle=RD;ctx.font=`italic 900 ${Math.round(70*U)}px "Segoe UI"`;
    if(GLOW>0)ctx.shadowColor=RD,ctx.shadowBlur=30;
    ctx.fillText("TILT",VW/2,playTop()+playH()*0.42);
    ctx.restore();
  }

  /* ---------- announcement: upper third of the play window ---------- */
  if(announceCur){
    const a=announceCur;
    const prog=a.t/(a.big?1.7:1.15);
    const scl=a.big?1+0.2*Math.sin(prog*Math.PI):1;
    const al=prog<0.1?prog*10:(prog>0.82?(1-prog)*5.5:1);
    ctx.save();
    ctx.translate(VW/2,playTop()+playH()*0.24);
    ctx.scale(scl,scl);
    ctx.globalAlpha=clamp(al,0,1);
    let fs=Math.round(Math.min((a.big?44:29)*U, playH()*(a.big?0.15:0.11)));
    fs=Math.max(fs,11);
    ctx.font=`italic 900 ${fs}px "Segoe UI"`;
    const wNeed=ctx.measureText(a.text).width;
    const maxW=VW*0.88/Math.max(scl,0.01);
    if(wNeed>maxW){fs=Math.max(11,Math.floor(fs*maxW/wNeed));ctx.font=`italic 900 ${fs}px "Segoe UI"`;}
    ctx.textAlign="center";
    if(GLOW>0)ctx.shadowColor=a.col,ctx.shadowBlur=26;
    ctx.fillStyle=a.col;
    ctx.fillText(a.text,0,0);
    ctx.restore();
  }

  drawMinimap(U);
}

/* ---------- the one panel that changes with the situation ---------- */
function drawActionPanel(U,narrow,barH){
  const h=hudTopSmooth;
  if(h<4)return;
  const top=barH+Math.round(2*U);
  ctx.save();
  ctx.beginPath();ctx.rect(0,top-2,VW,h+2);ctx.clip();

  if(ballInPlunger&&(state==="PLAY")){
    const pw=Math.min(Math.round(360*U),VW-20),ph=Math.round(74*U);
    const px=VW/2-pw/2,py=top;
    ctx.fillStyle="rgba(3,4,22,0.9)";roundRect(px,py,pw,ph,10*U);ctx.fill();
    ctx.strokeStyle=YL;ctx.lineWidth=2;roundRect(px,py,pw,ph,10*U);ctx.stroke();
    ctx.textAlign="center";ctx.fillStyle=YL;
    ctx.font=`900 ${Math.round((narrow?10:12)*U)}px "Segoe UI"`;
    ctx.fillText(IS_TOUCH?"HOLD LAUNCH — RELEASE TO PICK A FLOOR":"HOLD SPACE — RELEASE TO PICK A FLOOR",px+pw/2,py+16*U);
    const idx=clamp(Math.floor(plungerCharge*4.999),0,4);
    const bw2=pw-24*U,bx=px+12*U,by=py+24*U;
    for(let i=0;i<5;i++){
      const seg=bw2/5;
      ctx.fillStyle=i===idx?DECKS[i].col:"rgba(255,255,255,0.09)";
      ctx.fillRect(bx+i*seg+1,by,seg-2,13*U);
      ctx.fillStyle=i===idx?"#001":"rgba(180,210,240,0.55)";
      ctx.font=`900 ${Math.round(8*U)}px "Segoe UI"`;
      ctx.fillText(DECKS[i].short,bx+i*seg+seg/2,by+9.5*U);
      if(skillArmed&&skillDeck===i){
        ctx.strokeStyle=YL;ctx.lineWidth=2;ctx.strokeRect(bx+i*seg+1,by,seg-2,13*U);
      }
    }
    ctx.fillStyle=WH;ctx.fillRect(bx+bw2*plungerCharge-1.5,by-4*U,3,21*U);
    ctx.font=`900 ${Math.round(15*U)}px "Segoe UI"`;ctx.fillStyle=DECKS[idx].col;
    ctx.fillText("\u2192 "+DECKS[idx].name+"  (x"+DECKS[idx].mult+")",px+pw/2,py+58*U);
    if(skillArmed){
      ctx.font=`900 ${Math.round(10*U)}px "Segoe UI"`;ctx.fillStyle=YL;
      ctx.globalAlpha=0.6+0.4*Math.sin(timeSec*7);
      ctx.fillText("\u2605 SKILL SHOT LIT: "+DECKS[skillDeck].name,px+pw/2,py+70*U);
      ctx.globalAlpha=1;
    }
  }else if(mission.active){
    const pw=Math.min(Math.round(280*U),VW-20),ph=Math.round(58*U);
    const px=VW/2-pw/2,py=top;
    ctx.fillStyle="rgba(3,4,22,0.9)";roundRect(px,py,pw,ph,10*U);ctx.fill();
    ctx.strokeStyle=mission.col;ctx.lineWidth=2;roundRect(px,py,pw,ph,10*U);ctx.stroke();
    ctx.textAlign="center";ctx.fillStyle=mission.col;
    if(GLOW>0)ctx.shadowColor=mission.col,ctx.shadowBlur=12;
    ctx.font=`900 ${Math.round(17*U)}px "Segoe UI"`;
    ctx.fillText(mission.name,px+pw/2,py+20*U);
    ctx.shadowBlur=0;
    ctx.font=`700 ${Math.round(11*U)}px "Segoe UI"`;ctx.fillStyle="#a9c6e8";
    const sub=mission.id==="overload"
      ? "CORE HEAT "+Math.round(mission.data.heat*100)+"%   VENTS "+mission.prog+"/"+mission.goal
      : mission.id==="rush" ? "EVERYTHING x10"
      : mission.prog+" / "+mission.goal;
    ctx.fillText(sub,px+pw/2,py+35*U);
    const bw2=pw-24*U;
    ctx.fillStyle="rgba(255,255,255,0.1)";ctx.fillRect(px+12*U,py+42*U,bw2,6*U);
    ctx.fillStyle=mission.t<6?RD:mission.col;
    ctx.fillRect(px+12*U,py+42*U,bw2*clamp(mission.t/mission.dur,0,1),6*U);
    if(mission.id==="overload"){
      ctx.fillStyle="rgba(255,255,255,0.1)";ctx.fillRect(px+12*U,py+50*U,bw2,4*U);
      ctx.fillStyle=mission.data.heat>0.75?RD:OR;
      ctx.fillRect(px+12*U,py+50*U,bw2*mission.data.heat,4*U);
    }
  }else{
    const txt = cannon.loaded ? (IS_TOUCH?"TAP LAUNCH TO FIRE THE CANNON":"PRESS SPACE TO FIRE THE CANNON")
      : wizard.active ? "ASCENSION \u2014 EVERY SHOT SCORES"
      : bossReady&&!boss.active ? "THE CROWN IS LIT \u2014 SHOOT THE KING"
      : boss.active ? "HIT THE KING \u2014 THE CROWN IS HIS HEART"
      : "SHOOT THE MISSION SCOOP \u2014 STORM SPINE";
    const col = cannon.loaded?YL : wizard.active?YL : (bossReady||boss.active)?RD : GR;
    ctx.textAlign="center";
    ctx.globalAlpha=(cannon.loaded||bossReady)?0.65+0.35*Math.sin(timeSec*8):0.85;
    let bfs=Math.round(13*U);
    ctx.font=`900 ${bfs}px "Segoe UI"`;
    let tw=ctx.measureText(txt).width;
    if(tw+28*U>VW*0.9){bfs=Math.max(8,Math.floor(bfs*(VW*0.9-28*U)/tw));ctx.font=`900 ${bfs}px "Segoe UI"`;tw=ctx.measureText(txt).width;}
    const w=tw+28*U;
    ctx.fillStyle="rgba(3,5,24,0.8)";roundRect(VW/2-w/2,top,w,24*U,8*U);ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=1.5;roundRect(VW/2-w/2,top,w,24*U,8*U);ctx.stroke();
    ctx.fillStyle=col;ctx.fillText(txt,VW/2,top+16.5*U);
  }
  ctx.restore();
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function meter(x,y,w,h,v,cols,label,hot){
  ctx.save();
  ctx.fillStyle="rgba(255,255,255,0.08)";ctx.fillRect(x,y,w,h);
  const g=ctx.createLinearGradient(x,0,x+w,0);
  g.addColorStop(0,cols[0]);g.addColorStop(0.5,cols[1]);g.addColorStop(1,cols[2]);
  ctx.fillStyle=hot?WH:g;
  if(hot&&GLOW>0){ctx.shadowColor=cols[2];ctx.shadowBlur=14;}
  ctx.fillRect(x,y,w*clamp(v,0,1),h);
  ctx.shadowBlur=0;
  const u=h/9;
  ctx.font=`700 ${Math.round(10.5*u)}px "Segoe UI"`;
  ctx.fillStyle=hot?cols[2]:"#7fb8d8";ctx.textAlign="left";
  ctx.fillText(label,x,y+h+11*u);
  ctx.restore();
}

/* ---------- MINIMAP: small, cornered, out of the shot line ---------- */
let minimapAlpha=1;
function drawMinimap(U){
  const h=clamp(Math.min(VH*0.30,VW*0.34),110,270), w=h*PW/PH;
  const x=VW-w-10*U, y=VH-hudBottomH()-h-10*U;
  const sx=w/PW, sy=h/PH;
  const fb=focusBall();
  let dim=1;
  if(fb){
    const p=w2s(fb.x,fb.y);
    if(p.x>x-46&&p.x<x+w+16&&p.y>y-46&&p.y<y+h+16)dim=0.24;
  }
  minimapAlpha=lerp(minimapAlpha,dim,0.12);
  ctx.save();
  ctx.globalAlpha=0.94*minimapAlpha;
  ctx.fillStyle="rgba(2,3,16,0.9)";
  roundRect(x-5,y-5,w+10,h+10,7);ctx.fill();
  ctx.strokeStyle="rgba(25,230,255,0.4)";ctx.lineWidth=1.5;
  roundRect(x-5,y-5,w+10,h+10,7);ctx.stroke();
  ctx.beginPath();ctx.rect(x-4,y-4,w+8,h+8);ctx.clip();
  for(const d of DECKS){
    ctx.fillStyle=d.hue+"0.14)";
    ctx.fillRect(x,y+d.y0*sy,w,(d.y1-d.y0)*sy);
    ctx.fillStyle=d.hue+"0.6)";
    ctx.font=`900 ${Math.max(6,Math.round(6.5*U))}px "Segoe UI"`;
    ctx.textAlign="left";
    ctx.fillText(d.short+" x"+d.mult,x+3,y+d.y0*sy+9);
  }
  ctx.strokeStyle="rgba(255,255,255,0.22)";ctx.lineWidth=1;
  ctx.beginPath();
  for(const sp of SEPS){ctx.moveTo(x,y+sp.y*sy);ctx.lineTo(x+w,y+sp.y*sy);}
  ctx.stroke();
  ctx.strokeStyle="rgba(178,107,255,0.45)";ctx.lineWidth=1.2;
  for(const R of rails){
    ctx.beginPath();
    R.pts.forEach((p,i)=>{const px=x+p[0]*sx,py=y+p[1]*sy;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    ctx.stroke();
  }
  const dot=(px,py,col,r)=>{ctx.beginPath();ctx.arc(x+px*sx,y+py*sy,r||1.6,0,7);ctx.fillStyle=col;ctx.fill();};
  for(const sc of scoops)dot(sc.x,sc.y,sc.lit?sc.col:"rgba(150,160,200,0.4)",sc.lit?2.6:1.7);
  for(const p of portals){dot(p.a.x,p.a.y,p.col,1.8);dot(p.b.x,p.b.y,p.col,1.8);}
  for(const o of orbs)dot(o.x,o.y,ORB_DEFS[o.kind].col,2.4);
  if(boss.active)dot(boss.x,boss.y,RD,4);
  if(mission.active&&mission.data&&mission.data.wisp)dot(mission.data.wisp.x,mission.data.wisp.y,GR,2.6);
  const cw2=cam.view*camAspect()*sx, chh2=cam.view*sy;
  ctx.strokeStyle="rgba(255,255,255,0.45)";ctx.lineWidth=1;
  ctx.strokeRect(x+cam.x*sx-cw2/2,y+cam.y*sy-chh2/2,cw2,chh2);
  for(const b of balls){
    if(b.gone)continue;
    ctx.save();
    ctx.shadowColor=b.gold?YL:WH;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(x+b.x*sx,y+b.y*sy,3,0,7);
    ctx.fillStyle=b.gold?YL:b.ghost?MG:WH;ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawAttractHUD(){
  setScreenTransform();
  const U=uiScale();
  ctx.save();
  ctx.textAlign="center";
  ctx.globalAlpha=0.55+0.2*Math.sin(timeSec*2);
  ctx.font=`900 ${Math.round(13*U)}px "Segoe UI"`;
  ctx.fillStyle=CY;
  ctx.fillText("NEON STORM: ASCENSION \u2014 1760 \u00d7 2900 PLAYFIELD",VW/2,VH-40*U);
  ctx.restore();
}

/* ============================================================
   SHARE CARD
   ============================================================ */
function grade(){
  return score>=7e8?"S++":score>=3e8?"S+":score>=1.2e8?"S":score>=5e7?"A":
         score>=2e7?"B":score>=8e6?"C":score>=3e6?"D":"E";
}
function buildShareCard(){
  const cw=1000,ch=1420;
  const c=document.createElement("canvas");c.width=cw;c.height=ch;
  const x=c.getContext("2d");
  const bg=x.createLinearGradient(0,0,cw,ch);
  bg.addColorStop(0,"#0a0630");bg.addColorStop(.5,"#140640");bg.addColorStop(1,"#020108");
  x.fillStyle=bg;x.fillRect(0,0,cw,ch);
  x.strokeStyle="rgba(25,230,255,0.06)";x.lineWidth=1;
  for(let i=0;i<cw;i+=48){x.beginPath();x.moveTo(i,0);x.lineTo(i,ch);x.stroke();}
  for(let i=0;i<ch;i+=48){x.beginPath();x.moveTo(0,i);x.lineTo(cw,i);x.stroke();}
  const halo=x.createRadialGradient(cw/2,ch*.26,60,cw/2,ch*.26,540);
  halo.addColorStop(0,"rgba(255,43,214,0.22)");halo.addColorStop(1,"transparent");
  x.fillStyle=halo;x.fillRect(0,0,cw,ch);
  x.save();
  x.strokeStyle=CY;x.shadowColor=CY;x.shadowBlur=28;x.lineWidth=6;x.strokeRect(28,28,cw-56,ch-56);
  x.strokeStyle=MG;x.shadowColor=MG;x.lineWidth=2;x.strokeRect(44,44,cw-88,ch-88);
  x.restore();

  x.textAlign="center";
  x.font="italic 900 74px 'Segoe UI',sans-serif";
  const tg=x.createLinearGradient(120,0,880,0);
  tg.addColorStop(0,CY);tg.addColorStop(.5,PU);tg.addColorStop(1,MG);
  x.fillStyle=tg;x.shadowColor=CY;x.shadowBlur=36;
  x.fillText("NEON STORM",cw/2,132);
  x.font="900 30px 'Segoe UI'";x.fillStyle=YL;x.shadowColor=YL;x.shadowBlur=18;
  x.fillText("A S C E N S I O N",cw/2,178);
  x.shadowBlur=0;

  x.font="700 24px 'Segoe UI'";x.fillStyle="#9db8dd";
  x.fillText("FINAL SCORE",cw/2,246);
  x.font="900 96px Consolas,monospace";
  x.fillStyle="#fff";x.shadowColor=YL;x.shadowBlur=44;
  x.fillText(fmt(score),cw/2,346);
  x.shadowBlur=0;

  const g=grade();
  const gc=g[0]==="S"?YL:g==="A"?GR:g==="B"?CY:"#9aa";
  x.font="italic 900 56px 'Segoe UI'";x.fillStyle=gc;x.shadowColor=gc;x.shadowBlur=32;
  x.fillText("RANK  "+g,cw/2,418);
  x.shadowBlur=0;

  /* tower diagram */
  const tw=150,th=430,tx=cw-tw-90,ty=470;
  x.fillStyle="rgba(0,0,0,0.35)";x.fillRect(tx-8,ty-8,tw+16,th+16);
  DECKS.slice().reverse().forEach((d)=>{
    const y0=ty+(d.y0/PH)*th, y1=ty+(d.y1/PH)*th;
    x.fillStyle=d.hue+(stats.maxAlt>=d.id?"0.55)":"0.12)");
    x.fillRect(tx,y0,tw,y1-y0);
    x.strokeStyle=d.hue+"0.7)";x.lineWidth=1;x.strokeRect(tx,y0,tw,y1-y0);
    x.fillStyle=stats.maxAlt>=d.id?"#fff":"rgba(200,220,255,0.4)";
    x.font="900 13px 'Segoe UI'";x.textAlign="center";
    x.fillText(d.short+"  x"+d.mult,tx+tw/2,(y0+y1)/2+4);
  });
  x.fillStyle=YL;x.font="900 15px 'Segoe UI'";
  x.fillText("PEAK: "+DECKS[stats.maxAlt].short,tx+tw/2,ty+th+26);

  const rows=[
    ["PEAK ALTITUDE","x"+DECKS[stats.maxAlt].mult],
    ["MAX COMBO",maxCombo],
    ["STORM MULTIPLIER","x"+stats.maxMult],
    ["MISSIONS CLEARED",stats.missions],
    ["STORM KINGS SLAIN",stats.bossKills],
    ["JACKPOTS",stats.jackpots],
    ["MULTIBALLS",stats.mb],
    ["RAILS RIDDEN",stats.rails],
    ["PORTALS",stats.portals],
    ["BRICKS SMASHED",stats.bricks],
    ["POWER ORBS",stats.orbs],
    ["SPINS",Math.round(stats.spins)]
  ];
  const ry=502,rh=36;
  rows.forEach((r,i)=>{
    const y=ry+i*rh;
    if(i%2===0){x.fillStyle="rgba(255,255,255,0.04)";x.fillRect(70,y-rh+11,cw-330,rh-4);}
    x.textAlign="left";x.font="700 20px 'Segoe UI'";x.fillStyle="#9db8dd";
    x.fillText(String(r[0]),92,y);
    x.textAlign="right";x.font="900 21px Consolas,monospace";x.fillStyle="#fff";
    x.fillText(String(r[1]),cw-282,y);
  });

  /* achievements */
  x.textAlign="left";x.font="900 17px 'Segoe UI'";x.fillStyle=YL;
  x.fillText("BADGES",92,ry+rows.length*rh+24);
  x.font="700 15px 'Segoe UI'";x.fillStyle="#bcd8ff";
  const at=ACH_LIST.length?ACH_LIST.map(a=>a.title).join("  •  "):"none this run";
  wrapText(x,at,92,ry+rows.length*rh+48,cw-184,20);

  const dur=durationSec;
  x.textAlign="center";x.font="700 20px 'Segoe UI'";x.fillStyle="#9db8dd";
  x.fillText("TIME "+Math.floor(dur/60)+"m "+(dur%60)+"s   •   BALLS "+ballsPlayed+"   •   NUDGES "+nudgesUsed,cw/2,ch-146);

  const sig=h32(score,chain,sessSeed,durationSec,maxCombo,stats.missions,0x9e3779b9);
  const code="NSA-"+sessSeed.toString(36).toUpperCase().padStart(7,"0").slice(0,7)
    +"-"+chain.toString(36).toUpperCase().padStart(7,"0").slice(0,7)
    +"-"+sig.toString(36).toUpperCase().padStart(7,"0").slice(0,7);
  x.font="700 18px Consolas,monospace";
  x.fillStyle=cheatFlag?RD:GR;x.shadowColor=cheatFlag?RD:GR;x.shadowBlur=12;
  x.fillText(cheatFlag?"⚠ SIGNATURE INVALID ⚠":"VERIFIED  "+code,cw/2,ch-104);
  x.shadowBlur=0;
  x.font="600 17px 'Segoe UI'";x.fillStyle="#5f7fa8";
  x.fillText("five decks • 2,900px of tower • can you out-climb this?",cw/2,ch-70);
  return{canvas:c,code};
}
function wrapText(x,text,px,py,maxW,lh){
  const words=String(text).split(" ");let line="",yy=py;
  for(const w of words){
    const t=line?line+" "+w:w;
    if(x.measureText(t).width>maxW&&line){x.fillText(line,px,yy);line=w;yy+=lh;}
    else line=t;
  }
  if(line)x.fillText(line,px,yy);
}
