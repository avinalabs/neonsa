/* ============================================================
   p5 :: GAME LOGIC — scoring, events, missions, boss, toys
   ============================================================ */

/* ---------- fx helpers ---------- */
function spark(x,y,n,col,pw){
  n=Math.round(n*quality);
  if(parts.length>460)n=Math.min(n,3);
  for(let i=0;i<n;i++){
    const a=rand(0,Math.PI*2),v=rand(80,pw||420);
    parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-90,life:rand(.3,.85),max:.85,col,size:rand(2,5)});
  }
}
function ring(x,y,col,r0,r1,w){rings.push({x,y,r:r0||6,r1:r1||120,life:.45,max:.45,col,w:w||4});}
function floatText(x,y,text,col,size){floats.push({x,y,text,col,size:size||26,life:1,max:1,vy:-90});}
function announce(text,col,big){announceQ.push({text,col:col||YL,big:!!big,t:0});}
function toast(text,col,icon){toasts.push({text,col:col||CY,icon:icon||"★",t:0,life:3.4});}
function shake(m){shakeMag=Math.min(34,shakeMag+m);}
function flash(a,col){flashA=Math.max(flashA,Math.min(a,0.6));flashCol=col||WH;}
function camPunch(v){cam.kick=Math.min(1,cam.kick+v);}
function feedChain(p){chain=(imul(chain^(p|0),2654435761)+0x9e3779b9)>>>0;}

/* ---------- scoring ---------- */
function altAt(y){return DECKS[deckAt(y).id].mult;}
function comboTier(){return 1+Math.min(5,Math.floor(combo/8));}
function totalMult(y){
  const alt=(y===undefined)?1:altAt(y);
  let m=mult*alt*comboTier();
  if(frenzyT>0)m*=3;
  if(goldT>0)m*=2;
  if(surgeT>0)m*=2;
  m*=mission.scoreMul;
  return Math.min(m,600);
}
function addScore(base,x,y,opts){
  opts=opts||{};
  base=Math.round(base);
  if(!isFinite(base)||base<=0)return 0;
  if(base>4e7)cheatFlag=true;
  const pts=Math.round(base*totalMult(y));
  score+=pts;feedChain(pts);
  scoreWindowPts+=pts;
  if(!opts.noCombo){combo++;comboT=3.4;if(combo>maxCombo)maxCombo=combo;}
  lastScoreTime=timeSec;
  bonusBank+=Math.min(base,9000)/28;
  stormMeter=clamp(stormMeter+base/260000*0.3,0,1);
  if(x!==undefined&&!opts.quiet)floatText(x,y,"+"+shortNum(pts),opts.col||CY,opts.size||26);
  mission.pts+=pts;
  checkExtras();
  return pts;
}
function checkExtras(){
  if(score>=2.5e6&&!stats.ex1){stats.ex1=true;awardExtra();}
  if(score>=1.2e7&&!stats.ex2){stats.ex2=true;awardExtra();}
  if(score>=4e7&&!stats.ex3){stats.ex3=true;awardExtra();}
}
/* Extras used to be unlimited from three sources at once — the score
   thresholds, the mystery award and the storm-meter lightning — and a good
   game banked them faster than it spent them, so the ball count never reached
   zero and the game could not be lost. Two caps now: how many you can hold at
   once, and how many a single game can hand out at all. Past either one the
   award pays points instead, so it is still worth hitting. Ceiling on a game
   is therefore BALLS_PER_GAME + MAX_EXTRA_GAME balls, and it always ends. */
const MAX_EXTRA=3;          // held at once
const MAX_EXTRA_GAME=5;     // granted over a whole game
let extrasEarned=0, awardingExtra=false;
function awardExtra(){
  if(extraBalls>=MAX_EXTRA||extrasEarned>=MAX_EXTRA_GAME){
    if(awardingExtra)return;           // addScore re-enters via checkExtras
    awardingExtra=true;
    const p=addScore(400000,830,1200,{col:GR,size:32});
    announce((extrasEarned>=MAX_EXTRA_GAME?"NO MORE EXTRAS":"EXTRA BALLS FULL")+
             "  +"+shortNum(p),GR,true);
    SND.extra();
    awardingExtra=false;
    return;
  }
  extraBalls++;extrasEarned++;
  announce("EXTRA BALL!",GR,true);flash(.5,GR);SND.extra();
  const f=focusBall();if(f)ring(f.x,f.y,GR,20,300);
}
function addSurge(v){
  if(surgeT>0)return;
  surge=clamp(surge+v,0,1);
  if(surge>=1){
    surge=0;surgeT=14;
    announce("SURGE! FLIPPERS OVERCLOCKED",GR,true);
    SND.mbStart();flash(.6,GR);shake(14);camPunch(.5);
  }
}
function addStorm(v){
  stormMeter=clamp(stormMeter+v,0,1);
  if(stormMeter>=1){stormMeter=0;lightningAward();}
}

