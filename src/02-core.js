/* ============================================================
   NEON STORM: ASCENSION
   A 1760 x 2900 five-deck pinball tower (10.3x the classic table)
   ------------------------------------------------------------
   p2 :: constants, state, math utils, audio engine
   ============================================================ */

const PW=1760, PH=2900;                 // playfield (world) size
const BALLR=20;
const G=3100;                           // gravity
const VMAX=5200;

const CY="#19e6ff",MG="#ff2bd6",YL="#ffe93b",GR="#39ff6a",RD="#ff3355",
      PU="#b26bff",OR="#ff9a1f",WH="#ffffff",IC="#bfe9ff";

const cv=document.getElementById("game");
const ctx=cv.getContext("2d",{alpha:false});
let VW=800,VH=600,DPR=1;

let renderScale=1;                      // dropped automatically when frames get long
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2)*renderScale;
  VW=window.innerWidth;VH=window.innerHeight;
  cv.width=Math.max(1,Math.round(VW*DPR));cv.height=Math.max(1,Math.round(VH*DPR));
}
resize();addEventListener("resize",resize);

/* ---------- math ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const lerp=(a,b,t)=>a+(b-a)*t;
const pick=a=>a[(Math.random()*a.length)|0];
const dist=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
const fmt=n=>Math.round(n).toLocaleString("en-US");
function imul(a,b){return Math.imul(a,b)>>>0;}
function h32(...ns){let h=0x811c9dc5>>>0;for(const n of ns){h^=(n>>>0);h=imul(h,16777619);h^=h>>>13;}return h>>>0;}
function shortNum(n){
  n=Math.round(n);
  if(n>=1e9)return (n/1e9).toFixed(2)+"B";
  if(n>=1e6)return (n/1e6).toFixed(n>=1e7?1:2)+"M";
  if(n>=1e4)return (n/1e3).toFixed(0)+"K";
  return fmt(n);
}
function closestSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;
  let t=l2>0?((px-x1)*dx+(py-y1)*dy)/l2:0;
  t=clamp(t,0,1);
  return{x:x1+dx*t,y:y1+dy*t,t};
}

/* ---------- decks (bottom index 0 = ground floor) ---------- */
const DECKS=[
  {id:0,name:"THE GUTTER",  short:"GUTTER", y0:2410,y1:2900,mult:1,col:CY, hue:"rgba(25,230,255,", dark:"#04141b"},
  {id:1,name:"NEON BAZAAR", short:"BAZAAR", y0:1860,y1:2410,mult:2,col:MG, hue:"rgba(255,43,214,", dark:"#170519"},
  {id:2,name:"THE FOUNDRY", short:"FOUNDRY",y0:1250,y1:1860,mult:3,col:OR, hue:"rgba(255,154,31,", dark:"#190d03"},
  {id:3,name:"STORM SPINE", short:"SPINE",  y0:640, y1:1250,mult:5,col:PU, hue:"rgba(178,107,255,", dark:"#0e0622"},
  {id:4,name:"THE CROWN",   short:"CROWN",  y0:0,   y1:640, mult:8,col:YL, hue:"rgba(255,233,59,", dark:"#171404"}
];
function deckAt(y){
  for(let i=0;i<DECKS.length;i++) if(y>=DECKS[i].y0) return DECKS[i];
  return DECKS[4];
}

/* ---------- global state ---------- */
let state="ATTRACT";
let timeSec=0,lastT=0,paused=false,muted=false;

const balls=[];
const parts=[],floats=[],rings=[],shards=[],orbs=[],bolts=[],meteors=[],drones=[],rainDrops=[];
let shakeMag=0,flashA=0,flashCol=WH,bgPulse=0,slowmoT=0,hitStop=0;

