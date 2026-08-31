/* ============================================================
   p7 :: WORLD RENDERING

   Neon glow is drawn as layered strokes (wide+faint under narrow+bright)
   rather than canvas shadowBlur. A blur forces the rasteriser to render the
   path to a scratch surface and convolve it; three plain strokes of a cached
   Path2D cost a fraction of that. shadowBlur survives only on a small budget
   of hero elements.
   ============================================================ */
let vx0=0,vx1=PW,vy0=0,vy1=PH,GLOW=1,shadowBudget=0;
const vis=(x,y,pad)=>{pad=pad||0;return x>vx0-pad&&x<vx1+pad&&y>vy0-pad&&y<vy1+pad;};

function setWorldTransform(){
  const s=camScale();
  ctx.setTransform(DPR*s,0,0,DPR*s,
    DPR*(VW/2+cam.shx-cam.x*s), DPR*(playTop()+playH()/2+cam.shy-cam.y*s));
}
function setScreenTransform(){ctx.setTransform(DPR,0,0,DPR,0,0);}

/* budgeted shadow — returns false when the frame has spent its allowance */
function glowOn(col,blur){
  if(quality<0.5||shadowBudget<=0)return false;
  shadowBudget--;
  ctx.shadowColor=col;ctx.shadowBlur=blur*GLOW;
  return true;
}
function glowOff(){ctx.shadowBlur=0;}

/* layered neon: no blur, three strokes */
function neonPath(path,col,w,strength){
  ctx.save();
  ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=col;
  const st=(strength===undefined?1:strength)*clamp(quality,0.4,1);
  if(st>0.05){
    ctx.globalAlpha=0.13*st;ctx.lineWidth=w*3.4;ctx.stroke(path);
    ctx.globalAlpha=0.26*st;ctx.lineWidth=w*2.0;ctx.stroke(path);
  }
  ctx.globalAlpha=1;ctx.lineWidth=w;ctx.stroke(path);
  ctx.restore();
}
function glowStroke(fn,col,w,blur){
  ctx.save();
  ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=col;
  const st=clamp((blur||12)/14,0.4,1.6)*clamp(quality,0.4,1);
  if(st>0.05){
    ctx.globalAlpha=0.13*st;ctx.lineWidth=w*3.2;fn();ctx.stroke();
    ctx.globalAlpha=0.26*st;ctx.lineWidth=w*1.95;fn();ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.lineWidth=w;fn();ctx.stroke();
  ctx.restore();
}

/* ---------- static geometry baked into Path2D once ---------- */
let P_WALLS=new Path2D();
for(const w of walls){P_WALLS.moveTo(w.x1,w.y1);P_WALLS.lineTo(w.x2,w.y2);}
let P_RAIL=rails.map(R=>{
  const p=new Path2D();
  p.moveTo(R.pts[0][0],R.pts[0][1]);
  for(let i=1;i<R.pts.length;i++)p.lineTo(R.pts[i][0],R.pts[i][1]);
  return p;
});
const P_LAUNCH=(()=>{
  const p=new Path2D();
  p.moveTo(LAUNCH_PATH[0][0],LAUNCH_PATH[0][1]);
  for(let i=1;i<LAUNCH_PATH.length;i++)p.lineTo(LAUNCH_PATH[i][0],LAUNCH_PATH[i][1]);
  return p;
})();
let P_SLING=slings.map(s=>{
  const p=new Path2D();
  p.moveTo(s.ax,s.ay);p.lineTo(s.bx,s.by);p.lineTo(s.cx,s.cy);p.closePath();
  return p;
});
let P_POSTS=(()=>{
  const p=new Path2D();
  for(const q of posts){p.moveTo(q.x+q.r,q.y);p.arc(q.x,q.y,q.r,0,7);}
  return p;
})();
/* A warp swaps the world's contents, so the geometry baked at load has to be
   baked again. Called from restoreWorld()/enterLevel() in 03b-levels.js. */
function rebuildPaths(){
  P_WALLS=(()=>{const p=new Path2D();
    for(const w of walls){p.moveTo(w.x1,w.y1);p.lineTo(w.x2,w.y2);}return p;})();
  P_RAIL=rails.map(r=>{const p=new Path2D();
    p.moveTo(r.pts[0][0],r.pts[0][1]);
    for(let i=1;i<r.pts.length;i++)p.lineTo(r.pts[i][0],r.pts[i][1]);return p;});
  P_SLING=slings.map(s=>{const p=new Path2D();
    p.moveTo(s.ax,s.ay);p.lineTo(s.bx,s.by);p.lineTo(s.cx,s.cy);p.closePath();return p;});
  P_POSTS=(()=>{const p=new Path2D();
    for(const q of posts){p.moveTo(q.x+q.r,q.y);p.arc(q.x,q.y,q.r,0,7);}return p;})();
}

/* ============================================================
   THE WARP-ROOM BACKGROUNDS
   Drawn in SCREEN space, before the world transform and before the play-window
   clip: they are the room you are standing in, not something on the table, and
   they should fill every pixel including the ones behind the HUD bands.
   Each is cheap on purpose — a handful of fills and one stroked path set — so
   a phone can afford them on top of a full playfield.
   ============================================================ */
function drawLevelBG(){
  const t=timeSec, q=clamp(quality,0.35,1);
  ctx.save();
  const cx=VW/2, cy=playTop()+playH()*0.44;
  const R=Math.hypot(VW,VH);

  if(level.id==="spiral"){
    /* The hypnosis, done with FILLS rather than long wide strokes: a pinwheel
       of wedges turning one way, rings breathing outward through it the other.
       The first version stroked twelve 50-point spirals a frame and cost more
       than the whole playfield; a wedge is three points and a fill. */
    ctx.translate(cx,cy);
    ctx.rotate(t*0.19);
    const wedges=Math.round(7*q)+5;
    for(let i=0;i<wedges;i++){
      const a0=i/wedges*Math.PI*2, a1=a0+Math.PI/wedges*0.92;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,R*0.8,a0,a1);
      ctx.closePath();
      ctx.fillStyle=`hsla(${(t*20+i*(360/wedges))%360},88%,58%,0.075)`;
      ctx.fill();
    }
    ctx.rotate(-t*0.34);
    const rings=Math.round(8*q)+3;
    for(let i=0;i<rings;i++){
      const p=(i/rings+((t*0.13)%1))%1;
      const rr=p*R*0.72;
      ctx.beginPath();ctx.arc(0,0,rr,0,7);
      ctx.strokeStyle=`hsla(${(t*22+i*24)%360},96%,66%,${0.17*(1-p)})`;
      ctx.lineWidth=2+10*(1-p);
      ctx.stroke();
    }
    ctx.restore();
    const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.55);
    const b=0.10+0.05*Math.sin(t*1.1);
    gg.addColorStop(0,`rgba(178,107,255,${b})`);
    gg.addColorStop(1,"rgba(178,107,255,0)");
    ctx.fillStyle=gg;ctx.fillRect(0,0,VW,VH);
    return;
  }

  if(level.id==="forge"){
    /* heat rising, and a furnace glow that brightens as the lava climbs */
    const s2=camScale();
    const lavaScreen=(lavaY-cam.y)*s2+playTop()+playH()/2;
    const heat=clamp(1-(lavaScreen-playTop())/Math.max(playH(),1),0,1);
    const bands=Math.round(8*q)+3;
    for(let i=0;i<bands;i++){
      const p=((i/bands)-((t*0.09)%1)+1)%1;
      const y=VH-p*VH*1.15;
      ctx.fillStyle=`rgba(255,${90+120*(1-p)|0},20,${0.055*(1-p)*(0.5+heat)})`;
      ctx.fillRect(0,y,VW,VH*0.06);
    }
    const gg=ctx.createLinearGradient(0,VH,0,VH*0.25);
    gg.addColorStop(0,`rgba(255,90,10,${0.20+heat*0.34})`);
    gg.addColorStop(1,"rgba(255,60,0,0)");
    ctx.fillStyle=gg;ctx.fillRect(0,0,VW,VH);
    ctx.restore();
    return;
  }

  /* the deep: slow curtains of light and a drifting caustic net */
  const curtains=Math.round(3*q)+2;
  for(let i=0;i<curtains;i++){
    const ph=t*0.19+i*1.7;
    const x=(Math.sin(ph)*0.5+0.5)*VW;
    const w2=VW*(0.13+0.07*Math.sin(ph*1.7));
    const gg=ctx.createLinearGradient(x-w2,0,x+w2,0);
    gg.addColorStop(0,"rgba(57,255,106,0)");
    gg.addColorStop(0.5,`rgba(${i%2?57:120},255,${i%2?150:230},${0.07+0.03*Math.sin(ph*2.3)})`);
    gg.addColorStop(1,"rgba(57,255,106,0)");
    ctx.fillStyle=gg;ctx.fillRect(x-w2,0,w2*2,VH);
  }
  if(q>0.55){
    ctx.strokeStyle="rgba(160,255,220,0.05)";ctx.lineWidth=1.4;
    ctx.beginPath();
    const step=140;
    for(let y=0;y<VH+step;y+=step){
      ctx.moveTo(0,y+Math.sin(t*0.7)*10);
      for(let x=0;x<=VW;x+=90)
        ctx.lineTo(x,y+Math.sin(t*0.7+x*0.012+y*0.01)*14);
    }
    ctx.stroke();
  }
  const gg2=ctx.createRadialGradient(cx,VH,0,cx,VH,VH*1.1);
  gg2.addColorStop(0,"rgba(2,40,44,0.5)");
  gg2.addColorStop(1,"rgba(2,23,26,0)");
  ctx.fillStyle=gg2;ctx.fillRect(0,0,VW,VH);
  ctx.restore();
}

