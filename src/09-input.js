/* ============================================================
   p9 :: GAME FLOW, INPUT, LOOP, UI
   ============================================================ */
const $=id=>document.getElementById(id);

function newGame(){
  balls.length=0;parts.length=0;floats.length=0;rings.length=0;shards.length=0;
  orbs.length=0;meteors.length=0;drones.length=0;bolts.length=0;
  announceQ.length=0;announceCur=null;toasts.length=0;ACH_LIST.length=0;achieved={};
  score=0;mult=1;combo=0;comboT=0;maxCombo=0;
  frenzyT=0;superBumperT=0;goldT=0;surge=0;surgeT=0;stormMeter=0;
  mbActive=false;mbJackpot=1;lockedBalls=0;lockLit=false;
  ballNum=1;extraBalls=0;ballsPlayed=0;bonusBank=0;endBonus=0;
  tiltHeat=0;tilted=false;nudgesUsed=0;ballSaveT=0;
  peakDeck=0;visited=[false,false,false,false,false];
  stormLetters=[false,false,false,false,false];chaosLetters=[false,false,false,false,false];
  kickLit=[true,false];magGrabs=3;crownHits=0;
  missionsDone=0;bossReady=false;boss.active=false;boss.dead=false;boss.hp=0;
  wizard.active=false;wizard.t=0;
  mission.active=false;mission.scoreMul=1;mission.id=null;mission.onSwitch=null;mission.tick=null;
  missionPool=MISSION_LIST.map(m=>m.id);
  cannon.loaded=false;cannon.ball=null;
  magnets.forEach(m=>{m.state="idle";m.t=0;m.ball=null;m.lit=false;});
  dropBanks.forEach(b=>{b.targets.forEach(t=>t.up=true);b.resetT=0;});
  bricks.forEach(b=>b.alive=true);
  brickResetT=0;
  scoops.forEach(s=>{s.cool=0;});
  litScoop("MISSION",true);litScoop("LOCK",false);
  litScoop("VENT",false);litScoop("CROWN",true);litScoop("ROD",true);
  spinners.forEach(s=>{s.vel=0;s.acc=0;});
  gravAng=Math.PI/2;gravTarget=Math.PI/2;windX=0;windTarget=0;windT=0;
  slowmoT=0;excite=0;
  stats={jackpots:0,mb:0,chaos:0,maxMult:1,spins:0,saves:0,mystery:0,bricks:0,rails:0,portals:0,
         missions:0,bossKills:0,orbs:0,shards:0,meteors:0,maxAlt:0,ex1:false,ex2:false,ex3:false};
  cheatFlag=false;sessSeed=(Math.random()*0xffffffff)>>>0;chain=sessSeed;
  gameStartTime=timeSec;
  camMode="follow";
  state="PLAY";
  serveBall(false);
  $("startScreen").classList.add("hidden");
  $("overScreen").classList.add("hidden");
  $("initScreen").classList.add("hidden");
  $("hudBtns").classList.remove("hidden");
}

function gameOver(){
  state="OVER";
  durationSec=Math.round(timeSec-gameStartTime);
  balls.length=0;
  const qualifies=!cheatFlag&&(board.length<8||score>board[board.length-1].s)&&score>0;
  $("finalScore").textContent=fmt(score);
  $("gradeLine").textContent="RANK "+grade()+"   •   PEAK "+DECKS[stats.maxAlt].name+
    "   •   "+stats.missions+" MISSION"+(stats.missions===1?"":"S")+" CLEARED";
  $("voidWarn").classList.toggle("hidden",!cheatFlag);
  $("hudBtns").classList.add("hidden");
  if(qualifies){
    $("initScore").textContent=fmt(score);
    $("initScreen").classList.remove("hidden");
    setTimeout(()=>{const el=$("initInput");el.focus();el.select();},60);
  }else{
    finishGameOver(null);
  }
}
function finishGameOver(name){
  if(name){
    board.push({s:score,n:name,d:Math.floor(Date.now()/1000)});
    board.sort((a,b)=>b.s-a.s);board=board.slice(0,8);
    saveBoard();
    high=board[0].s;
  }
  $("initScreen").classList.add("hidden");
  $("newHi").classList.toggle("hidden",!(board.length&&board[0].s===score&&name));
  renderBoard();
  showShareCard();
  $("overScreen").classList.remove("hidden");
}
function renderBoard(){
  const el=$("lb");
  if(!board.length){el.innerHTML="";return;}
  el.innerHTML="<div style='letter-spacing:3px;color:#8fd8ff;font-size:.85em;margin-bottom:4px'>TOP CLIMBERS</div>"+
    board.map((r,i)=>{
      const cls=i===0?"r1":i===1?"r2":i===2?"r3":"";
      const mark=(r.s===score)?" ◀":"";
      return `<div class="${cls}">${String(i+1).padStart(2," ")}. <b>${r.n}</b>  ${fmt(r.s).padStart(12," ")}${mark}</div>`;
    }).join("");
}