/* ---------- switch bus (missions listen here) ---------- */
function sw(kind,x,y,b){
  /* Missions and the boss belong to the tower. Down a warp hole they are
     frozen, so a switch hit here must not feed them either. */
  if(!level){
    mission.onSwitch&&mission.onSwitch(kind,x,y,b);
    if(boss.active)boss.onSwitch&&boss.onSwitch(kind,x,y,b);
  }
  excite=clamp(excite+0.028,0,1);
}
/* light/darken a named tower scoop, safely — it is simply absent in a level */
function litScoop(name,on){const s=scoopBy(name);if(s)s.lit=on;return s;}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */
function onBumper(bp,b){
  bp.fx=1;
  const base=superBumperT>0?4200:520;
  addScore(base,bp.x,bp.y-bp.r-16,{col:bp.col,quiet:true});
  floatText(bp.x,bp.y-bp.r-18,"+"+shortNum(base*totalMult(bp.y)),bp.col,superBumperT>0?30:20);
  SND.bumper(combo%8);
  spark(b.x,b.y,10,bp.col,420);
  ring(bp.x,bp.y,bp.col,bp.r,bp.r+50,3);
  shake(2.4);addSurge(0.012);addStorm(0.012);
  if(Math.random()<0.22)dropShard(bp.x,bp.y,bp.col);
  sw("bumper",bp.x,bp.y,b);
}
function onSling(s,x,y){
  s.fx=1;
  const base=260;
  addScore(base,x,y,{col:MG,quiet:true});
  floatText(x,y-20,"+"+shortNum(base*totalMult(y)),MG,18);
  SND.sling();spark(x,y,9,MG,320);shake(2);addSurge(0.008);
  sw("sling",x,y);
}
function onBrick(br,b){
  br.alive=false;stats.bricks++;
  const base=900+br.row*450;
  addScore(base,br.x+br.w/2,br.y,{col:br.col,quiet:true});
  floatText(br.x+br.w/2,br.y,"+"+shortNum(base*totalMult(br.y)),br.col,18);
  SND.brick(br.col_);
  spark(br.x+br.w/2,br.y+br.h/2,12,br.col,340);
  for(let i=0;i<2;i++)dropShard(br.x+br.w/2,br.y+br.h/2,br.col);
  shake(1.6);addSurge(0.02);addStorm(0.014);
  sw("brick",br.x,br.y,b);
  const left=bricks.filter(x=>x.alive).length;
  if(left===0){
    addScore(180000,400,1400,{col:YL,size:40});
    announce("SMELTER CLEARED!",OR,true);
    SND.missionWin();flash(.7,OR);shake(18);camPunch(.6);
    brickResetT=6;
    unlock("demolition","SMELTER CLEARED","Broke every brick in one ball");
  }else if(left===8){announce("WALL CRUMBLING!",OR,false);}
}
let brickResetT=0;
function onDropTarget(bank,t,b){
  t.up=false;t.fx=1;
  const base=bank.type==="chaos"?2400:1600;
  addScore(base,t.cx,t.cy,{col:RD});
  SND.target();spark(t.cx,t.cy,14,RD,380);
  dropShard(t.cx,t.cy,RD);
  addSurge(0.018);addStorm(0.016);
  sw("drop",t.cx,t.cy,b);
  if(bank.type==="chaos"){
    chaosLetters[t.idx]=true;
    if(bank.targets.every(x=>!x.up)){
      chaosLetters=[false,false,false,false,false];
      startFrenzy();bank.resetT=1.5;
    }
  }else{
    if(bank.targets.every(x=>!x.up)){
      const p=addScore(45000,t.cx,t.cy-60,{col:GR,size:32});
      announce(bank.type.toUpperCase()+" BANK! +"+shortNum(p),GR,true);
      SND.bank();flash(.4,GR);
      if(bank.type==="cryo"){magnets.forEach(m=>{if(m.name==="FORGE")m.lit=true;});announce("FORGE MAGNET LIT",OR,false);}
      if(bank.type==="ion"){lockLit=true;litScoop("LOCK",true);announce("BALL LOCK LIT!",PU,true);SND.lock();}
      bank.resetT=2;
    }
  }
}
function onRollover(r,b){
  SND.roll();ring(r.x,r.y,r.group==="crown"?YL:CY,8,60,3);
  if(level){
    /* down here a rollover is whatever the room says it is */
    if(r.pearl&&!r.lit){
      r.lit=true;
      addScore(18000,r.x,r.y,{col:GR,size:22});
      SND.deepPop();
      const n=pearls.filter(q=>q.lit).length;
      floatText(r.x,r.y-40,"PEARL "+n+"/"+pearls.length,GR,22);
      levelScore();
      if(n===pearls.length)announce("ALL PEARLS — NOW FEED THE MAW",GR,true);
    }else{
      addScore(6000*level.mult,r.x,r.y,{col:level.col2,size:20});
      if(!r.lit){r.lit=true;
        if(rollovers.filter(q=>!q.pearl).every(q=>q.lit)){
          rollovers.forEach(q=>{if(!q.pearl)q.lit=false;});
          const p=addScore(140000,r.x,r.y-50,{col:YL,size:30});
          announce("LANES CLEARED  +"+shortNum(p),YL,true);SND.bank();
        }
      }
    }
    addSurge(0.01);
    sw("rollover",r.x,r.y,b);
    return;
  }
  if(r.group==="crown"){
    const p=addScore(9000,r.x,r.y,{col:YL,size:24});
    const rod=scoopBy("ROD");
    if(rod&&!rod.lit){rod.lit=true;floatText(r.x,r.y-34,"ROD LIT",IC,22);}
    addStorm(0.06);
  }else if(r.group==="storm"){
    if(!stormLetters[r.id]){
      stormLetters[r.id]=true;
      addScore(1400,r.x,r.y,{col:CY});
      if(stormLetters.every(v=>v)){
        stormLetters=[false,false,false,false,false];
        mult=Math.min(10,mult+1);
        stats.maxMult=Math.max(stats.maxMult,mult);
        addScore(30000,r.x,r.y-60,{col:YL,size:34});
        announce("S-T-O-R-M!  MULTIPLIER x"+mult,YL,true);
        SND.bank();flash(.6,YL);shake(12);camPunch(.4);
        kickLit=[true,true];addStorm(0.35);
      }
    }else addScore(500,r.x,r.y,{col:CY,quiet:true});
  }
  addSurge(0.01);
  sw("rollover",r.x,r.y,b);
}
function onInlane(l,b){
  SND.roll();
  addScore(l.minor?2600:1400,l.x,l.y,{col:GR,quiet:true});
  if(l.deck===0&&!kickLit[l.id]){
    kickLit[l.id]=true;floatText(l.x,l.y-30,"KICKBACK LIT",GR,22);
  }else{
    floatText(l.x,l.y-30,"+"+shortNum((l.minor?2600:1400)*totalMult(l.y)),GR,20);
    if(l.minor)addSurge(0.02);
  }
  sw("inlane",l.x,l.y,b);
}
function onSpinner(s,b){
  s.hot=1;
  sw("spinner",s.x,s.y,b);
}
function onKickback(k,b){
  if(kickLit[k.side]&&!tilted){
    kickLit[k.side]=false;stats.saves++;
    announce("KICKBACK!",GR,true);
    SND.launch(1);SND.save();flash(.45,GR);shake(12);camPunch(.4);
    ring(k.x,k.y,GR,10,180);spark(k.x,k.y,28,GR,520);
    b.vx=(k.side===0?1:-1)*rand(60,220);
    b.vy=-rand(2400,2800);
    addScore(6000,k.x,k.y,{col:GR});
  }
}
function onRailEnter(b,R){
  R.hits++;stats.rails++;
  SND.rail();
  announce(R.name+"!",R.col,false);
  ring(R.mouth.x,R.mouth.y,R.col,16,150);
  addScore(R.name==="GRAND ORBIT"?24000:12000,R.mouth.x,R.mouth.y,{col:R.col,size:28});
  addSurge(0.05);addStorm(0.05);
  camPunch(.35);
  sw("rail",R.mouth.x,R.mouth.y,b);
  if(stats.rails===10)unlock("railrider","RAIL RIDER","Rode 10 habitrails in one game");
}
/* the rattle of a ramp you did not make */
function onRailReject(b,R,sp,dot){
  if(timeSec-(R.rejT||-9)<0.75)return;      // once per approach, not per substep
  R.rejT=timeSec;R.miss=1;
  SND.railMiss();
  const why=sp<R.minSpd?"TOO SLOW":"WRONG ANGLE";
  floatText(R.mouth.x,R.mouth.y-R.mouth.r-14,why,"#93a8c8",21);
  spark(R.mouth.x,R.mouth.y,6,"#93a8c8",180);
}
function onRailExit(b,R){
  SND.railEnd();
  spark(b.x,b.y,18,R.col,420);
  if(R.name==="THE PLUNGE"){
    const p=addScore(90000,b.x,b.y,{col:RD,size:34});
    announce("THE PLUNGE! +"+shortNum(p),RD,true);
    flash(.4,RD);
  }
}
function onLaneExit(b,deck){
  if(skillArmed){
    skillArmed=false;
    if(deck===skillDeck){
      const p=addScore(120000,b.x,b.y,{col:YL,size:38});
      announce("SKILL SHOT!  "+DECKS[deck].name,YL,true);
      SND.skill();flash(.6,YL);shake(14);camPunch(.6);
      ring(b.x,b.y,YL,20,320);
      addStorm(0.3);
      unlock("sharpshooter","SHARPSHOOTER","Nailed the skill shot");
    }else{
      addScore(6000,b.x,b.y,{col:CY,size:24});
    }
  }
  if(deck>=3)announce("ENTERING "+DECKS[deck].name,DECKS[deck].col,false);
}
function onPortal(b,p){
  stats.portals++;
  addScore(9000,b.x,b.y,{col:p.col,size:26});
  announce(p.name,p.col,false);
  addSurge(0.03);
  sw("portal",b.x,b.y,b);
}
function onDeckChange(b,now,before){
  if(level)return;                    // the warp rooms are a single floor
  visited[now]=true;
  if(now>before){
    SND.deckUp();
    if(now>peakDeck){
      peakDeck=now;stats.maxAlt=Math.max(stats.maxAlt,now);
      announce(DECKS[now].name+"  x"+DECKS[now].mult,DECKS[now].col,true);
      flash(.22,DECKS[now].col);
      addScore(9000*now,b.x,b.y,{col:DECKS[now].col,size:26});
      if(now===4)unlock("summit","SUMMIT","Reached The Crown");
    }else{
      floatText(b.x,b.y-46,DECKS[now].name+" x"+DECKS[now].mult,DECKS[now].col,22);
    }
    musicKey=now;
  }else{
    SND.deckDown();
    musicKey=now;
    if(before>=3)floatText(b.x,b.y-46,"FALLING",RD,22);
  }
  if(visited.every(v=>v))unlock("tourist","GRAND TOUR","Visited all five decks in one ball");
}