function drawWorld(){
  const s=camScale();
  const midY=playTop()+playH()/2;
  vx0=cam.x-(VW/2)/s-80; vx1=cam.x+(VW/2)/s+80;
  vy0=cam.y-midY/s-80;   vy1=cam.y+(VH-midY)/s+80;
  GLOW=clamp(s*1.5,0.15,1.1)*quality;
  shadowBudget=quality>0.75?24:(quality>0.5?10:0);

  setScreenTransform();
  ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.shadowColor="rgba(0,0,0,0)";
  ctx.setLineDash([]);ctx.globalCompositeOperation="source-over";
  ctx.fillStyle="#02010a";ctx.fillRect(0,0,VW,VH);

  /* deck-tinted vertical wash in screen space */
  const g=ctx.createLinearGradient(0,0,0,VH);
  const topD=deckAt(clamp(vy0,0,PH-1)),botD=deckAt(clamp(vy1,0,PH-1));
  g.addColorStop(0,topD.dark);
  g.addColorStop(0.5,level?level.dark:"#040317");
  g.addColorStop(1,botD.dark);
  ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
  if(level)drawLevelBG();
  if(bgPulse>0.02){ctx.fillStyle=`rgba(25,230,255,${bgPulse*0.05})`;ctx.fillRect(0,0,VW,VH);}

  /* Clip the playfield to the play window. The HUD bands are laid out so no
     panel sits over the flippers; this makes the same promise for the table
     itself, which otherwise draws on under the touch controls. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0,clipTop(),VW,clipH());
  ctx.clip();

  setWorldTransform();

  /* ---- parallax star grid ---- */
  ctx.save();
  ctx.strokeStyle="rgba(25,230,255,0.045)";ctx.lineWidth=1.2/s;
  const gs=140;
  const gx0=Math.floor(vx0/gs)*gs,gx1=Math.ceil(vx1/gs)*gs;
  const gy0=Math.floor(vy0/gs)*gs,gy1=Math.ceil(vy1/gs)*gs;
  ctx.beginPath();
  for(let x=gx0;x<=gx1;x+=gs){ctx.moveTo(x,vy0);ctx.lineTo(x,vy1);}
  for(let y=gy0;y<=gy1;y+=gs){ctx.moveTo(vx0,y);ctx.lineTo(vx1,y);}
  ctx.stroke();ctx.restore();

  /* ---- deck bands + big faint labels ---- */
  for(const d of DECKS){
    if(d.y1<vy0||d.y0>vy1)continue;
    ctx.save();
    const bg=ctx.createLinearGradient(0,d.y0,0,d.y1);
    bg.addColorStop(0,d.hue+"0.05)");
    bg.addColorStop(1,d.hue+"0.012)");
    ctx.fillStyle=bg;ctx.fillRect(40,d.y0,PW-140,d.y1-d.y0);
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign="center";ctx.textBaseline="middle";
  const decorFade=clamp(1.55-camScale()*0.95,0.18,1);
  for(const d of decor){
    if(!vis(d.x,d.y,400))continue;
    ctx.globalAlpha=d.a*decorFade;
    ctx.font=`italic 900 ${d.s}px "Segoe UI",sans-serif`;
    ctx.fillStyle=d.c;
    ctx.fillText(d.t,d.x,d.y);
  }
  ctx.restore();

  /* ---- rain ---- */
  if(weather.rain>0.05&&s>0.25){
    ctx.save();
    ctx.strokeStyle=`rgba(150,210,255,${0.10+weather.rain*0.14})`;
    ctx.lineWidth=1.6/s;ctx.beginPath();
    for(const d of rainDrops){
      if(!vis(d.x,d.y,60))continue;
      ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-windX*0.02,d.y+d.l);
    }
    ctx.stroke();ctx.restore();
  }

  /* ---- rails ---- */
  rails.forEach((R,ri)=>{
    const lit=R.fx>0.02, path=P_RAIL[ri];
    ctx.save();
    ctx.lineCap="round";ctx.lineJoin="round";
    ctx.strokeStyle="rgba(4,6,22,0.85)";ctx.lineWidth=44;
    ctx.stroke(path);
    ctx.restore();
    neonPath(path,lit?WH:R.col,lit?7:4,lit?1.6:1);
    if(quality>0.6){
      ctx.save();
      ctx.globalAlpha=0.5+0.5*R.fx;
      ctx.setLineDash([16,26]);ctx.lineDashOffset=-timeSec*180;
      ctx.strokeStyle=R.col;ctx.lineWidth=2.4;
      ctx.stroke(path);ctx.restore();
    }
    // mouth
    const m=R.mouth;
    if(vis(m.x,m.y,200)){
      ctx.save();
      ctx.translate(m.x,m.y);ctx.rotate(timeSec*1.6);
      ctx.strokeStyle=R.col;ctx.lineWidth=5;
      ctx.setLineDash([12,10]);
      ctx.globalAlpha=0.25;ctx.lineWidth=13;
      ctx.beginPath();ctx.arc(0,0,m.r,0,7);ctx.stroke();
      ctx.globalAlpha=1;ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(0,0,m.r,0,7);ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.fillStyle=R.col;ctx.font="900 22px 'Segoe UI'";ctx.textAlign="center";
      ctx.globalAlpha=0.85;
      ctx.fillText(R.short,m.x,m.y+m.r+30);
      ctx.restore();
    }
  });

  /* ---- launch lane tube (the tower's, and only the tower's) ---- */
  if(!level){
  ctx.save();
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.strokeStyle="rgba(6,8,26,0.9)";ctx.lineWidth=64;
  ctx.stroke(P_LAUNCH);ctx.restore();
  neonPath(P_LAUNCH,"rgba(255,233,59,0.6)",5,0.9);
  LAUNCH_EXITS.forEach((e,i)=>{
    if(!vis(e.x,e.y,200))return;
    const on=ballInPlunger&&clamp(Math.floor(plungerCharge*4.999),0,4)===i;
    const sk=skillArmed&&skillDeck===i;
    ctx.save();
    ctx.strokeStyle=on?WH:(sk?YL:DECKS[e.deck].col);
    ctx.globalAlpha=on?1:(sk?0.9:0.42);
    ctx.lineWidth=on?7:3.5;
    if(on||sk)glowOn(on?WH:YL,22);
    ctx.beginPath();ctx.arc(e.x+80,e.y,26,0,7);ctx.stroke();
    ctx.fillStyle=on?WH:(sk?YL:DECKS[e.deck].col);
    ctx.font="900 20px 'Segoe UI'";ctx.textAlign="right";
    ctx.fillText(DECKS[e.deck].short,e.x+40,e.y+7);
    if(sk){ctx.font="900 14px 'Segoe UI'";ctx.fillText("SKILL",e.x+40,e.y+26);}
    ctx.restore();
  });

  }

  /* ---- portals ---- */
  for(const p of portals){
    [p.a,p.b].forEach((e,i)=>{
      if(!vis(e.x,e.y,200))return;
      const ready=p.cool<=0;
      ctx.save();
      ctx.translate(e.x,e.y);
      const rings=quality>0.6?2:1;
      for(let k=0;k<rings;k++){
        ctx.save();
        ctx.rotate(timeSec*(1.4+k*0.8)*(k%2?-1:1)+i*1.4);
        ctx.strokeStyle=p.col;
        ctx.setLineDash([22,16]);
        ctx.globalAlpha=(ready?0.28:0.1);ctx.lineWidth=(4-k)*3;
        ctx.beginPath();ctx.arc(0,0,p.r-k*10,0,7);ctx.stroke();
        ctx.globalAlpha=ready?0.9-k*0.2:0.25;ctx.lineWidth=4-k;
        ctx.beginPath();ctx.arc(0,0,p.r-k*10,0,7);ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle=`rgba(0,0,0,0.55)`;
      ctx.beginPath();ctx.arc(0,0,p.r-20,0,7);ctx.fill();
      ctx.restore();
    });
  }

  /* ---- magnets ---- */
  for(const m of magnets){
    if(!vis(m.x,m.y,240))continue;
    const act=m.state==="pull"||m.state==="hold";
    ctx.save();
    ctx.translate(m.x,m.y);
    ctx.strokeStyle=act?WH:m.col;
    ctx.globalAlpha=act?1:(m.lit?0.8:0.35);
    ctx.lineWidth=act?6:3;
    if(act)glowOn(m.col,28);
    for(let k=0;k<3;k++){
      const rr=m.r*(0.45+k*0.28)+(act?Math.sin(timeSec*11+k)*7:0);
      ctx.beginPath();ctx.arc(0,0,rr,0,7);ctx.stroke();
    }
    ctx.globalAlpha=act?0.9:0.5;
    ctx.fillStyle=m.col;ctx.font="900 20px 'Segoe UI'";ctx.textAlign="center";
    ctx.fillText(m.name,0,m.r+34);
    ctx.restore();
  }

  /* ---- walls ---- */
  neonPath(P_WALLS,"rgba(25,230,255,0.92)",6,1);

  /* ---- separator girders (tower only — a warp room is one floor) ---- */
  for(const sp of (level?[]:SEPS)){
    if(sp.y<vy0-200||sp.y>vy1+200)continue;
    const col=DECKS[sp.deck].col;
    ctx.save();
    ctx.globalAlpha=0.16;ctx.fillStyle=col;
    ctx.fillRect(60,sp.y-6,sp.lx[0]-60,12);
    ctx.fillRect(sp.lx[1],sp.y-6,sp.cx[0]-sp.lx[1],12);
    ctx.fillRect(sp.cx[1],sp.y-6,sp.rx[0]-sp.cx[1],12);
    ctx.fillRect(sp.rx[1],sp.y-6,1600-sp.rx[1],12);
    ctx.restore();
    // chute arrows
    ctx.save();
    ctx.globalAlpha=0.35;ctx.fillStyle=col;ctx.font="900 22px 'Segoe UI'";ctx.textAlign="center";
    ctx.fillText("▼",(sp.lx[0]+sp.lx[1])/2,sp.y+34);
    ctx.fillText("▼",(sp.rx[0]+sp.rx[1])/2,sp.y+34);
    ctx.restore();
  }

  /* ---- slingshots ---- */
  slings.forEach((sl,si)=>{
    if(!vis(sl.bx,sl.by,400))return;
    const hot=sl.fx>0.02;
    ctx.save();
    ctx.globalAlpha=0.16+sl.fx*0.4;ctx.fillStyle=MG;ctx.fill(P_SLING[si]);
    ctx.restore();
    neonPath(P_SLING[si],hot?WH:MG,hot?6:4,hot?1.7:1);
  });

  /* ---- bricks ---- */
  for(const br of bricks){
    if(!br.alive||!vis(br.x,br.y,300))continue;
    ctx.save();
    ctx.fillStyle=br.col;ctx.globalAlpha=0.22;
    ctx.fillRect(br.x,br.y,br.w,br.h);
    ctx.globalAlpha=1;
    ctx.strokeStyle=br.col;
    ctx.globalAlpha=0.3;ctx.lineWidth=8;ctx.strokeRect(br.x+1.5,br.y+1.5,br.w-3,br.h-3);
    ctx.globalAlpha=1;ctx.lineWidth=3;ctx.strokeRect(br.x+1.5,br.y+1.5,br.w-3,br.h-3);
    ctx.restore();
  }

  /* ---- drop targets ---- */
  for(const bank of dropBanks){
    bank.targets.forEach((t,i)=>{
      if(!vis(t.cx,t.cy,300))return;
      if(t.up){
        const lit=bank.type==="chaos"&&chaosLetters[i];
        glowStroke(()=>{ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);},
          t.fx>0.02?WH:(lit?GR:RD),9,t.fx>0.02?28:14);
        ctx.save();
        ctx.fillStyle=WH;ctx.font="900 24px 'Segoe UI'";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.globalAlpha=0.9;
        ctx.fillText(bank.word[i]||"",t.cx,t.cy);
        ctx.restore();
      }else{
        ctx.save();
        ctx.strokeStyle="rgba(255,51,85,0.16)";ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(t.x1,t.y1);ctx.lineTo(t.x2,t.y2);ctx.stroke();
        ctx.restore();
      }
    });
  }

  /* ---- rollovers + lanes ---- */
  for(const r of rollovers){
    if(!vis(r.x,r.y,220))continue;
    /* a warp room's rollovers are not STORM letters — a pearl is a pearl */
    if(level){
      const on=!!r.lit, c=r.pearl?(on?GR:IC):(on?level.col2:level.col);
      ctx.save();
      ctx.strokeStyle=c;ctx.lineWidth=on?5:3;ctx.globalAlpha=on?1:0.55;
      if(on)glowOn(c,18);
      ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke();
      if(r.pearl){
        ctx.globalAlpha=on?1:0.35;
        const g2=ctx.createRadialGradient(r.x-r.r*0.3,r.y-r.r*0.3,1,r.x,r.y,r.r*0.8);
        g2.addColorStop(0,"#ffffff");g2.addColorStop(1,on?GR:"rgba(140,220,255,0.5)");
        ctx.fillStyle=g2;
        ctx.beginPath();ctx.arc(r.x,r.y,r.r*0.62,0,7);ctx.fill();
      }
      ctx.restore();
      continue;
    }
    const crown=r.group==="crown";
    const done=crown?false:stormLetters[r.id];
    const col=crown?YL:(done?GR:CY);
    ctx.save();
    ctx.strokeStyle=col;ctx.lineWidth=done?5:3;
    ctx.globalAlpha=done||crown?1:0.6;
    if(done||crown)glowOn(col,18);
    ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke();
    ctx.fillStyle=done?GR:(crown?YL:"rgba(140,200,255,0.75)");
    ctx.font="900 26px 'Segoe UI'";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(crown?"◆":STORM_WORD[r.id],r.x,r.y+1);
    ctx.restore();
  }
  for(const l of lanes){
    if(!vis(l.x,l.y,220))continue;
    const on=l.deck===0?kickLit[l.id]:true;
    ctx.save();
    ctx.strokeStyle=on?GR:"rgba(120,170,220,0.5)";ctx.lineWidth=on?4:2.5;
    if(on)glowOn(GR,16);
    ctx.beginPath();ctx.arc(l.x,l.y,l.r,0,7);ctx.stroke();
    ctx.restore();
  }
  /* ---- kickbacks ---- */
  for(const k of kickbacks){
    if(!vis(k.x,k.y,220))continue;
    const on=kickLit[k.side];
    ctx.save();
    ctx.translate(k.x,k.y);
    ctx.strokeStyle=on?GR:"rgba(110,150,130,0.28)";
    ctx.lineWidth=on?6:3;
    if(on)glowOn(GR,14+8*Math.sin(timeSec*9));
    ctx.beginPath();
    ctx.moveTo(-22,18);ctx.lineTo(0,-12);ctx.lineTo(22,18);
    ctx.moveTo(-22,40);ctx.lineTo(0,10);ctx.lineTo(22,40);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- spinners ---- */
  for(const sp of spinners){
    if(!vis(sp.x,sp.y,240))continue;
    ctx.save();ctx.translate(sp.x,sp.y);
    ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,sp.r,0,7);ctx.stroke();
    ctx.rotate(sp.ang);
    ctx.strokeStyle=sp.vel>1?WH:sp.col;ctx.lineWidth=7;
    if(sp.vel>0.5)glowOn(sp.col,12+Math.min(sp.vel*1.4,24));
    ctx.beginPath();ctx.moveTo(0,-sp.r);ctx.lineTo(0,sp.r);ctx.stroke();
    ctx.restore();
  }

  /* ---- scoops ---- */
  for(const sc of scoops){
    if(!vis(sc.x,sc.y,260))continue;
    let on=sc.lit||sc.kind==="mystery"||sc.kind==="cannon";
    if(sc.kind==="rod"&&boss.active)continue;
    /* a warp gate is a hole, not a target: draw the tunnel down it, and go
       grey while it is cooling so you can see at a glance where you can go */
    if(sc.warp){
      const ready=gateCool[sc.level]<=0;
      on=ready;
      const LC=LEVELS[sc.level];
      ctx.save();ctx.translate(sc.x,sc.y);
      for(let i=0;i<5;i++){
        const p=((i/5)+((timeSec*(ready?0.55:0.14))%1))%1;
        ctx.beginPath();ctx.arc(0,0,sc.r*(1.55-p*1.35),0,7);
        ctx.strokeStyle=ready?LC.col:"rgba(140,150,180,0.5)";
        ctx.globalAlpha=(ready?0.5:0.16)*(1-Math.abs(p-0.35));
        ctx.lineWidth=3+7*(1-p);ctx.stroke();
      }
      ctx.globalAlpha=1;
      ctx.rotate(-timeSec*(ready?1.7:0.4));
      ctx.fillStyle=ready?LC.dark:"#0b0d18";
      ctx.beginPath();ctx.arc(0,0,sc.r*0.82,0,7);ctx.fill();
      ctx.restore();
      if(!ready){
        ctx.save();
        ctx.fillStyle="rgba(160,175,205,0.75)";
        ctx.font="900 20px 'Segoe UI'";ctx.textAlign="center";
        ctx.fillText(Math.ceil(gateCool[sc.level])+"s",sc.x,sc.y+7);
        ctx.restore();
      }
    }
    ctx.save();ctx.translate(sc.x,sc.y);
    ctx.fillStyle="rgba(0,0,0,0.6)";
    ctx.beginPath();ctx.arc(0,0,sc.r,0,7);ctx.fill();
    ctx.rotate(timeSec*(on?2.2:0.7));
    ctx.strokeStyle=on?sc.col:"rgba(150,160,200,0.35)";
    ctx.lineWidth=on?5:3;
    if(on)glowOn(sc.col,20);
    ctx.setLineDash([15,11]);
    ctx.beginPath();ctx.arc(0,0,sc.r,0,7);ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle=on?sc.col:"rgba(150,160,200,0.5)";
    ctx.font="900 19px 'Segoe UI'";ctx.textAlign="center";
    ctx.fillText(sc.name,sc.x,sc.y+sc.r+28);
    ctx.restore();
  }

  /* ---- the Forgeworks: molten floor and the pistons ---- */
  if(level&&level.id==="forge"){
    for(const p of pistons){
      if(!p.ext||p.ext<2)continue;
      const x0=p.dir>0?p.x:p.x-p.ext, w2=p.ext;
      ctx.save();
      ctx.fillStyle=p.fx>0?YL:"#7a3a10";
      ctx.fillRect(x0,p.y-p.h/2,w2,p.h);
      ctx.strokeStyle=p.fx>0?WH:OR;ctx.lineWidth=3;
      if(GLOW>0)glowOn(OR,14);
      ctx.strokeRect(x0,p.y-p.h/2,w2,p.h);
      ctx.restore();
    }
    if(lavaY<vy1+200){
      ctx.save();
      /* only paint the molten part you can actually see — the shaft below it
         can be a thousand pixels of gradient nobody is looking at */
      const bot=Math.min(PH+180,vy1+160);
      const lg=ctx.createLinearGradient(0,lavaY-90,0,bot);
      lg.addColorStop(0,"rgba(255,60,0,0)");
      lg.addColorStop(0.35,"rgba(255,110,10,0.65)");
      lg.addColorStop(1,"rgba(255,220,90,0.95)");
      ctx.fillStyle=lg;ctx.fillRect(0,lavaY-90,PW,bot-lavaY+90);
      const surf=new Path2D(), body=new Path2D();
      surf.moveTo(0,lavaY);body.moveTo(0,lavaY);
      for(let x=0;x<=PW;x+=60){
        const yy=lavaY+Math.sin(timeSec*3.1+x*0.012)*13+Math.sin(timeSec*1.7+x*0.03)*7;
        surf.lineTo(x,yy);body.lineTo(x,yy);
      }
      body.lineTo(PW,bot);body.lineTo(0,bot);body.closePath();
      ctx.fillStyle="rgba(255,150,30,0.55)";ctx.fill(body);
      /* layered strokes, not shadowBlur — same rule as the rest of the game */
      ctx.strokeStyle=OR;ctx.globalAlpha=0.3;ctx.lineWidth=16;ctx.stroke(surf);
      ctx.globalAlpha=1;ctx.strokeStyle=YL;ctx.lineWidth=5;ctx.stroke(surf);
      ctx.restore();
    }
  }
  /* ---- the Deep: the currents you are drifting in ---- */
  if(level&&level.id==="deep"&&quality>0.5){
    ctx.save();
    ctx.strokeStyle="rgba(160,255,220,0.16)";ctx.lineWidth=2.5;ctx.lineCap="round";
    for(const c of currents){
      const n=6;
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2+timeSec*0.3;
        const px=c.x+Math.cos(a)*c.r*0.62, py=c.y+Math.sin(a)*c.r*0.62;
        const m=Math.hypot(c.fx,c.fy)||1;
        const dx=c.fx/m*46, dy=c.fy/m*46;
        const wob=Math.sin(timeSec*1.6+i)*10;
        ctx.beginPath();
        ctx.moveTo(px-dx,py-dy+wob);
        ctx.quadraticCurveTo(px+wob,py,px+dx,py+dy+wob);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- cannon barrel ---- */
  if(cannon.loaded){
    const sc=scoopBy("CANNON");
    ctx.save();ctx.translate(sc.x,sc.y);ctx.rotate(cannon.ang);
    ctx.strokeStyle=YL;ctx.lineWidth=16;ctx.lineCap="round";
    glowOn(YL,24);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(88,0);ctx.stroke();
    ctx.strokeStyle="rgba(255,233,59,0.35)";ctx.lineWidth=4;ctx.setLineDash([16,20]);
    ctx.beginPath();ctx.moveTo(88,0);ctx.lineTo(760,0);ctx.stroke();
    ctx.restore();
  }

  /* ---- bumpers ---- */
  for(const bp of bumpers){
    if(!vis(bp.x,bp.y,260))continue;
    const gl=bp.fx;
    ctx.save();
    if(gl>0.05||superBumperT>0)glowOn(bp.col,14+gl*34+(superBumperT>0?14:0));
    ctx.beginPath();ctx.arc(bp.x,bp.y,bp.r,0,7);
    ctx.fillStyle="rgba(16,16,52,0.92)";ctx.fill();
    ctx.lineWidth=6;ctx.strokeStyle=gl>0.02?WH:bp.col;ctx.stroke();
    ctx.beginPath();ctx.arc(bp.x,bp.y,bp.r*0.55+gl*10,0,7);
    ctx.lineWidth=3.5;ctx.strokeStyle=bp.col;ctx.globalAlpha=0.7+gl*0.3;ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle=bp.col;ctx.font="900 24px 'Segoe UI'";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(superBumperT>0?"★":"◈",bp.x,bp.y+1);
    ctx.restore();
  }

  /* ---- posts ---- */
  ctx.save();ctx.fillStyle=WH;ctx.fill(P_POSTS);ctx.restore();

  /* ---- flippers ---- */
  for(const f of flippers){
    if(!vis(f.px,f.py,420))continue;
    const col=f.main?YL:(DECKS[f.deck]||DECKS[0]).col;
    glowStroke(()=>{ctx.beginPath();ctx.moveTo(f.px,f.py);ctx.lineTo(tipX(f),tipY(f));},
      f.key?WH:col,f.main?26:23,f.key?24:13);
    ctx.save();
    ctx.beginPath();ctx.arc(f.px,f.py,10,0,7);
    ctx.fillStyle=WH;ctx.fill();ctx.restore();
  }

  /* ---- shards ---- */
  for(const sh of shards){
    if(!vis(sh.x,sh.y,120))continue;
    ctx.save();
    ctx.globalAlpha=clamp(sh.life/2,0,1);
    ctx.fillStyle=sh.col;
    ctx.translate(sh.x,sh.y);ctx.rotate(timeSec*5);
    ctx.beginPath();ctx.moveTo(0,-sh.r);ctx.lineTo(sh.r,0);ctx.lineTo(0,sh.r);ctx.lineTo(-sh.r,0);ctx.closePath();
    ctx.fill();ctx.restore();
  }

  /* ---- orbs ---- */
  for(const o of orbs){
    if(!vis(o.x,o.y,220))continue;
    const d=ORB_DEFS[o.kind];
    const pu=0.7+0.3*Math.sin(o.t*6);
    ctx.save();ctx.translate(o.x,o.y);
    ctx.globalAlpha=o.life<3?(0.35+0.65*Math.abs(Math.sin(o.t*10))):1;
    glowOn(d.col,26*pu);
    ctx.strokeStyle=d.col;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,o.r,0,7);ctx.stroke();
    ctx.rotate(o.t*2);
    ctx.setLineDash([9,9]);ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(0,0,o.r+11,0,7);ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle=d.col;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.font="900 24px 'Segoe UI'";ctx.fillText(d.icon,o.x,o.y+1);
    ctx.font="900 15px 'Segoe UI'";ctx.fillText(o.kind,o.x,o.y+o.r+24);
    ctx.restore();
  }

  /* ---- meteors ---- */
  for(const m of meteors){
    if(!vis(m.x,m.y,220))continue;
    ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.t*3);
    glowOn(OR,24);
    ctx.fillStyle="rgba(60,20,10,0.9)";ctx.strokeStyle=OR;ctx.lineWidth=5;
    ctx.beginPath();
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2,rr=m.r*(0.8+0.25*Math.sin(i*2.7));
      i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();
  }

  /* ---- drones ---- */
  for(const d of drones){
    if(!vis(d.x,d.y,200))continue;
    ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.t*6);
    glowOn(RD,18);
    ctx.strokeStyle=RD;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,d.r,0,7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-d.r,0);ctx.lineTo(d.r,0);ctx.moveTo(0,-d.r);ctx.lineTo(0,d.r);ctx.stroke();
    ctx.restore();
  }

  /* ---- wisp ---- */
  if(mission.active&&mission.data&&mission.data.wisp){
    const w=mission.data.wisp;
    ctx.save();ctx.translate(w.x,w.y);
    glowOn(GR,34);
    ctx.fillStyle=GR;ctx.globalAlpha=0.85;
    ctx.beginPath();ctx.arc(0,0,w.r*(0.8+0.2*Math.sin(timeSec*9)),0,7);ctx.fill();
    ctx.globalAlpha=1;ctx.fillStyle="#031";
    ctx.font="900 26px 'Segoe UI'";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("?",0,1);
    ctx.restore();
  }

  /* ---- BOSS ---- */
  if(boss.active)drawBoss();

  /* ---- balls ---- */
  for(const b of balls){
    if(b.gone)continue;
    const gcol=b.gold?YL:b.plasma>0?OR:b.phase>0?CY:b.ghost?MG:WH;
    for(let i=0;i<b.trail.length;i++){
      const t=b.trail[i];
      const al=(i/b.trail.length)*(b.gold?0.6:0.4)*(b.ghost?0.5:1);
      ctx.beginPath();ctx.arc(t.x,t.y,b.r*(0.35+i/b.trail.length*0.65),0,7);
      ctx.fillStyle=b.gold?`rgba(255,233,59,${al})`:b.plasma>0?`rgba(255,154,31,${al})`:
        frenzyT>0?`rgba(255,43,214,${al})`:`rgba(25,230,255,${al})`;
      ctx.fill();
    }
    ctx.save();
    if(quality>0.45){ctx.shadowColor=gcol;ctx.shadowBlur=(b.gold?34:22)*GLOW;}
    ctx.globalAlpha=b.ghost?0.55:1;
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*(b.heavy>0?1.25:1),0,7);
    const bg2=ctx.createRadialGradient(b.x-6,b.y-7,2,b.x,b.y,b.r*1.2);
    if(b.gold){bg2.addColorStop(0,"#fff");bg2.addColorStop(0.5,"#ffe93b");bg2.addColorStop(1,"#ff9a1f");}
    else if(b.plasma>0){bg2.addColorStop(0,"#fff");bg2.addColorStop(0.45,"#ffd27a");bg2.addColorStop(1,"#ff5a00");}
    else if(b.ghost){bg2.addColorStop(0,"#fff");bg2.addColorStop(1,"#ff2bd6");}
    else{bg2.addColorStop(0,"#fff");bg2.addColorStop(0.65,"#dff4ff");bg2.addColorStop(1,"#7fc9ff");}
    ctx.fillStyle=bg2;ctx.fill();
    if(b.shield){
      ctx.globalAlpha=0.8;ctx.strokeStyle=GR;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r+11+Math.sin(timeSec*8)*3,0,7);ctx.stroke();
    }
    if(b.phase>0){
      ctx.globalAlpha=0.6;ctx.strokeStyle=CY;ctx.lineWidth=2.5;ctx.setLineDash([8,8]);
      ctx.beginPath();ctx.arc(b.x,b.y,b.r+15,0,7);ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- rings / particles / floats ---- */
  for(const r of rings){
    if(!vis(r.x,r.y,r.r+200))continue;
    ctx.save();
    ctx.globalAlpha=clamp(r.life/r.max,0,1);
    ctx.strokeStyle=r.col;
    ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);
    ctx.globalAlpha*=0.34;ctx.lineWidth=r.w*3;ctx.stroke();
    ctx.globalAlpha=clamp(r.life/r.max,0,1);ctx.lineWidth=r.w;ctx.stroke();
    ctx.restore();
  }
  for(const p of parts){
    if(!vis(p.x,p.y,60))continue;
    ctx.globalAlpha=clamp(p.life/p.max,0,1);
    ctx.fillStyle=p.col;
    ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
  ctx.globalAlpha=1;
  for(const f of floats){
    if(!vis(f.x,f.y,220))continue;
    ctx.save();
    ctx.globalAlpha=clamp(f.life,0,1);
    ctx.font=`900 ${f.size}px "Segoe UI",sans-serif`;
    ctx.textAlign="center";
    ctx.fillStyle="rgba(0,0,0,0.55)";
    ctx.fillText(f.text,f.x+2,f.y+2);
    ctx.fillStyle=f.col;
    ctx.fillText(f.text,f.x,f.y);
    ctx.restore();
  }

  /* ---- lightning bolts ---- */
  for(const bo of bolts){
    const a=1-bo.t/bo.life;
    ctx.save();
    ctx.globalAlpha=a*(bo.soft?0.5:1);
    ctx.strokeStyle=IC;ctx.lineWidth=bo.soft?4:9;
    glowOn(IC,34);
    ctx.beginPath();
    let x=bo.x,y=bo.y0,i=0;
    ctx.moveTo(x,y);
    while(y<bo.y1){
      y+=90;i++;
      x+=Math.sin(bo.seed+i*2.7)*70;
      ctx.lineTo(x,y);
    }
    ctx.stroke();ctx.restore();
  }

  /* ---- blackout mask ---- */
  if(mission.active&&mission.id==="blackout"){
    const f=focusBall();
    if(f){
      const p=w2s(f.x,f.y);
      setScreenTransform();
      const rr=Math.max(VW,VH)*(0.10+mission.data.vis*0.5);
      const gm=ctx.createRadialGradient(p.x,p.y,rr*0.25,p.x,p.y,rr);
      gm.addColorStop(0,"rgba(0,0,0,0)");
      gm.addColorStop(0.7,"rgba(0,0,0,0.7)");
      gm.addColorStop(1,"rgba(0,0,0,0.97)");
      ctx.fillStyle=gm;ctx.fillRect(0,0,VW,VH);
      setWorldTransform();
    }
  }

  setScreenTransform();
  ctx.restore();                       // release the play-window clip

  /* edge of the play window, so the controls read as an apron rather than a crop */
  if(clipBotH()>24){
    const by=VH-clipBotH();
    const g2=ctx.createLinearGradient(0,by-16,0,by+2);
    g2.addColorStop(0,"rgba(2,4,20,0)");g2.addColorStop(1,"rgba(2,4,20,0.85)");
    ctx.fillStyle=g2;ctx.fillRect(0,by-16,VW,18);
    ctx.fillStyle="rgba(25,230,255,0.16)";ctx.fillRect(0,by,VW,1);
  }else if(IS_TOUCH){
    /* the table runs on under the floating pads — sink it into shadow there so
       the buttons stay readable over whatever happens to be behind them */
    const fh=isShort()?74:104, fy=VH-fh;
    const g2=ctx.createLinearGradient(0,fy,0,VH);
    g2.addColorStop(0,"rgba(2,4,20,0)");g2.addColorStop(1,"rgba(2,4,20,0.78)");
    ctx.fillStyle=g2;ctx.fillRect(0,fy,VW,fh);
  }

  /* ---- the warp itself ----
     The room does not cross-fade, it collapses: everything rushes toward the
     hole, the screen goes to the destination's colour, then it blows back out
     around the new machine. Drawn last so it covers the HUD too. */
  if(warpT>0){
    const dur=warpDir===2?0.42:0.5;
    const k=clamp(1-warpT/dur,0,1);
    const closing=warpDir!==2;
    const a=closing?k:1-k;
    const col=(warpTo&&LEVELS[warpTo])||level||{col:CY,col2:WH};
    const cx=VW/2, cy=playTop()+playH()/2, R=Math.hypot(VW,VH);
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate((closing?1:-1)*k*3.4);
    ctx.lineCap="round";
    const N=Math.round(26*clamp(quality,0.4,1))+10;
    for(let i=0;i<N;i++){
      const ang=i/N*Math.PI*2;
      const r0=R*(closing?(1-k):k)*0.5, r1=r0+R*0.55*a;
      ctx.strokeStyle=i%2?col.col:(col.col2||WH);
      ctx.globalAlpha=0.5*a;
      ctx.lineWidth=3+22*a;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang)*r0,Math.sin(ang)*r0);
      ctx.lineTo(Math.cos(ang)*r1,Math.sin(ang)*r1);
      ctx.stroke();
    }
    ctx.restore();
    const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.62);
    gg.addColorStop(0,`rgba(255,255,255,${a*0.95})`);
    gg.addColorStop(0.35,`${col.col}`);
    gg.addColorStop(1,"rgba(2,1,10,0)");
    ctx.globalAlpha=a*0.85;
    ctx.fillStyle=gg;ctx.fillRect(0,0,VW,VH);
    ctx.globalAlpha=1;
  }

  /* ---- full-screen tints ---- */
  if(frenzyT>0){
    ctx.fillStyle=`rgba(255,43,214,${0.06+0.04*Math.sin(timeSec*24)})`;ctx.fillRect(0,0,VW,VH);
  }
  if(wizard.active){
    ctx.fillStyle=`rgba(255,233,59,${0.05+0.04*Math.sin(timeSec*10)})`;ctx.fillRect(0,0,VW,VH);
  }
  if(ballSaveT>0){
    ctx.strokeStyle=`rgba(57,255,106,${0.35+0.3*Math.sin(timeSec*8)})`;
    ctx.lineWidth=5;ctx.strokeRect(3,3,VW-6,VH-6);
  }
  if(surgeT>0){
    ctx.strokeStyle=`rgba(57,255,106,${0.5+0.4*Math.sin(timeSec*18)})`;
    ctx.lineWidth=3;ctx.strokeRect(10,10,VW-20,VH-20);
  }
  if(flashA>0.01){
    ctx.globalAlpha=Math.min(1,flashA);ctx.fillStyle=flashCol;ctx.fillRect(0,0,VW,VH);ctx.globalAlpha=1;
  }
  if(tilted){
    ctx.fillStyle="rgba(255,51,85,0.13)";ctx.fillRect(0,0,VW,VH);
  }
}