function doNudge(dx,dy){
  if(state!=="PLAY"||tilted||paused)return;
  nudgesUsed++;
  SND.nudge();shake(9);camPunch(.2);
  tiltHeat+=1;
  for(const b of balls){if(!b.scoop&&!b.rail&&!b.magnet&&b.launchT<0){b.vx+=dx;b.vy+=dy;}}
  if(tiltHeat>=2&&tiltHeat<3)announce("EASY...",RD,false);
  if(tiltHeat>=3){
    tilted=true;
    announce("TILT!!!",RD,true);
    SND.tilt();flash(.6,RD);shake(26);
    for(const f of flippers)f.key=false;
  }
}
function togglePause(){
  if(state!=="PLAY"&&state!=="BONUS")return;
  paused=!paused;
  $("pauseScreen").classList.toggle("hidden",!paused);
  if(paused){
    $("pauseStats").innerHTML=[
      ["SCORE",fmt(score)],["BALL",ballNum+"/"+BALLS_PER_GAME],["PEAK",DECKS[stats.maxAlt].short],
      ["MISSIONS",stats.missions],["JACKPOTS",stats.jackpots],["RAILS",stats.rails]
    ].map(r=>`<div class="chip">${r[0]} <b>${r[1]}</b></div>`).join("");
  }else lastT=performance.now();
}

/* ============================================================
   INPUT
   ============================================================ */
/* A flipper side can be asked for by the keyboard, by its on-screen button, or
   by any number of fingers on that half of the playfield. Track them all so one
   finger lifting never drops a flipper another finger is still holding. */
const held={left:false,right:false};
const btnHold=[false,false];
const canvasPointers=new Map();          // pointerId -> side
function sideWanted(side){
  if(side===0&&held.left)return true;
  if(side===1&&held.right)return true;
  if(btnHold[side])return true;
  for(const v of canvasPointers.values())if(v===side)return true;
  return false;
}
function setFlip(side,on){
  if(tilted)on=false;
  for(const f of flippers){
    if(f.side===side&&f.key!==on){f.key=on;if(on)SND.flip();}
  }
}
function syncFlip(side){setFlip(side,sideWanted(side));}
addEventListener("keydown",e=>{
  const k=e.key.toLowerCase();
  if(["arrowleft","arrowright","arrowup","arrowdown"," ","tab"].includes(k))e.preventDefault();
  if(document.activeElement&&document.activeElement.id==="initInput"){
    if(k==="enter")$("initOk").click();
    return;
  }
  ensureAudio();
  if(k==="enter"){
    if(state==="ATTRACT"||state==="OVER"){SND.ui();newGame();}
    return;
  }
  if(k==="p"){togglePause();return;}
  if(k==="m"){setMute(!muted);return;}
  if(k==="c"){camMode=camMode==="follow"?"overview":"follow";SND.ui();return;}
  if(paused)return;
  if(k==="arrowleft"||k==="a"){held.left=true;syncFlip(0);}
  if(k==="arrowright"||k==="d"){held.right=true;syncFlip(1);}
  if(k===" "||k==="arrowdown"){
    if(state==="PLAY"&&ballInPlunger){charging=true;}
    else if(cannon.loaded){cannonFire();}
    else if(state==="PLAY"&&!e.repeat){magGrab();}
  }
  if(k==="z"||k===",")doNudge(-260,-90);
  if(k==="x"||k===".")doNudge(260,-90);
  if(k==="w"||k==="arrowup")doNudge(0,-300);
});
addEventListener("keyup",e=>{
  const k=e.key.toLowerCase();
  if(k==="arrowleft"||k==="a"){held.left=false;syncFlip(0);}
  if(k==="arrowright"||k==="d"){held.right=false;syncFlip(1);}
  if((k===" "||k==="arrowdown")&&charging){
    charging=false;
    if(state==="PLAY"&&ballInPlunger)launchNow(plungerCharge);
    plungerCharge=0;plungerDir=1;
  }
});