/* ---------- scoops ---------- */
function onScoop(s,b){
  SND.lock();
  ring(s.x,s.y,s.col,12,110);
  if(s.kind==="mystery"){b.hold=0.8;s.pending="mystery";}
  else if(s.kind==="lock"){s.pending="lock";b.hold=0.7;}
  else if(s.kind==="mission"){s.pending="mission";b.hold=1.0;}
  else if(s.kind==="vent"){s.pending="vent";b.hold=0.6;}
  else if(s.kind==="cannon"){s.pending="cannon";b.hold=99;cannonLoad(b);}
  else if(s.kind==="crown"){s.pending="crown";b.hold=0.8;}
  else if(s.kind==="rod"){s.pending="rod";b.hold=0.9;}
}
/* Throw the ball out of a hole toward wherever there is actually room. Firing
   straight up out of the warp gates meant bouncing off the deck floor above
   and dropping straight back in, over and over — the ball looked welded to the
   gate. Aiming at open table ends that whole class of loop. */
function ejectClear(s,eject,lo,hi){
  const a=clearestDir(s.x,s.y)+rand(-0.22,0.22);
  const spd=rand(lo,hi);
  eject(Math.cos(a)*spd,Math.sin(a)*spd);
}
function resolveScoop(b){
  const s=b.scoop;
  b.scoop=null;
  let kicked=false;
  const eject=(vx,vy)=>{b.x=s.x;b.y=s.y-10;b.vx=vx;b.vy=vy;b.trail.length=0;kicked=true;};
  try{ resolveScoopInner(b,s,eject); }
  finally{
    /* Whatever the case above decided, a ball that is out of the scoop and
       still motionless is sitting on top of the thing that just released it,
       and will be swallowed again on the next cooldown. */
    if(!kicked&&!b.scoop&&!b.rail&&warpT<=0&&Math.hypot(b.vx,b.vy)<40)
      eject(rand(-300,300),-rand(1500,1900));
  }
}
function resolveScoopInner(b,s,eject){
  switch(s.kind){
    case "mystery": triggerMystery(s,b); eject(rand(-260,260),-rand(1900,2400)); break;
    case "lock":    doLock(s,b,eject); break;
    case "mission": openMissionPicker(s,b); eject(rand(-320,320),-rand(1700,2200)); break;
    case "vent":    doVent(s,b); eject(rand(-260,260),-rand(1800,2300)); break;
    case "crown":   doCrown(s,b); eject(rand(-380,380),rand(700,1100)); break;
    case "rod":     doRod(s,b);   eject(rand(-420,420),rand(800,1200)); break;
    /* If the warp actually starts, the world leaves and the ball goes with it.
       If it does not — a cold gate, or a warp already running — the ball MUST
       still be kicked out. Returning here without an eject dropped it at the
       gate with no velocity, where it settled, was captured again, and cycled
       forever: a dead game that looked like a stuck ball. */
    /* A cold gate throws the ball back toward the middle of the table, not
       straight up: straight up meant bouncing off the deck floor 300px above
       and dropping right back into the hole, over and over, which is what a
       player sees as a ball stuck on the gate. The gate also stays shut for
       three seconds so a returning ball is not swallowed on the way past. */
    case "warp":    if(!doWarp(s,b)){
                      s.cool=Math.max(s.cool,3);
                      ejectClear(s,eject,2000,2500);
                    }
                    return;
    case "eye":     levelScore(); eject(rand(-520,520),rand(-1500,-900)); break;
    case "vent2":   doForgeVent(b); eject(rand(-420,420),rand(900,1300)); break;
    case "maw":     doMaw(s,b);   eject(rand(-300,300),rand(700,1000)); break;
    default:        ejectClear(s,eject,1700,2100);
  }
}

/* ---------- the warp holes ---------- */
/* returns true only if the room is actually taking you */
function doWarp(s,b){
  if(!warpAvailable(s.level)){
    /* dark gate: still worth something, just not a ride */
    const p=addScore(24000,s.x,s.y,{col:"#6d7b96",size:22});
    announce("GATE COLD  "+Math.ceil(Math.max(gateCool[s.level],0))+"s",IC,false);
    floatText(s.x,s.y-50,"+"+shortNum(p),IC,20);
    return false;
  }
  addScore(60000,s.x,s.y,{col:LEVELS[s.level].col,size:28});
  warpBegin(s.level,s.name);
  return true;
}
/* the FORGE vent also drives the lava back down the shaft */
function doForgeVent(b){
  lavaTarget=Math.min(PH+120,lavaTarget+PH*0.30);
  SND.forgeHit();shake(10);
  for(let i=0;i<14;i++)parts.push({x:PW/2+rand(-70,70),y:200,vx:rand(-300,300),
    vy:rand(200,700),life:rand(.3,.8),max:.8,col:Math.random()<.5?OR:YL,size:rand(2,6)});
  levelScore();
}
/* the DEEP's maw pays for whatever pearls you are carrying */
/* the maw does not advance the objective — it BUYS the pearls off you, and
   puts them back in the water so the room can pay out more than once */