/* ---------- the Storm King ---------- */
function drawBoss(){
  const x=boss.x,y=boss.y;
  const hurt=boss.angry;
  const sc=1+Math.sin(boss.t*2.2)*0.03+hurt*0.06;
  ctx.save();
  ctx.translate(x+rand(-1,1)*hurt*10,y+rand(-1,1)*hurt*10);
  ctx.scale(sc,sc);
  // aura
  if(GLOW>0.1){ctx.shadowColor=hurt>0.2?WH:RD;ctx.shadowBlur=40*GLOW;}
  ctx.strokeStyle=hurt>0.2?WH:RD;ctx.lineWidth=8;
  for(let k=0;k<3;k++){
    ctx.save();ctx.rotate(boss.t*(0.6+k*0.5)*(k%2?-1:1));
    ctx.globalAlpha=0.55-k*0.14;
    ctx.setLineDash([40,26]);
    ctx.beginPath();ctx.arc(0,0,150-k*26,0,7);ctx.stroke();
    ctx.restore();
  }
  // body
  ctx.setLineDash([]);
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2+boss.t*0.25,rr=118+Math.sin(boss.t*3+i)*8;
    i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath();
  ctx.fillStyle="rgba(24,4,16,0.94)";ctx.fill();
  ctx.strokeStyle=hurt>0.2?WH:RD;ctx.lineWidth=7;ctx.stroke();
  // crown spikes
  ctx.strokeStyle=YL;ctx.lineWidth=8;
  if(GLOW>0.1)ctx.shadowColor=YL;
  ctx.beginPath();
  for(let i=-2;i<=2;i++){
    const bx=i*46;
    ctx.moveTo(bx-20,-96);ctx.lineTo(bx,-96-40-Math.abs(i)*-10);ctx.lineTo(bx+20,-96);
  }
  ctx.stroke();
  // eyes
  ctx.shadowBlur=0;
  const eo=Math.sin(boss.eye*2.4)*10;
  [-42,42].forEach(ex=>{
    ctx.fillStyle=hurt>0.2?WH:IC;
    if(GLOW>0.1){ctx.shadowColor=IC;ctx.shadowBlur=24*GLOW;}
    ctx.beginPath();ctx.ellipse(ex+eo*0.3,-6,20,13,0,0,7);ctx.fill();
    ctx.fillStyle="#200";
    ctx.beginPath();ctx.arc(ex+eo,-6,7,0,7);ctx.fill();
  });
  // mouth
  ctx.shadowBlur=0;
  ctx.strokeStyle=RD;ctx.lineWidth=6;
  ctx.beginPath();
  for(let i=0;i<=8;i++){
    const px=-56+i*14, py=54+(i%2?12:-4);
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.stroke();
  ctx.restore();
  // hp bar
  const bw=460,bx=x-bw/2,by=y-215;
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,0.62)";ctx.fillRect(bx-6,by-6,bw+12,34);
  ctx.fillStyle="rgba(255,255,255,0.12)";ctx.fillRect(bx,by,bw,22);
  const hp=clamp(boss.hp/boss.maxhp,0,1);
  const hg=ctx.createLinearGradient(bx,0,bx+bw,0);
  hg.addColorStop(0,RD);hg.addColorStop(1,OR);
  ctx.fillStyle=hg;ctx.fillRect(bx,by,bw*hp,22);
  ctx.strokeStyle=RD;ctx.lineWidth=2;ctx.strokeRect(bx,by,bw,22);
  ctx.fillStyle=WH;ctx.font="900 20px 'Segoe UI'";ctx.textAlign="center";
  ctx.fillText("THE STORM KING   "+Math.max(0,boss.hp)+" / "+boss.maxhp,x,by-14);
  ctx.restore();
}