/* iOS Safari ignores user-scalable=no, and two thumbs on the flippers reads as
   a pinch — which silently zooms the whole page. Kill the gestures outright. */
["gesturestart","gesturechange","gestureend"].forEach(t=>{
  document.addEventListener(t,e=>e.preventDefault(),{passive:false});
});
/* A pinch is already under way by the first multi-touch MOVE, so refuse the
   second finger at touchstart as well. The pads and the table run on pointer
   events, which fire before these and are unaffected by cancelling the touch
   default, so two-thumb play is untouched. */
const zoomSafe=t=>t&&/INPUT|TEXTAREA/.test(t.tagName||"");
document.addEventListener("touchstart",e=>{
  if(e.touches.length>1&&!zoomSafe(e.target))e.preventDefault();
},{passive:false});
document.addEventListener("touchmove",e=>{
  if(e.touches.length>1)e.preventDefault();          // multi-touch = pinch attempt
},{passive:false});
let lastTouchEnd=0;
document.addEventListener("touchend",e=>{
  const now=Date.now();
  if(now-lastTouchEnd<320&&!/INPUT|BUTTON/.test(e.target.tagName))e.preventDefault();
  lastTouchEnd=now;                                   // double-tap-to-zoom
},{passive:false});
document.addEventListener("contextmenu",e=>{
  if(e.target&&e.target.id==="initInput")return;
  e.preventDefault();                                 // long-press "Copy / Look Up"
});

/* ---------- zoom watchdog ----------
   All of the above is prevention, and prevention has already been beaten once:
   a report came in of the page sitting at 1.6x with the score and half the
   table panned off-screen. Nothing the canvas draws can help there — the whole
   document is magnified, buttons included — so treat it as a state to detect
   and get out of, not one to hope never happens.

   Pause immediately, because a ball draining where you cannot see it is the
   part that actually costs you a game. Then offer the way back: re-asserting
   maximum-scale on the viewport meta is the one thing that reliably snaps iOS
   Safari to 1, and it only works from a user gesture, which is what the button
   is for. */
const vvp=window.visualViewport;
let zoomedOut=false, zoomPaused=false;
function vScale(){return vvp?(vvp.scale||1):1;}
function placeZoomFix(){
  const el=$("zoomFix");
  if(!vvp){el.style.inset="0";return;}
  const k=1/Math.max(vScale(),0.01);
  el.style.left=vvp.offsetLeft+"px";
  el.style.top=vvp.offsetTop+"px";
  el.style.width=vvp.width+"px";
  el.style.height=vvp.height+"px";
  el.style.fontSize=(13*k)+"px";
}
function checkZoom(){
  const z=vScale()>1.03;
  if(z){
    placeZoomFix();
    if(!zoomedOut){
      zoomedOut=true;
      /* freeze the simulation without opening the pause card — that card is laid
         out in page coordinates and would be off-screen too */
      if((state==="PLAY"||state==="BONUS")&&!paused){zoomPaused=true;paused=true;}
      $("zoomFix").classList.remove("hidden");
    }
  }else if(zoomedOut){
    zoomedOut=false;
    $("zoomFix").classList.add("hidden");
    if(zoomPaused){zoomPaused=false;paused=false;lastT=performance.now();}
  }
}
if(vvp){
  vvp.addEventListener("resize",checkZoom);
  vvp.addEventListener("scroll",checkZoom);
  setInterval(checkZoom,700);
}
$("zoomFixBtn").addEventListener("click",()=>{
  const m=document.querySelector('meta[name="viewport"]');
  if(m){
    const keep=m.getAttribute("content");
    m.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
    void document.body.offsetHeight;                  // force the re-layout
    setTimeout(()=>{m.setAttribute("content",keep);checkZoom();},400);
  }
  window.scrollTo(0,0);
  setTimeout(checkZoom,600);
});