function doMaw(s,b){
  const got=pearls.filter(p=>p.lit).length;
  if(got===0){announce("BRING ME PEARLS",IC,false);return;}
  const p=addScore(42000*got*got,s.x,s.y,{col:GR,size:26+got*3});
  announce("SWALLOWED "+got+" PEARLS  +"+shortNum(p),GR,true);
  SND.deepPearl();flash(0.3,GR);
  pearls.forEach(q=>{q.lit=false;});
}

/* ---------- mystery ---------- */
const MYSTERY=[
  {w:14,f:(s)=>{const p=addScore(70000,s.x,s.y,{col:PU,size:32});announce("MYSTERY +"+shortNum(p),PU,true);}},
  {w:10,f:(s)=>{superBumperT=12;announce("SUPER BUMPERS!",OR,true);}},
  {w:10,f:(s)=>{addStorm(0.55);announce("STORM SURGE!",CY,true);}},
  {w:8, f:(s)=>{if(!mbActive)startMB(1);else{const p=addScore(120000,s.x,s.y,{col:YL,size:32});announce("+"+shortNum(p),YL,true);}}},
  {w:6, f:(s)=>{awardExtra();}},
  {w:10,f:(s)=>{spawnOrb(s.x,s.y-90,pick(["PLASMA","PHASE","SHIELD","HEAVY"]));announce("POWER ORB!",GR,true);}},
  {w:8, f:(s)=>{mult=Math.min(10,mult+1);announce("MULTIPLIER x"+mult,YL,true);}},
  {w:8, f:(s)=>{kickLit=[true,true];ballSaveT=Math.max(ballSaveT,10);announce("KICKBACKS + BALL SAVE",GR,true);}},
  {w:6, f:(s)=>{surge=1;addSurge(0.01);announce("INSTANT SURGE!",GR,true);}},
  {w:5, f:(s)=>{const p=addScore(260000,s.x,s.y,{col:YL,size:40});announce("MEGA MYSTERY +"+shortNum(p),YL,true);flash(.6,YL);}},
  {w:5, f:(s)=>{lockLit=true;litScoop("LOCK",true);announce("LOCK LIT!",PU,true);}},
  {w:4, f:(s)=>{frenzyT=Math.max(frenzyT,12);announce("INSTANT CHAOS!",MG,true);}}
];
function triggerMystery(s,b){
  stats.mystery++;SND.mystery();flash(.35,PU);
  const tot=MYSTERY.reduce((a,m)=>a+m.w,0);
  let r=Math.random()*tot;
  for(const m of MYSTERY){r-=m.w;if(r<=0){m.f(s,b);break;}}
  if(stats.mystery>=6)unlock("gambler","GAMBLER","Six mystery awards in one game");
}

/* ---------- lock / multiball ---------- */
function doLock(s,b,eject){
  if(mbActive){
    const p=addScore(90000,s.x,s.y,{col:PU,size:30});
    announce("LOCK +"+shortNum(p),PU,true);eject(rand(-260,260),-rand(1800,2300));return;
  }
  if(lockLit){
    lockLit=false;s.lit=false;lockedBalls++;
    addScore(45000,s.x,s.y,{col:PU,size:30});
    announce("BALL "+lockedBalls+" LOCKED",PU,true);
    SND.lock();flash(.35,PU);
    if(lockedBalls>=2){
      lockedBalls=0;
      eject(rand(-200,200),-rand(1500,1900));
      setTimeout(()=>{if(state==="PLAY")startMB(2);},420);
    }else{
      litScoop("LOCK",false);
      eject(rand(-260,260),-rand(1800,2300));
    }
  }else{
    addScore(14000,s.x,s.y,{col:PU,size:24});
    floatText(s.x,s.y+50,"LOCK NOT LIT",PU,20);
    eject(rand(-260,260),-rand(1800,2300));
  }
}
function startMB(extra){
  mbActive=true;stats.mb++;mbJackpot++;
  ballSaveT=Math.max(ballSaveT,14);
  announce(extra>=4?"6-BALL ASCENSION!":"MULTIBALL!",MG,true);
  SND.mbStart();flash(.75,MG);shake(18);camPunch(.7);
  for(let i=0;i<extra;i++){
    setTimeout(()=>{
      if(state!=="PLAY")return;
      const b=spawnBall(830,2450,rand(-420,420),-rand(1500,2100));
      spark(b.x,b.y,20,MG,420);
    },i*220);
  }
  if(stats.mb>=3)unlock("juggler","JUGGLER","Three multiballs in one game");
}
function jackpotHit(x,y){
  const base=140000*mbJackpot;
  const p=addScore(base,x,y,{col:YL,size:40});
  announce("JACKPOT! +"+shortNum(p),YL,true);
  stats.jackpots++;SND.jackpot();flash(.7,YL);shake(16);camPunch(.6);
  ring(x,y,YL,14,300);spark(x,y,50,YL,620);
  addStorm(0.2);
  if(stats.jackpots>=8)unlock("jackpotter","JACKPOT MACHINE","Eight jackpots in one game");
}

/* ---------- crown scoop ---------- */
function doCrown(s,b){
  if(boss.active){bossDamage(3,s.x,s.y);return;}
  if(bossReady){startBoss();return;}
  if(mbActive){jackpotHit(s.x,s.y);return;}
  const p=addScore(120000,s.x,s.y,{col:YL,size:36});
  announce("CROWN AWARD +"+shortNum(p),YL,true);
  SND.superJack();flash(.5,YL);addStorm(0.3);
  crownHits++;
  if(crownHits%3===0){superBumperT=14;announce("SUPER BUMPERS!",OR,true);}
}
let crownHits=0;

/* ---------- lightning rod ---------- */
function doRod(s,b){
  litScoop("ROD",false);
  const p=addScore(150000,s.x,s.y,{col:IC,size:36});
  announce("LIGHTNING ROD! +"+shortNum(p),IC,true);
  bolts.push({x:s.x,y0:60,y1:PH,t:0,life:.55,seed:Math.random()*999});
  flash(.9,IC);shake(24);SND.thunder();camPunch(.7);
  addStorm(0.5);
  if(boss.active)bossDamage(2,s.x,s.y);
  unlock("rodwork","ROD WORK","Hit the lightning rod at the summit");
}

/* ---------- vent ---------- */
function doVent(s,b){
  if(mission.active&&mission.id==="overload"){mission.vent&&mission.vent();return;}
  const p=addScore(38000,s.x,s.y,{col:RD,size:28});
  announce("VENT +"+shortNum(p),RD,false);
  addStorm(0.14);
}

/* ---------- frenzy ---------- */
function startFrenzy(){
  frenzyT=18;stats.chaos++;
  addScore(90000,830,2100,{col:MG,size:40});
  announce("C-H-A-O-S FRENZY!  ALL x3",MG,true);
  SND.mbStart();flash(.8,MG);shake(18);camPunch(.7);
  for(let i=0;i<3;i++)setTimeout(()=>flash(.4,[CY,MG,YL][i]),i*220);
}