let score=0,high=0,mult=1,combo=0,comboT=0,maxCombo=0;
let ballNum=1,extraBalls=0,ballsPlayed=0,BALLS_PER_GAME=3;
let bonusBank=0,endBonus=0,endBonusStep=0,endBonusTimer=0;
let plungerCharge=0,charging=false,ballInPlunger=false,launchDeckSel=0;
let tiltHeat=0,tilted=false,nudgesUsed=0;
let ballSaveT=0,skillDeck=-1,skillArmed=false;
let stormMeter=0,surge=0,surgeT=0;
let frenzyT=0,superBumperT=0,goldT=0;
let mbActive=false,mbJackpot=1,lockedBalls=0,lockLit=false;
let magGrabs=3,magGrabCool=0;
let excite=0,lastScoreTime=-99;
let peakDeck=0,visited=[false,false,false,false,false];
let stormLetters=[false,false,false,false,false];
let chaosLetters=[false,false,false,false,false];
let kickLit=[true,false];            // [gutter-left, gutter-right]
let announceQ=[],announceCur=null;
let toastQ=[],toasts=[];
let camMode="follow";
let cheatFlag=false,gameStartTime=0,durationSec=0;
let sessSeed=(Math.random()*0xffffffff)>>>0,chain=sessSeed,scoreWindowPts=0,scoreWindowT=0;
let stats={jackpots:0,mb:0,chaos:0,maxMult:1,spins:0,saves:0,mystery:0,bricks:0,rails:0,portals:0,
           missions:0,bossKills:0,orbs:0,shards:0,meteors:0,maxAlt:0,ex1:false,ex2:false,ex3:false};
let achieved={};
const STORM_WORD=["S","T","O","R","M"], CHAOS_WORD=["C","H","A","O","S"];

/* ---------- persistence ---------- */
let board=[];
const LB_KEY="nsa_board_v1";
function loadBoard(){
  try{
    const raw=localStorage.getItem(LB_KEY);
    if(!raw)return;
    const arr=JSON.parse(raw);
    if(Array.isArray(arr)){
      board=arr.filter(o=>o&&typeof o.s==="number"&&isFinite(o.s)&&o.s<2e10)
               .map(o=>({s:o.s,n:String(o.n||"???").slice(0,3),d:o.d|0}))
               .sort((a,b)=>b.s-a.s).slice(0,8);
    }
  }catch(e){}
  high=board.length?board[0].s:0;
}
function saveBoard(){try{localStorage.setItem(LB_KEY,JSON.stringify(board));}catch(e){}}
loadBoard();

/* ============================================================
   AUDIO — everything is synthesised, no assets
   ============================================================ */
const AC=window.AudioContext||window.webkitAudioContext;
let ac=null,master=null,comp=null,musicGain=null;
let musicBeat=0,musicAcc=0,musicKey=0;
function ensureAudio(){
  if(ac)return;
  try{
    ac=new AC();
    comp=ac.createDynamicsCompressor();
    comp.threshold.value=-15;comp.ratio.value=9;
    master=ac.createGain();master.gain.value=muted?0:0.42;
    master.connect(comp);comp.connect(ac.destination);
    musicGain=ac.createGain();musicGain.gain.value=0.55;musicGain.connect(master);
  }catch(e){ac=null;}
}
function setMute(m){
  muted=m;
  if(master)master.gain.value=m?0:0.42;
  const b=document.getElementById("muteBtn");
  if(b)b.innerHTML=m?"&#128263;":"&#128266;";
}
function tone(f,d,type,vol,f2,delay,dest){
  if(!ac||muted)return;
  const t=ac.currentTime+(delay||0);
  const o=ac.createOscillator(),g=ac.createGain();
  o.type=type||"sine";o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(f2,1),t+d);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g);g.connect(dest||master);o.start(t);o.stop(t+d+0.02);
}
let noiseBuf=null;
function getNoise(){
  if(noiseBuf||!ac)return noiseBuf;
  const len=ac.sampleRate*2;
  noiseBuf=ac.createBuffer(1,len,ac.sampleRate);
  const ch=noiseBuf.getChannelData(0);
  for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;
  return noiseBuf;
}
function noise(d,vol,hp,lp,delay){
  if(!ac||muted)return;
  const buf=getNoise();if(!buf)return;
  const t=ac.currentTime+(delay||0);
  const src=ac.createBufferSource();src.buffer=buf;
  src.loopStart=0;src.loop=true;
  let node=src;
  if(hp){const f=ac.createBiquadFilter();f.type="highpass";f.frequency.value=hp;node.connect(f);node=f;}
  if(lp){const f=ac.createBiquadFilter();f.type="lowpass";f.frequency.value=lp;node.connect(f);node=f;}
  const g=ac.createGain();
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  node.connect(g);g.connect(master);
  src.start(t,Math.random()*1.5);src.stop(t+d+0.02);
}
function sweep(f1,f2,d,vol,type,delay){tone(f1,d,type||"sawtooth",vol,f2,delay);}
function arp(list,d,type,vol,step,f2){list.forEach((f,i)=>tone(f,d,type,vol,f2,i*step));}