/* touch */
function bindHold(el,down,up){
  if(!el)return;
  el.addEventListener("pointerdown",e=>{e.preventDefault();ensureAudio();down();el.classList.add("on");});
  const end=e=>{e.preventDefault();up&&up();el.classList.remove("on");};
  el.addEventListener("pointerup",end);
  el.addEventListener("pointercancel",end);
  el.addEventListener("pointerleave",end);
}
bindHold($("tLeft"), ()=>{btnHold[0]=true;syncFlip(0);}, ()=>{btnHold[0]=false;syncFlip(0);});
bindHold($("tRight"),()=>{btnHold[1]=true;syncFlip(1);}, ()=>{btnHold[1]=false;syncFlip(1);});
bindHold($("tLaunch"),
  ()=>{if(state==="PLAY"&&ballInPlunger)charging=true;else if(cannon.loaded)cannonFire();else magGrab();},
  ()=>{if(charging){charging=false;if(state==="PLAY"&&ballInPlunger)launchNow(plungerCharge);plungerCharge=0;plungerDir=1;}});
bindHold($("tNudgeL"),()=>doNudge(-260,-90));
bindHold($("tNudgeR"),()=>doNudge(260,-90));

/* tapping either half of the playfield works the flipper on that side, and two
   thumbs at once work both — the same as the on-screen buttons */
cv.addEventListener("pointerdown",e=>{
  ensureAudio();
  if(state!=="PLAY")return;
  if(e.clientY<playTop()||e.clientY>VH-hudBottomH())return;
  const side=e.clientX<VW/2?0:1;
  canvasPointers.set(e.pointerId,side);
  syncFlip(side);
});
function releaseCanvasPointer(e){
  const side=canvasPointers.get(e.pointerId);
  if(side===undefined)return;
  canvasPointers.delete(e.pointerId);
  syncFlip(side);
}
cv.addEventListener("pointerup",releaseCanvasPointer);
cv.addEventListener("pointercancel",releaseCanvasPointer);
cv.addEventListener("pointerleave",releaseCanvasPointer);
addEventListener("blur",()=>{canvasPointers.clear();btnHold[0]=btnHold[1]=false;
  held.left=held.right=false;setFlip(0,false);setFlip(1,false);});
cv.addEventListener("contextmenu",e=>e.preventDefault());

/* ============================================================
   FRAME LOOP
   ============================================================ */
function frame(t){
  requestAnimationFrame(frame);
  const dt=Math.min((t-lastT)/1000,0.05);
  perfTick((t-lastT)||16.7);
  lastT=t;
  if(paused){return;}
  update(dt);
  drawWorld();
  drawHUD();
}

/* ============================================================
   UI WIRING
   ============================================================ */
$("startBtn").addEventListener("click",()=>{ensureAudio();SND.ui();newGame();});
$("againBtn").addEventListener("click",()=>{SND.ui();newGame();});
$("resumeBtn").addEventListener("click",()=>togglePause());
$("muteBtn").addEventListener("click",()=>{ensureAudio();setMute(!muted);});
$("pauseBtn").addEventListener("click",()=>togglePause());
$("camBtn").addEventListener("click",()=>{camMode=camMode==="follow"?"overview":"follow";SND.ui();});
$("initOk").addEventListener("click",()=>{
  let v=($("initInput").value||"AAA").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
  while(v.length<3)v+="_";
  SND.ui();finishGameOver(v);
});
$("initInput").addEventListener("input",e=>{
  e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
});
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&(state==="PLAY"||state==="BONUS")&&!paused)togglePause();
});