/* ---------- lightning ---------- */
function lightningAward(){
  const x=rand(200,1500);
  bolts.push({x,y0:60,y1:PH,t:0,life:.5,seed:Math.random()*999});
  flash(1,IC);shake(24);SND.thunder();camPunch(.8);
  const r=Math.random();
  if(r<0.32){
    const p=addScore(200000,830,900,{col:IC,size:40});
    announce("LIGHTNING! +"+shortNum(p),IC,true);
  }else if(r<0.5){superBumperT=14;announce("SUPER BUMPERS!",OR,true);}
  else if(r<0.68&&!mbActive){startMB(2);}
  else if(r<0.8){awardExtra();}
  else if(r<0.92){spawnOrb(rand(300,1400),rand(700,2200),pick(["PLASMA","SHIELD","HEAVY","PHASE"]));announce("LIGHTNING ORB!",IC,true);}
  else{mult=Math.min(10,mult+2);announce("DOUBLE MULTIPLIER x"+mult,YL,true);}
  unlock("stormcaller","STORM CALLER","Filled the storm meter");
}

/* ============================================================
   POWER ORBS
   ============================================================ */
const ORB_DEFS={
  PLASMA:{col:OR,icon:"✹",desc:"BURNING BALL"},
  PHASE: {col:CY,icon:"◎",desc:"PHASE THROUGH"},
  SHIELD:{col:GR,icon:"⛨",desc:"ONE FREE SAVE"},
  HEAVY: {col:MG,icon:"⬤",desc:"WRECKING BALL"},
  SPLIT: {col:PU,icon:"⚇",desc:"BALL SPLIT"},
  SLOW:  {col:IC,icon:"⌛",desc:"BULLET TIME"}
};
let orbTimer=13;
function spawnOrb(x,y,kind){
  kind=kind||pick(Object.keys(ORB_DEFS));
  orbs.push({x,y,kind,r:26,t:0,vx:rand(-30,30),vy:rand(-18,18),life:26});
}
function collectOrb(o,b){
  stats.orbs++;
  const d=ORB_DEFS[o.kind];
  SND.orb();flash(.3,d.col);ring(o.x,o.y,d.col,14,160);spark(o.x,o.y,24,d.col,420);
  addScore(20000,o.x,o.y,{col:d.col,size:28});
  announce(o.kind+" — "+d.desc,d.col,true);
  switch(o.kind){
    case "PLASMA": b.plasma=14;break;
    case "PHASE":  b.phase=11;break;
    case "SHIELD": b.shield=true;break;
    case "HEAVY":  b.heavy=13;break;
    case "SPLIT":  {const n=spawnBall(b.x,b.y,-b.vx*0.7+rand(-200,200),b.vy*0.7-500);n.trail.length=0;mbActive=mbActive||balls.length>1;break;}
    case "SLOW":   slowmoT=5.5;break;
  }
  if(stats.orbs>=5)unlock("collector","POWER COLLECTOR","Grabbed five power orbs");
}

/* ---------- shards ---------- */
function dropShard(x,y,col){
  if(shards.length>140)return;
  shards.push({x,y,vx:rand(-160,160),vy:-rand(60,240),col:col||CY,life:9,r:7});
}

/* ============================================================
   MISSIONS
   ============================================================ */
const mission={
  active:false,id:null,name:"",t:0,dur:0,goal:0,prog:0,scoreMul:1,pts:0,
  data:null,onSwitch:null,tick:null,draw:null,blurb:""
};
let missionsDone=0,bossReady=false,missionPicker=null;
const MISSION_LIST=[
  {id:"meteor", name:"METEOR SHOWER", col:OR, dur:32, goal:9,  blurb:"SMASH THE FALLING ROCKS"},
  {id:"blackout",name:"BLACKOUT",     col:PU, dur:28, goal:14, blurb:"THE LIGHTS ARE OUT — KEEP HITTING THINGS"},
  {id:"gravity",name:"GRAVITY FLUX",  col:CY, dur:30, goal:16, blurb:"DOWN IS A SUGGESTION"},
  {id:"hunt",   name:"THE HUNT",      col:GR, dur:34, goal:5,  blurb:"CATCH THE WISP"},
  {id:"overload",name:"OVERLOAD",     col:RD, dur:34, goal:3,  blurb:"COOL THE CORE AT THE VENT"},
  {id:"echo",   name:"ECHO CHAMBER",  col:MG, dur:30, goal:12, blurb:"YOUR GHOST SCORES TOO"},
  {id:"rush",   name:"RUSH HOUR",     col:YL, dur:20, goal:1,  blurb:"EVERYTHING PAYS TEN TIMES"}
];
let missionPool=MISSION_LIST.map(m=>m.id);

function openMissionPicker(s,b){
  if(mission.active){
    const p=addScore(50000,s.x,s.y,{col:GR,size:28});
    announce("MISSION BONUS +"+shortNum(p),GR,false);return;
  }
  if(bossReady){startBoss();return;}
  if(!missionPool.length)missionPool=MISSION_LIST.map(m=>m.id);
  const id=pick(missionPool);
  startMission(id);
}
function startMission(id){
  const def=MISSION_LIST.find(m=>m.id===id);
  missionPool=missionPool.filter(x=>x!==id);
  Object.assign(mission,{active:true,id,name:def.name,t:def.dur,dur:def.dur,goal:def.goal,prog:0,
    scoreMul:1,pts:0,data:{},blurb:def.blurb,col:def.col,onSwitch:null,tick:null});
  announce(def.name,def.col,true);
  toast(def.blurb,def.col,"▶");
  SND.missionStart();flash(.5,def.col);shake(12);camPunch(.5);
  ballSaveT=Math.max(ballSaveT,6);
  MISSION_SETUP[id]();
}
function endMission(win){
  if(!mission.active)return;
  const def=MISSION_LIST.find(m=>m.id===mission.id);
  if(win){
    missionsDone++;stats.missions++;
    const rew=Math.round(300000+mission.prog*40000+missionsDone*120000);
    score+=rew;feedChain(rew);
    announce(mission.name+" COMPLETE! +"+shortNum(rew),def.col,true);
    SND.missionWin();flash(.75,def.col);shake(20);camPunch(.8);
    toast("MISSION COMPLETE  +"+shortNum(rew),def.col,"✔");
    if(missionsDone===1)unlock("firstblood","MISSION ONE","Completed your first mission");
    if(missionsDone>=4&&!bossReady&&!boss.active&&!boss.dead){
      bossReady=true;
      litScoop("CROWN",true);
      announce("THE STORM KING AWAKENS",RD,true);
      toast("SHOOT THE CROWN — THE KING IS AWAKE",RD,"☠");
      SND.bossRoar();flash(.6,RD);
    }
  }else{
    announce(mission.name+" FAILED",RD,true);SND.drain();
  }
  // teardown
  meteors.length=0;
  if(mission.data&&mission.data.wisp)mission.data.wisp=null;
  if(mission.data&&mission.data.ghost){const g=balls.indexOf(mission.data.ghost);if(g>=0)balls.splice(g,1);}
  gravTarget=Math.PI/2;
  mission.active=false;mission.scoreMul=1;mission.id=null;mission.onSwitch=null;mission.tick=null;
  litScoop("MISSION",true);
  litScoop("VENT",false);
}