const SND={
  flip(){tone(190,0.05,"square",0.2,90);noise(0.028,0.12,2200);},
  bumper(n){tone(430+n*60,0.09,"sine",0.34,220+n*60);tone(880+n*120,0.05,"triangle",0.16);},
  sling(){noise(0.06,0.34,1100);tone(230,0.05,"square",0.18,120);},
  roll(){tone(920,0.06,"triangle",0.24,1380);},
  target(){tone(200,0.09,"sawtooth",0.26,430);noise(0.04,0.16,3000);},
  brick(n){tone(500+n*40,0.07,"square",0.2,900+n*40);noise(0.03,0.12,2600);},
  bank(){arp([440,554,659,880],0.12,"square",0.24,0.065);},
  launch(p){sweep(120+p*220,900+p*700,0.32,0.3);noise(0.26,0.16,500,6000);},
  rail(){sweep(300,1500,0.5,0.14,"triangle");noise(0.5,0.08,900,9000);},
  railEnd(){arp([880,1175,1568],0.12,"triangle",0.2,0.05);},
  portal(){sweep(1400,180,0.35,0.24,"sine");sweep(180,1400,0.35,0.16,"sine",0.05);noise(0.3,0.1,300,2000);},
  magnet(){tone(70,0.5,"sawtooth",0.18,180);noise(0.4,0.07,80,600);},
  magFling(){sweep(200,1600,0.25,0.3,"square");noise(0.2,0.2,600,7000);},
  skill(){arp([1319,1568,2093,2637],0.22,"sine",0.26,0.05);},
  jackpot(){arp([523,659,784,1047,1319,1568],0.28,"square",0.26,0.07);noise(0.5,0.24,300,4000);},
  superJack(){arp([784,988,1175,1568,1976,2349],0.34,"sawtooth",0.22,0.06);noise(0.8,0.28,200,5000);},
  mbStart(){for(let i=0;i<5;i++){tone(600,0.14,"sawtooth",0.2,900,i*0.15);tone(450,0.14,"sawtooth",0.2,650,i*0.15+0.07);}noise(0.7,0.16,200,3000);},
  drain(){arp([392,330,262,196,147],0.22,"triangle",0.26,0.13);},
  tilt(){sweep(95,50,0.75,0.4);noise(0.6,0.26,90,400);},
  mystery(){for(let i=0;i<7;i++)tone(rand(400,2000),0.06,"square",0.17,undefined,i*0.055);},
  thunder(){noise(1.4,0.5,50,900);tone(56,1.1,"sine",0.42,28);noise(0.25,0.35,2000,9000);},
  lock(){tone(660,0.14,"sine",0.3);tone(880,0.2,"sine",0.26,undefined,0.09);},
  save(){arp([784,1047,1319],0.15,"sine",0.26,0.07);},
  extra(){arp([659,784,988,1319,1568,2093],0.17,"square",0.26,0.08);},
  tick(){tone(1300,0.028,"square",0.12);},
  nudge(){noise(0.09,0.3,140,700);},
  gate(){tone(1047,0.11,"triangle",0.26,1568);},
  spinTick(){tone(rand(1500,2400),0.02,"square",0.07);},
  ui(){tone(760,0.05,"square",0.17,1080);},
  orb(){arp([1047,1319,1760],0.13,"sine",0.22,0.05);},
  shard(){tone(rand(1700,2400),0.04,"triangle",0.09,rand(2400,3200));},
  deckUp(){arp([392,523,659,784],0.16,"triangle",0.2,0.06);},
  deckDown(){arp([523,392,294],0.14,"triangle",0.16,0.07);},
  missionStart(){arp([262,330,392,523,659],0.2,"sawtooth",0.2,0.09);noise(0.5,0.12,400,3000);},
  missionWin(){arp([523,659,784,1047,1319,1568,2093],0.24,"square",0.24,0.075);noise(0.6,0.2,300,5000);},
  bossHit(){tone(120,0.22,"sawtooth",0.34,50);noise(0.16,0.28,200,1400);},
  bossRoar(){sweep(180,42,1.3,0.42);noise(1.2,0.28,60,700);},
  bossDie(){for(let i=0;i<8;i++){sweep(rand(300,700),rand(40,90),0.4,0.22,"sawtooth",i*0.1);}noise(1.6,0.3,60,2000);},
  meteor(){noise(0.4,0.16,200,1600);sweep(700,140,0.4,0.16);},
  wizard(){for(let i=0;i<10;i++)arp([523,659,784,1047],0.2,"square",0.14,0.05,undefined);noise(1.2,0.2,300,6000);},
  ach(){arp([1568,2093,2637],0.16,"triangle",0.2,0.055);},
  cannon(){sweep(90,900,0.3,0.34,"square");noise(0.3,0.26,300,5000);},
  windGust(){noise(1.1,0.1,300,1600);}
};