/* ---------- share ---------- */
let lastCard=null;
function showShareCard(){
  try{
    lastCard=buildShareCard();
    $("shareImg").src=lastCard.canvas.toDataURL("image/png");
  }catch(e){$("shareImg").style.display="none";}
}
function shareText(){
  return "⚡ NEON STORM: ASCENSION ⚡\nSCORE: "+fmt(score)+"  (RANK "+grade()+")\n"+
    "PEAK: "+DECKS[stats.maxAlt].name+"  •  MISSIONS: "+stats.missions+"  •  MAX COMBO: "+maxCombo+"\n"+
    "VERIFY: "+(lastCard?lastCard.code:"—")+"\nCan you climb higher?";
}
/* Saving the score card: hosted views hand the file over through the
   downloads capability; a local copy of this file uses a plain link. */
let dlApi=null,dlChecked=false;
async function getDownloads(){
  if(dlChecked)return dlApi;
  dlChecked=true;
  try{ if(window.claude&&typeof window.claude.use==="function") dlApi=await window.claude.use("downloads"); }
  catch(e){ dlApi=null; }
  return dlApi;
}
function btnFlash(btn,txt,back){
  if(!btn)return;
  btn.textContent=txt;
  setTimeout(()=>{btn.innerHTML=back;},1600);
}
async function saveCardPng(){
  if(!lastCard)return;
  const btn=$("dlBtn");
  const filename="neon-storm-ascension-"+fmt(score).replace(/,/g,"")+".png";
  const api=await getDownloads();
  if(api){
    try{
      const blob=await new Promise(r=>lastCard.canvas.toBlob(r,"image/png"));
      await api.save({filename,data:blob});
      btnFlash(btn,"✓ SAVED","&#11015; SAVE PNG");
    }catch(e){
      if(!e||e.code!=="declined")btnFlash(btn,"SAVE UNAVAILABLE","&#11015; SAVE PNG");
    }
    return;
  }
  const a=document.createElement("a");
  a.download=filename;
  a.href=lastCard.canvas.toDataURL("image/png");
  a.click();
}
$("dlBtn").addEventListener("click",()=>{SND.ui();saveCardPng();});
$("copyBtn").addEventListener("click",()=>{
  const txt=shareText();
  const done=()=>{const b=$("copyBtn");b.textContent="✓ COPIED";setTimeout(()=>b.innerHTML="&#128203; COPY",1500);SND.ui();};
  if(navigator.clipboard)navigator.clipboard.writeText(txt).then(done,done);else done();
});
$("shareBtn").addEventListener("click",async()=>{
  const txt=shareText();
  try{
    if(lastCard&&navigator.canShare){
      const blob=await new Promise(r=>lastCard.canvas.toBlob(r,"image/png"));
      const file=new File([blob],"neon-storm-ascension.png",{type:"image/png"});
      if(navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Neon Storm: Ascension",text:txt});return;
      }
    }
    if(navigator.share){await navigator.share({title:"Neon Storm: Ascension",text:txt});return;}
    throw 0;
  }catch(e){
    saveCardPng();
  }
});

/* ---------- boot ---------- */
setMute(false);
renderBoard();
/* Offer the home-screen install only where it actually buys something: an iOS
   device, in a browser tab rather than an already-installed window. Android
   and desktop have their own install affordances and do not need the nudge. */