const MISSION_SETUP={
  meteor(){
    mission.data.spawn=0;
    mission.onSwitch=(k)=>{};
    mission.tick=(dt)=>{
      mission.data.spawn-=dt;
      if(mission.data.spawn<=0&&meteors.length<7){
        mission.data.spawn=rand(0.7,1.5);
        meteors.push({x:rand(180,1500),y:rand(80,220),vx:rand(-90,90),vy:rand(160,300),r:34,hp:1,t:0});
      }
    };
  },
  blackout(){
    mission.data.vis=1;
    mission.scoreMul=2.5;
    mission.onSwitch=()=>{mission.prog++;mission.data.vis=Math.min(1,mission.data.vis+0.34);
      if(mission.prog>=mission.goal)endMission(true);};
    mission.tick=(dt)=>{mission.data.vis=Math.max(0.14,mission.data.vis-dt*0.16);};
  },
  gravity(){
    mission.scoreMul=2;
    mission.onSwitch=()=>{mission.prog++;if(mission.prog>=mission.goal)endMission(true);};
    mission.tick=(dt)=>{gravTarget=Math.PI/2+Math.sin(timeSec*0.55)*0.95;};
  },
  hunt(){
    mission.data.wisp={x:830,y:1600,vx:400,vy:-260,r:34,t:0};
    mission.scoreMul=1.5;
    mission.tick=(dt)=>{
      const w=mission.data.wisp;if(!w)return;
      w.t+=dt;
      const f=focusBall();
      if(f){
        const d=dist(w.x,w.y,f.x,f.y);
        if(d<620){const a=Math.atan2(w.y-f.y,w.x-f.x);w.vx+=Math.cos(a)*1200*dt;w.vy+=Math.sin(a)*1200*dt;}
        if(d<w.r+f.r+10){
          mission.prog++;
          addScore(70000,w.x,w.y,{col:GR,size:32});
          announce("CAUGHT!  "+mission.prog+"/"+mission.goal,GR,false);
          SND.orb();spark(w.x,w.y,30,GR,520);ring(w.x,w.y,GR,12,200);
          w.x=rand(200,1450);w.y=rand(300,2300);w.vx=rand(-500,500);w.vy=rand(-500,500);
          if(mission.prog>=mission.goal)endMission(true);
        }
      }
      w.vx+=Math.sin(w.t*2.1)*260*dt;w.vy+=Math.cos(w.t*1.7)*260*dt;
      const s=Math.hypot(w.vx,w.vy);if(s>900){w.vx*=900/s;w.vy*=900/s;}
      w.x+=w.vx*dt;w.y+=w.vy*dt;
      if(w.x<120||w.x>PW-120)w.vx*=-1;
      if(w.y<120||w.y>PH-160)w.vy*=-1;
      w.x=clamp(w.x,120,PW-120);w.y=clamp(w.y,120,PH-160);
    };
  },
  overload(){
    mission.data.heat=0;
    litScoop("VENT",true);
    mission.scoreMul=2;
    mission.onSwitch=(k)=>{if(k==="bumper")mission.data.heat=Math.min(1,mission.data.heat+0.045);};
    mission.vent=()=>{
      mission.prog++;mission.data.heat=Math.max(0,mission.data.heat-0.55);
      const p=addScore(90000,1180,726,{col:GR,size:32});
      announce("CORE VENTED  "+mission.prog+"/"+mission.goal,GR,true);
      SND.missionWin();flash(.4,GR);
      if(mission.prog>=mission.goal)endMission(true);
    };
    mission.tick=(dt)=>{
      mission.data.heat=Math.min(1.0,mission.data.heat+dt*0.055);
      if(mission.data.heat>=1){flash(.6,RD);shake(16);endMission(false);}
    };
  },
  echo(){
    const f=focusBall();
    const g=spawnBall(f?PW-f.x:900,f?f.y:1600,0,0,{ghost:true});
    mission.data.ghost=g;
    mission.scoreMul=2;
    mission.onSwitch=()=>{mission.prog++;if(mission.prog>=mission.goal)endMission(true);};
    mission.tick=(dt)=>{
      const g2=mission.data.ghost;if(!g2)return;
      const f2=balls.find(b=>b!==g2&&!b.ghost);
      if(f2){g2.x=lerp(g2.x,PW-f2.x,1-Math.pow(0.02,dt));g2.y=lerp(g2.y,f2.y,1-Math.pow(0.02,dt));
        g2.vx=0;g2.vy=0;pushTrail(g2);}
    };
  },
  rush(){
    mission.scoreMul=10;
    mission.data.start=score;
    mission.tick=()=>{};
    mission.onSwitch=()=>{mission.prog++;};
  }
};
function missionTick(dt){
  if(!mission.active)return;
  mission.t-=dt;
  mission.tick&&mission.tick(dt);
  if(mission.t<=0){
    if(mission.id==="rush"||mission.id==="meteor"&&mission.prog>=mission.goal*0.6)endMission(true);
    else endMission(mission.prog>=mission.goal);
  }
}

/* ============================================================
   BOSS — THE STORM KING
   ============================================================ */
const boss={active:false,hp:0,maxhp:14,x:830,y:250,t:0,phase:0,dead:false,
  eye:0,angry:0,atk:2.5,shakeT:0,onSwitch:null,intro:0};