/* music: 5 keys, one per deck; tempo tracks excitement */
const BASSLINES=[
  [55,55,65.4,55,49,49,55,73.4],
  [58.3,58.3,69.3,58.3,51.9,51.9,58.3,77.8],
  [61.7,61.7,73.4,61.7,49,49,61.7,82.4],
  [65.4,65.4,77.8,65.4,58.3,58.3,65.4,87.3],
  [73.4,73.4,87.3,73.4,65.4,65.4,73.4,98]
];
const LEADS=[
  [880,988,1175,988],[932,1047,1245,1047],[988,1109,1319,1109],[1047,1175,1397,1175],[1175,1319,1568,1319]
];
function musicTick(dt){
  if(!ac||muted||state!=="PLAY")return;
  const bpm=100+excite*80+(mbActive?22:0)+(mission.active?14:0);
  musicAcc+=dt*bpm/60;
  if(musicAcc<0.25)return;
  musicAcc-=0.25;musicBeat++;
  const b=musicBeat%16;
  const k=musicKey;
  if(b%4===0)tone(148,0.13,"sine",excite*0.26+0.08,42,0,musicGain);
  if(b%8===4)noise(0.07,0.1,4200);
  if(mbActive&&b%2===1)noise(0.026,0.08,7000);
  const bl=BASSLINES[k];
  if(excite>0.1&&b%2===0)tone(bl[(musicBeat>>1)%8],0.13,"triangle",0.07+excite*0.11,undefined,0,musicGain);
  if((mission.active||mbActive||boss.active)&&b%4===2){
    const ld=LEADS[k];tone(ld[(musicBeat>>2)%4],0.1,"square",0.05,undefined,0,musicGain);
  }
  if(boss.active&&b%8===0)tone(bl[0]/2,0.4,"sawtooth",0.1,undefined,0,musicGain);
  bgPulse=Math.max(bgPulse,excite*0.5);
}