(function(){
  const standalone=window.navigator.standalone===true||
    (window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(IS_TOUCH&&ios&&!standalone)$("a2hs").classList.remove("hidden");
})();
$("loadNote").style.display="none";
$("startScreen").classList.remove("hidden");
lastT=performance.now();
requestAnimationFrame(frame);

/* expose a tiny harness for automated smoke tests */
window.__NSA__={
  get state(){return state;},
  get score(){return score;},
  get balls(){return balls;},
  get deckOf(){return b=>b.deck;},
  start(){newGame();},
  launch(p){launchNow(p===undefined?0.9:p);},
  teleportBall(x,y,vx,vy){if(balls[0]){balls[0].x=x;balls[0].y=y;balls[0].vx=vx||0;balls[0].vy=vy||0;balls[0].inLane=false;balls[0].launchT=-1;ballInPlunger=false;}},
  step(n){for(let i=0;i<(n||60);i++){update(1/60);}},
  info(){return{state,score,ballNum,balls:balls.length,peakDeck,missions:stats.missions,
    inLane:ballInPlunger,saves:stats.saves,
    b:balls.map(b=>({x:Math.round(b.x),y:Math.round(b.y),vx:Math.round(b.vx),vy:Math.round(b.vy),
      d:b.deck,rail:b.rail?b.rail.short:null,lane:b.launchT>=0,scoop:b.scoop?b.scoop.name:null,
      mag:!!b.magnet,inLane:b.inLane})),
    cam:{x:Math.round(cam.x),y:Math.round(cam.y),view:Math.round(cam.view)},
    layout:{top:Math.round(playTop()),h:Math.round(playH()),bot:Math.round(hudBottomH()),
      clipH:Math.round(clipH()),clipBot:Math.round(clipBotH()),
      frameBot:Math.round(VH-hudBottomH()),clipBotY:Math.round(clipTop()+clipH()),
      seenW:Math.round(VW/camScale()),seenH:Math.round(clipH()/camScale()),
      framedH:Math.round(playH()/camScale()),ballPx:Math.round(2*BALLR*camScale())},
    ballScreen:(()=>{const f=focusBall();if(!f)return null;const p=w2s(f.x,f.y);
      return{x:Math.round(p.x),y:Math.round(p.y)};})()};},
  set(k,v){if(k==="grav")gravTarget=v;},
  flip(side,on){held[side?'right':'left']=!!on;syncFlip(side);},
  drains(){return ballsPlayed;},
  flipState(){return{L:flippers.filter(f=>f.side===0&&f.key).length,
                     R:flippers.filter(f=>f.side===1&&f.key).length,
                     pointers:canvasPointers.size};},
  forceMission(id){startMission(id||pick(MISSION_LIST).id);},
  warp(id){gateCool[id]=0;warpBegin(id,null);},
  warpBack(){warpExit(true);},
  levelInfo(){return level?{id:level.id,name:level.name,t:Math.round(levelT),
    prog:levelProg,goal:levelGoal,done:levelDone,pw:PW,ph:PH,
    balls:balls.length,walls:walls.length,bumpers:bumpers.length,
    flippers:flippers.length}:null;},
  gates(){return Object.assign({},gateCool);},
  warping(){return warpT>0;},
  forceBoss(){missionsDone=4;bossReady=true;startBoss();},
  forceWizard(){startWizard();},
  hurtBoss(n){bossDamage(n||1,boss.x,boss.y);},
  fireCannon(){cannonFire();},
  grabMag(){return magGrab();},
  spawnOrbAt(k){spawnOrb(830,1500,k);},
  drain(){for(const b of balls){b.inLane=false;b.launchT=-1;b.scoop=null;b.rail=null;b.magnet=null;b.shield=false;b.y=PH+80;}ballInPlunger=false;ballSaveT=0;savesThisBall=9;},
  toss(){const b=balls[0];if(b){b.inLane=false;b.launchT=-1;b.x=830;b.y=900;b.vx=rand(-1400,1400);b.vy=rand(-900,900);}},
  counts(){return{parts:parts.length,floats:floats.length,rings:rings.length,shards:shards.length,
    orbs:orbs.length,meteors:meteors.length,drones:drones.length,bolts:bolts.length,rain:rainDrops.length,
    toasts:toasts.length,announceQ:announceQ.length};},
  nudgeAll(){for(const b of balls){b.vx+=rand(-600,600);b.vy-=1200;}}
};
})();
</script>
</body>
</html>