function startBoss(){
  bossReady=false;boss.active=true;boss.hp=boss.maxhp;boss.t=0;boss.phase=1;boss.intro=2.2;
  announce("THE STORM KING",RD,true);
  toast("HIT THE KING — THE CROWN IS HIS HEART",RD,"☠");
  SND.bossRoar();flash(.9,RD);shake(26);camPunch(1);
  ballSaveT=Math.max(ballSaveT,10);
  litScoop("CROWN",true);
  boss.onSwitch=null;
  if(!mbActive)startMB(1);
}
function bossDamage(n,x,y){
  if(!boss.active)return;
  boss.hp-=n;boss.angry=1;boss.shakeT=0.4;
  SND.bossHit();flash(.4,RD);shake(14);camPunch(.5);
  spark(x,y,34,RD,560);ring(x,y,RD,14,220);
  const p=addScore(120000*n,x,y,{col:RD,size:34});
  announce("KING STRUCK! -"+n+"HP",RD,false);
  if(boss.hp<=0)killBoss();
}
function killBoss(){
  boss.active=false;boss.dead=true;stats.bossKills++;
  const rew=3500000;
  score+=rew;feedChain(rew);
  announce("THE STORM KING FALLS! +"+shortNum(rew),YL,true);
  toast("ASCENSION IS LIT — SHOOT THE CROWN",YL,"★");
  SND.bossDie();flash(1,YL);shake(34);camPunch(1);
  for(let i=0;i<10;i++)setTimeout(()=>{spark(rand(500,1200),rand(120,420),30,pick([YL,OR,RD,WH]),620);flash(.4,YL);},i*130);
  drones.length=0;
  unlock("kingslayer","KINGSLAYER","Defeated the Storm King");
  setTimeout(()=>{if(state==="PLAY")startWizard();},2200);
}
function bossTick(dt){
  if(!boss.active)return;
  boss.t+=dt;boss.eye+=dt;
  if(boss.intro>0){boss.intro-=dt;return;}
  boss.angry=Math.max(0,boss.angry-dt*1.6);
  boss.x=830+Math.sin(boss.t*0.8)*280;
  boss.y=250+Math.sin(boss.t*1.3)*38;
  // body collision — hitting the king hurts him a little
  for(const b of balls){
    if(b.ghost||b.rail||b.scoop)continue;
    if(dist(b.x,b.y,boss.x,boss.y)<150+b.r){
      const a=Math.atan2(b.y-boss.y,b.x-boss.x);
      b.x=boss.x+Math.cos(a)*(150+b.r);b.y=boss.y+Math.sin(a)*(150+b.r);
      const vn=b.vx*Math.cos(a)+b.vy*Math.sin(a);
      if(vn<0){b.vx-=1.8*vn*Math.cos(a);b.vy-=1.8*vn*Math.sin(a);
        if(timeSec-(boss.lastHit||-9)>0.45){boss.lastHit=timeSec;bossDamage(1,b.x,b.y);}}
    }
  }
  // attacks
  boss.atk-=dt;
  if(boss.atk<=0){
    boss.atk=rand(2.6,4.4)-(1-boss.hp/boss.maxhp)*1.1;
    const r=Math.random();
    if(r<0.4){
      for(let i=0;i<2;i++)drones.push({x:boss.x+rand(-120,120),y:boss.y+80,vx:rand(-200,200),vy:rand(120,260),r:22,life:9,t:0});
      announce("DRONES!",RD,false);SND.meteor();
    }else if(r<0.72){
      const x=rand(200,1500);
      bolts.push({x,y0:60,y1:PH,t:0,life:.45,seed:Math.random()*999});
      flash(.6,IC);shake(16);SND.thunder();
      for(const b of balls){if(Math.abs(b.x-x)<200){b.vx+=(b.x<x?-1:1)*900;b.vy-=400;}}
      announce("LIGHTNING STRIKE!",IC,false);
    }else{
      windTarget=rand(-900,900);windT=3.2;
      announce("GALE FORCE!",CY,false);SND.windGust();
    }
  }
}
function startWizard(){
  wizard.active=true;wizard.t=70;
  mult=10;
  announce("A S C E N S I O N",YL,true);
  toast("EVERY SHOT IS A JACKPOT — 60 SECONDS",YL,"⚡");
  SND.wizard();flash(1,YL);shake(30);camPunch(1);
  startMB(4);
  ballSaveT=20;
  unlock("ascended","ASCENDED","Reached the wizard mode");
}
const wizard={active:false,t:0};
function wizardTick(dt){
  if(!wizard.active)return;
  wizard.t-=dt;
  if(Math.random()<dt*2.2)bolts.push({x:rand(150,1600),y0:60,y1:PH,t:0,life:.3,seed:Math.random()*999});
  if(wizard.t<=0){
    wizard.active=false;
    announce("ASCENSION ENDS",YL,true);
  }
}

/* ============================================================
   CANNON
   ============================================================ */
const cannon={loaded:false,ball:null,ang:-Math.PI/2,dir:1,t:0,cool:0};
function cannonLoad(b){
  cannon.loaded=true;cannon.ball=b;cannon.ang=-2.3;cannon.dir=1;
  announce(IS_TOUCH?"CANNON LOADED — TAP LAUNCH":"CANNON LOADED — PRESS SPACE",YL,true);
  toast(IS_TOUCH?"AIM WITH THE SWEEP, TAP LAUNCH TO FIRE":"AIM WITH THE SWEEP, FIRE WITH SPACE",YL,"▶");
  SND.lock();
}
function cannonFire(){
  if(!cannon.loaded||!cannon.ball)return;
  const b=cannon.ball;
  const s=scoopBy("CANNON");
  if(!s)return;
  cannon.loaded=false;cannon.ball=null;
  b.scoop=null;b.hold=undefined;          // the indefinite hold ends here
  const spd=3400;
  b.x=s.x+Math.cos(cannon.ang)*60;b.y=s.y+Math.sin(cannon.ang)*60;
  b.vx=Math.cos(cannon.ang)*spd;b.vy=Math.sin(cannon.ang)*spd;
  b.trail.length=0;
  SND.cannon();flash(.4,YL);shake(14);camPunch(.6);
  spark(b.x,b.y,30,YL,620);ring(s.x,s.y,YL,14,180);
  addScore(30000,s.x,s.y,{col:YL,size:28});
  s.cool=2.2;
}
function cannonTick(dt){
  if(!cannon.loaded)return;
  cannon.ang+=cannon.dir*dt*1.5;
  if(cannon.ang>-0.55){cannon.ang=-0.55;cannon.dir=-1;}
  if(cannon.ang<-2.6){cannon.ang=-2.6;cannon.dir=1;}
  cannon.t+=dt;
  if(cannon.t>6.5)cannonFire();
}

/* ============================================================
   MAG-GRAB
   ============================================================ */
function magGrab(){
  if(magGrabs<=0||timeSec-magGrabCool<1.2)return false;
  const f=focusBall();if(!f)return false;
  let best=null,bd=1e9;
  for(const m of magnets){
    if(m.state!=="idle")continue;
    const d=dist(f.x,f.y,m.x,m.y);
    if(d<bd){bd=d;best=m;}
  }
  if(!best||bd>620)return false;
  magGrabs--;magGrabCool=timeSec;
  best.state="pull";best.t=0;
  announce("MAG-GRAB",best.col,false);
  SND.magnet();ring(best.x,best.y,best.col,20,best.r*2.6);
  return true;
}
function magnetTick(dt){
  for(const m of magnets){
    if(m.state==="pull"){
      m.t+=dt;
      if(Math.random()<dt*30)parts.push({x:m.x+rand(-m.r,m.r),y:m.y+rand(-m.r,m.r),
        vx:0,vy:0,life:.3,max:.3,col:m.col,size:3});
      if(m.t>1.6){m.state="idle";m.t=0;}
    }else if(m.state==="hold"){
      m.t+=dt;
      if(m.t>0.85){
        const b=m.ball;
        m.state="cool";m.t=0;
        if(b){
          b.magnet=null;
          const ang=-Math.PI/2+rand(-0.5,0.5);
          const spd=3300;
          b.vx=Math.cos(ang)*spd;b.vy=Math.sin(ang)*spd;
          b.trail.length=0;
          SND.magFling();flash(.35,m.col);shake(12);camPunch(.45);
          spark(m.x,m.y,30,m.col,560);
          addScore(45000,m.x,m.y,{col:m.col,size:30});
          announce("MAGNET LAUNCH!",m.col,false);
        }
        m.ball=null;
      }
    }else if(m.state==="cool"){
      m.t+=dt;if(m.t>1.4){m.state="idle";m.t=0;}
    }
  }
}

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
const ACH_LIST=[];
function unlock(id,title,desc){
  if(achieved[id])return;
  achieved[id]=true;
  ACH_LIST.push({id,title,desc});
  toast(title+" — "+desc,YL,"★");
  SND.ach();
}

/* ============================================================
   BALL SEARCH
   ============================================================ */
/* Twenty-four seconds of play with nothing scored means the ball is not in
   play any more — it is parked. Almost always that is a deliberate cradle with
   both flippers held up, which no amount of kicking can end while the flippers
   stay where they are, so the search drops them for a moment as well as
   shoving the ball. Any real machine does this; without it a player who never
   lets go of the buttons cannot lose, which was the whole complaint. */
const SEARCH_AFTER=24;
function ballSearch(){
  searchCool=8;flipRelax=1.1;
  let any=false;
  for(const b of balls){
    if(b.ghost||b.scoop||b.rail||b.magnet||b.inLane||b.launchT>=0)continue;
    any=true;
    b.vx+=rand(-620,620);b.vy+=rand(120,420);
    b.at=0;b.ax=b.x;b.ay=b.y;b.stuckLv=0;
    spark(b.x,b.y,10,IC,240);
  }
  if(!any){searchCool=3;flipRelax=0;return;}
  searches++;
  announce("BALL SEARCH",IC,false);
  SND.nudge();shake(11);
}
function searchTick(dt){
  if(searchCool>0)searchCool-=dt;
  if(flipRelax>0)flipRelax-=dt;
  if(state!=="PLAY"||ballInPlunger||warpT>0)return;
  if(searchCool>0||!balls.length)return;
  if(timeSec-lastScoreTime>SEARCH_AFTER)ballSearch();
}

/* ============================================================
   BALL LIFECYCLE
   ============================================================ */
let savesThisBall=0;
function serveBall(auto,fromSave){
  /* The plunger belongs to the tower. If a warp room is still loaded when a
     ball is served — an end-of-ball bonus finishing after the room took over,
     say — the ball would spawn at the tower's shooter lane inside a 1520x1900
     room, outside its walls, with nothing to catch it. Put the tower back. */
  if(level)forceTower();
  ballInPlunger=true;plungerCharge=0;charging=false;plungerDir=1;
  const b=spawnBall(LAUNCH_PATH[0][0],LAUNCH_PATH[0][1],0,0);
  b.inLane=true;
  ballsPlayed++;
  /* A tilt ends with the ball that earned it. It used to clear only in
     endOfBallFinish, which a ball save skips entirely — so a tilt with the
     save running meant dead flippers, an instant drain, a save, and dead
     flippers again, for as long as the saves lasted. Unplayable, and it
     looked permanent. */
  tilted=false;tiltHeat=0;
  for(const f of flippers)f.key=false;
  /* A save is a grace, not a subscription: a fresh ball gets the full nine
     seconds, a saved one gets four and does not stack. */
  ballSaveT=fromSave?Math.min(Math.max(ballSaveT,4),4):Math.max(ballSaveT,9);
  skillArmed=true;skillDeck=irand(1,4);
  magGrabs=3;
  cam.x=1500;cam.y=2600;
  if(auto)setTimeout(()=>{if(state==="PLAY"&&ballInPlunger)launchNow(rand(0.42,0.9));},420);
}
function launchNow(power){
  if(!ballInPlunger)return;
  const b=balls.find(x=>x.inLane);
  if(!b){ballInPlunger=false;return;}
  ballInPlunger=false;
  const idx=clamp(Math.floor(power*4.999),0,4);
  b.launchT=0;b.railD=0;b.launchPow=power;b.launchDeck=idx;
  b.railSpd=2600+power*4200;
  SND.launch(power);
  spark(b.x,b.y,16,YL,380);
  announce("LAUNCH → "+DECKS[idx].name,DECKS[idx].col,false);
}
function onDrain(b){
  if(state!=="PLAY")return;
  if(balls.some(x=>!x.ghost))return;
  if(mbActive){mbActive=false;mbJackpot=Math.max(1,mbJackpot-0);}
  /* A tilted ball is a lost ball. Saving it would make the tilt free, and a
     penalty you never pay is not a penalty. Two saves a ball, not four. */
  if(!tilted&&ballSaveT>0&&savesThisBall<2){
    savesThisBall++;stats.saves++;
    announce("BALL SAVED!",GR,true);SND.save();flash(.4,GR);
    serveBall(true,true);
    return;
  }
  endOfBallStart();
}
function endOfBallStart(){
  state="BONUS";
  const altBonus=peakDeck*45000;
  endBonus=Math.round((bonusBank*mult)+altBonus);
  if(tilted)endBonus=0;
  endBonusStep=0;endBonusTimer=0;
  SND.drain();
  announce(tilted?"TILTED — NO BONUS":"BONUS "+shortNum(endBonus),tilted?RD:CY,false);
}
function endOfBallFinish(){
  score+=endBonus;feedChain(endBonus);checkExtras();
  bonusBank=0;endBonus=0;
  tilted=false;tiltHeat=0;
  frenzyT=0;superBumperT=0;goldT=0;surgeT=0;surge=0;
  mult=1;stormLetters=[false,false,false,false,false];chaosLetters=[false,false,false,false,false];
  lockLit=false;lockedBalls=0;mbActive=false;
  combo=0;peakDeck=0;visited=[false,false,false,false,false];
  kickLit=[true,false];
  windX=0;windTarget=0;gravTarget=Math.PI/2;gravAng=Math.PI/2;
  slowmoT=0;
  if(mission.active)endMission(false);
  wizard.active=false;
  orbs.length=0;shards.length=0;meteors.length=0;drones.length=0;
  dropBanks.forEach(bk=>{bk.targets.forEach(t=>t.up=true);bk.resetT=0;});
  bricks.forEach(br=>br.alive=true);
  scoops.forEach(s=>{s.cool=0;});
  litScoop("MISSION",true);
  litScoop("LOCK",false);
  cannon.loaded=false;cannon.ball=null;
  magnets.forEach(m=>{m.state="idle";m.t=0;m.ball=null;});
  savesThisBall=0;
  if(extraBalls>0){
    extraBalls--;announce("SHOOT AGAIN!",GR,true);SND.save();
    state="PLAY";serveBall(false);return;
  }
  ballNum++;
  if(ballNum>BALLS_PER_GAME)gameOver();
  else{state="PLAY";serveBall(false);}
}
