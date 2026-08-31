/* ============================================================
   p3b :: THE WARP LEVELS — three machines behind three holes
   ------------------------------------------------------------
   The tower is built once at load into the arrays in 03-table.js. Rather than
   parameterise every one of those arrays through the physics and the renderer,
   a warp SWAPS THEIR CONTENTS: the array objects stay identical, so every
   `for(const w of walls)` in the codebase keeps working untouched, and the
   tower's live state (dropped targets, broken bricks, lit rollovers) survives
   the round trip because the objects themselves are stashed, not copied.
   ============================================================ */

const WORLD_ARRAYS=[walls,posts,bumpers,slings,flippers,rollovers,scoops,
                    spinners,rails,portals,magnets,bricks,dropBanks,decor,
                    kickbacks,lanes];

function snapshotWorld(){
  return{arr:WORLD_ARRAYS.map(a=>a.slice()),pw:PW,ph:PH,decks:DECKS,
         flipY:DECK_FLIP_Y.slice(),cam:{x:cam.x,y:cam.y,view:cam.view}};
}
function restoreWorld(st){
  WORLD_ARRAYS.forEach((a,i)=>{a.length=0;for(const o of st.arr[i])a.push(o);});
  PW=st.pw;PH=st.ph;DECKS=st.decks;
  for(let i=0;i<DECK_FLIP_Y.length;i++)DECK_FLIP_Y[i]=st.flipY[i]||0;
  rebuildPaths();
}
function clearWorld(){for(const a of WORLD_ARRAYS)a.length=0;}

/* the tower, exactly as built, kept so a warp can put it back */
let towerStash=null;

/* ============================================================
   Shared level construction helpers
   ============================================================ */
function ringWall(cx,cy,r,from,to,n,e){
  let px=cx+r*Math.cos(from),py=cy+r*Math.sin(from);
  for(let i=1;i<=n;i++){
    const a=lerp(from,to,i/n);
    const x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);
    W(px,py,x,y,e===undefined?0.5:e);px=x;py=y;
  }
}
/* Every level needs a pair of flippers you can actually aim with. Same blade
   length and same drain gap as the tower, so the muscle memory carries over. */
function levelFlippers(cx,py,gap,len){
  const LX=cx-gap,RX=cx+gap;
  flippers.push({px:LX,py,len,a:0.42,rest:0.42,up:-0.62,dir:1,omega:0,key:false,deck:0,side:0,main:true});
  flippers.push({px:RX,py,len,a:Math.PI-0.42,rest:Math.PI-0.42,up:Math.PI+0.62,dir:-1,omega:0,key:false,deck:0,side:1,main:true});
  slings.push({ax:LX-206,ay:py-300,bx:LX-46,by:py-200,cx:LX-192,cy:py-162,fx:0,deck:0});
  slings.push({ax:RX+206,ay:py-300,bx:RX+46,by:py-200,cx:RX+192,cy:py-162,fx:0,deck:0});
  /* guides that release the ball OVER the blade, never onto the pivot */
  W(LX-296,py-250, LX-258,py-104, 0.34);
  W(RX+296,py-250, RX+258,py-104, 0.34);
  W(LX-258,py-104, LX+70,py-42, 0.26);
  W(RX+258,py-104, RX-70,py-42, 0.26);
  DECK_FLIP_Y[0]=py;
}

/* ============================================================
   LEVEL 1 :: THE HYPNOSPIRAL — a spinning eye you fall into
   ------------------------------------------------------------
   A circular arena. Three rings of bumpers orbit at different rates and
   directions, gravity is light, and a tangential "swirl" force curls
   everything into the same rotation as the background. The ball does not fall
   so much as circle the drain of a very large, very slow whirlpool.
   ============================================================ */
let spiralRings=[];
function buildSpiral(L){
  const w=L.pw,h=L.ph,cx=w/2,cy=h*0.42,R=690;
  /* One circular wall with a gap at the bottom for the drain — deliberately a
     SINGLE wall system. The first version had a bowl and a set of aprons that
     crossed each other near the bottom right, and the ball wedged in the V
     they made. One closed curve cannot cross itself. */
  const gapA=1.955, gapB=1.187+Math.PI*2;      // 112 deg round to 68 deg
  ringWall(cx,cy,R,gapA,gapB,46,0.54);
  /* No extra outlane guides here. The first version ran one from each gap edge
     down and inwards, and it CROSSED the inlane guide that levelFlippers
     builds — the V-trap this file's own comment warns about, rebuilt in the
     same room. The arc drops the ball straight onto the inlane guide, which is
     all the room needs. */
  levelFlippers(cx,h-208,250,180);

  /* THE EYE — the whole point of the room */
  scoops.push({x:cx,y:cy,r:64,name:"THE EYE",kind:"eye",cool:0,lit:true,col:PU,deck:0});
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    P(cx+Math.cos(a)*130,cy+Math.sin(a)*130,13,i%2?CY:MG);
  }
  /* three orbiting rings, alternating direction */
  spiralRings=[
    {r:250,n:4,sp: 0.55,ph:0,   col:CY},
    {r:410,n:6,sp:-0.36,ph:0.4, col:MG},
    {r:560,n:8,sp: 0.22,ph:0.9, col:PU}
  ];
  for(const ring of spiralRings){
    ring.items=[];
    for(let i=0;i<ring.n;i++){
      const b={x:cx,y:cy,r:38,deck:0,col:ring.col,fx:0};
      bumpers.push(b);ring.items.push(b);
    }
  }
  /* rollovers around the upper rim */
  for(let i=0;i<5;i++){
    const a=Math.PI*1.16+i*(Math.PI*0.68/4);
    rollovers.push({x:cx+Math.cos(a)*(R-70),y:cy+Math.sin(a)*(R-70),r:26,lit:false,cool:-9,id:i,deck:0});
  }
  makeRail({name:"THE COIL",short:"COIL",col:MG,deck:0,
    mouth:{x:cx+R*0.72,y:cy+R*0.42,r:50},minSpd:700,exitBoost:0.95,
    pts:(()=>{const q=[];for(let i=0;i<=16;i++){
      const a=0.42+i/16*5.1, rr=R*0.9-i*7;
      q.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}return q;})()});
  spinners.push({x:cx-R*0.62,y:cy+R*0.5,r:40,ang:0,vel:0,cool:-9,col:CY,deck:0,name:"SPIN"});
  spinners.push({x:cx+R*0.62,y:cy+R*0.5,r:40,ang:0,vel:0,cool:-9,col:MG,deck:0,name:"SPIN"});
  decor.push({x:cx,y:cy+250,t:"THE HYPNOSPIRAL",s:54,c:PU,a:0.10});
  decor.push({x:cx,y:cy+312,t:"DO NOT LOOK DOWN",s:22,c:CY,a:0.12});
}
function spiralTick(dt,L){
  const cx=PW/2,cy=PH*0.42;
  for(const ring of spiralRings){
    ring.ph+=ring.sp*dt;
    ring.items.forEach((b,i)=>{
      const a=ring.ph+i/ring.n*Math.PI*2;
      b.x=cx+Math.cos(a)*ring.r;
      b.y=cy+Math.sin(a)*ring.r;
    });
  }
}

/* ============================================================
   LEVEL 2 :: THE FORGEWORKS — climb, the floor is coming up
   ------------------------------------------------------------
   A tall shaft under heavy gravity. Molten metal rises from the bottom the
   whole time you are here; touching it throws you back up in a shower of
   sparks and costs you seconds. Hitting the VENT at the top drives it back
   down. The timer IS the lava — you can see exactly how long you have left.
   ============================================================ */
let lavaY=0, lavaTarget=0, pistons=[];
function buildForge(L){
  const w=L.pw,h=L.ph,cx=w/2;
  W(50,60,50,h-330,0.46); W(w-50,60,w-50,h-330,0.46);
  W(50,60,w-50,60,0.5);
  W(50,h-330, cx-300,h-176,0.4);  W(cx-300,h-176, cx-130,h-6,0.24);
  W(w-50,h-330, cx+300,h-176,0.4);W(cx+300,h-176, cx+130,h-6,0.24);
  levelFlippers(cx,h-198,238,178);

  /* the vent at the top — three hits and the shaft cools */
  scoops.push({x:cx,y:170,r:58,name:"THE VENT",kind:"vent2",cool:0,lit:true,col:OR,deck:0});
  /* A 2,200px shaft under 1.3x gravity: without a hoist the top of it is
     scenery. Catch the rail from the lower half and it carries you up. */
  makeRail({name:"CHAIN HOIST",short:"HOIST",col:YL,deck:0,
    mouth:{x:w-190,y:1500,r:50},minSpd:640,exitBoost:0.75,
    pts:[[w-190,1500],[w-110,1240],[w-120,940],[w-210,660],[w-330,420],[cx+120,300]]});
  makeRail({name:"SLAG CHUTE",short:"CHUTE",col:RD,deck:0,
    mouth:{x:190,y:820,r:48},minSpd:520,exitBoost:1.15,
    pts:[[190,820],[110,1120],[130,1500],[260,1780],[cx-90,1960]]});
  /* stepped ledges to climb, each with a bumper to launch off */
  const steps=[[300,760],[900,640],[280,1120],[920,1000],[600,420]];
  for(let i=0;i<steps.length;i++){
    const[sx,sy]=steps[i];
    W(sx-130,sy,sx+130,sy-26,0.62);
    bumpers.push({x:sx,y:sy-92,r:44,deck:0,col:i%2?OR:YL,fx:0});
  }
  /* pistons: bars that slam out of the walls on a cycle */
  pistons=[
    {x:50, y:900, w:210,h:44,ph:0,   sp:0.75,dir:1,fx:0},
    {x:w-50,y:1240,w:210,h:44,ph:1.6,sp:0.62,dir:-1,fx:0},
    {x:50, y:1560,w:210,h:44,ph:3.1, sp:0.9, dir:1,fx:0}
  ];
  for(let i=0;i<4;i++)
    rollovers.push({x:200+i*(w-400)/3,y:h-560,r:26,lit:false,cool:-9,id:i,deck:0});
  /* Drop targets are line segments with an `up` flag, not boxes — the first
     version of this bank invented its own shape and was silently inert,
     because the collision loop skips anything without `t.up`. */
  dropBanks.push({type:"slag",word:"SLAG",resetT:0,targets:[0,1,2].map(i=>{
    const tx=cx-110+i*110, ty=1760;
    return{cx:tx,cy:ty,x1:tx-38,y1:ty,x2:tx+38,y2:ty,up:true,idx:i,fx:0};
  })});
  spinners.push({x:cx,y:2000,r:40,ang:0,vel:0,cool:-9,col:OR,deck:0,name:"BELLOWS"});
  decor.push({x:cx,y:h*0.62,t:"THE FORGEWORKS",s:50,c:OR,a:0.10});
  decor.push({x:cx,y:h*0.62+58,t:"CLIMB",s:26,c:RD,a:0.13});
  lavaY=h+120; lavaTarget=h+120;
}
function forgeTick(dt,L){
  /* the lava climbs the whole visit; the VENT pushes it back down */
  lavaTarget-=(PH*0.92/L.dur)*dt;
  lavaY=lerp(lavaY,lavaTarget,1-Math.pow(0.02,dt));
  for(const p of pistons){
    p.ph+=dt*p.sp;
    const t=(Math.sin(p.ph*Math.PI*2)+1)/2;
    p.ext=Math.pow(t,3)*p.w;
    if(p.fx>0)p.fx-=dt*3;
  }
  for(const b of balls){
    if(b.ghost||b.rail||b.scoop||b.gone)continue;
    /* pistons shove */
    for(const p of pistons){
      if(p.ext<12)continue;
      const x0=p.dir>0?p.x:p.x-p.ext, x1=p.dir>0?p.x+p.ext:p.x;
      if(b.x>x0-b.r&&b.x<x1+b.r&&Math.abs(b.y-p.y)<p.h/2+b.r){
        b.vx=p.dir*2100;b.vy-=340;
        b.x=p.dir>0?x1+b.r+2:x0-b.r-2;
        p.fx=1;SND.forgePiston();spark(b.x,b.y,10,OR,300);
        addScore(3200,b.x,b.y,{col:OR,size:20});
      }
    }
    /* the molten floor: a heat blast, not a death */
    if(b.y>lavaY-b.r){
      b.y=lavaY-b.r-4;
      b.vy=-Math.max(2400,Math.abs(b.vy)*0.9);
      b.vx+=rand(-500,500);
      lavaTarget=Math.min(PH+120,lavaTarget+120);
      SND.forgeLava();shake(9);flash(0.28,RD);
      for(let i=0;i<16;i++)parts.push({x:b.x+rand(-60,60),y:lavaY,vx:rand(-260,260),
        vy:-rand(200,800),life:rand(.3,.9),max:.9,col:Math.random()<.5?OR:YL,size:rand(2,6)});
    }
  }
}

/* ============================================================
   LEVEL 3 :: THE DEEP — everything slows down
   ------------------------------------------------------------
   A third of normal gravity with real drag, so the ball drifts rather than
   drops and you have time to think about a shot for once. Standing currents
   push it around the room, and the jellyfish breathe: their collision radius
   swells and shrinks, so the same shot is not the same shot twice.
   ============================================================ */
let jellies=[], currents=[], pearls=[];
function buildDeep(L){
  const w=L.pw,h=L.ph,cx=w/2;
  W(50,50,w-50,50,0.42);
  W(50,50,50,h-330,0.42); W(w-50,50,w-50,h-330,0.42);
  /* the walls turn into the aprons rather than meeting them at an angle */
  W(50,h-330, cx-330,h-176,0.4);  W(cx-330,h-176, cx-136,h-6,0.24);
  W(w-50,h-330, cx+330,h-176,0.4);W(cx+330,h-176, cx+136,h-6,0.24);
  levelFlippers(cx,h-198,246,182);

  scoops.push({x:cx,y:250,r:50,name:"THE MAW",kind:"maw",cool:0,lit:true,col:GR,deck:0});
  /* jellyfish — bumpers that breathe */
  jellies=[];
  const spots=[[330,560],[cx,760],[w-330,560],[430,1050],[w-430,1050],[cx,1240]];
  spots.forEach((sp,i)=>{
    const b={x:sp[0],y:sp[1],r:46,r0:46,deck:0,col:i%2?GR:IC,fx:0,ph:i*1.1};
    bumpers.push(b);jellies.push(b);
  });
  /* pearls: collect all eight and the room pays out */
  pearls=[];
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2+0.4;
    const r={x:cx+Math.cos(a)*(w*0.26),y:h*0.44+Math.sin(a)*(h*0.20),
             r:46,lit:false,cool:-9,id:i,deck:0,pearl:true};
    rollovers.push(r);pearls.push(r);
  }
  makeRail({name:"THE UPWELL",short:"RISE",col:IC,deck:0,
    mouth:{x:w-180,y:h*0.62,r:52},minSpd:420,exitBoost:0.7,
    pts:[[w-180,h*0.62],[w-110,h*0.44],[w-190,h*0.24],[cx+160,h*0.14]]});
  /* standing currents: a coarse vector field you can read off the background */
  currents=[
    {x:cx*0.55,y:h*0.34,r:400,fx: 620,fy:-260},
    {x:cx*1.45,y:h*0.34,r:400,fx:-620,fy:-260},
    {x:cx,     y:h*0.70,r:460,fx:   0,fy:-520},
    {x:cx*0.5, y:h*0.78,r:340,fx: 460,fy: 160},
    {x:cx*1.5, y:h*0.78,r:340,fx:-460,fy: 160}
  ];
  spinners.push({x:150,y:h*0.5,r:38,ang:0,vel:0,cool:-9,col:IC,deck:0,name:"KELP"});
  spinners.push({x:w-150,y:h*0.5,r:38,ang:0,vel:0,cool:-9,col:IC,deck:0,name:"KELP"});
  decor.push({x:cx,y:h*0.56,t:"THE DEEP",s:64,c:GR,a:0.09});
  decor.push({x:cx,y:h*0.56+64,t:"NO HURRY DOWN HERE",s:24,c:IC,a:0.12});
}
function deepTick(dt,L){
  for(const j of jellies){
    j.ph+=dt*1.15;
    j.r=j.r0*(1+0.24*Math.sin(j.ph));
  }
  for(const b of balls){
    if(b.ghost||b.rail||b.scoop||b.gone)continue;
    for(const c of currents){
      const d=dist(b.x,b.y,c.x,c.y);
      if(d>c.r)continue;
      const k=(1-d/c.r)*dt;
      b.vx+=c.fx*k;b.vy+=c.fy*k;
    }
  }
}

/* ============================================================
   The registry
   ============================================================ */
const LEVELS={
  spiral:{
    id:"spiral", name:"THE HYPNOSPIRAL", short:"SPIRAL", gate:"SPIRAL GATE",
    col:PU, col2:CY, dark:"#0b0326", hue:"rgba(178,107,255,",
    pw:1560, ph:1780, mult:6, dur:52,
    grav:0.58, drag:0.03, swirl:520,
    goal:3, goalText:"HIT THE EYE",
    jackpot:900000,
    build:buildSpiral, tick:spiralTick,
    voice:{
      bumper(n){tone(262*Math.pow(1.5,n%3),0.26,"sine",0.24,undefined);
        tone(524*Math.pow(1.5,n%3),0.16,"triangle",0.1);},
      sling(){sweep(900,300,0.2,0.2,"sine");},
      roll(){tone(1568,0.14,"sine",0.2,2093);},
      target(){tone(330,0.2,"sine",0.24,660);}
    }
  },
  forge:{
    id:"forge", name:"THE FORGEWORKS", short:"FORGE", gate:"FORGE GATE",
    col:OR, col2:RD, dark:"#1c0a02", hue:"rgba(255,154,31,",
    pw:1180, ph:2200, mult:7, dur:48,
    grav:1.32, drag:0, swirl:0,
    goal:3, goalText:"HIT THE VENT",
    jackpot:1100000,
    build:buildForge, tick:forgeTick,
    voice:{
      bumper(n){tone(110+n*30,0.16,"square",0.26,60+n*20);noise(0.05,0.2,1200,6000);},
      sling(){noise(0.09,0.4,700,4000);tone(150,0.07,"square",0.2,80);},
      roll(){tone(440,0.07,"square",0.2,660);},
      target(){SND.forgeHit();}
    }
  },
  deep:{
    id:"deep", name:"THE DEEP", short:"DEEP", gate:"ABYSS GATE",
    col:GR, col2:IC, dark:"#02171a", hue:"rgba(57,255,106,",
    pw:1520, ph:1900, mult:8, dur:56,
    grav:0.34, drag:0.34, swirl:0,
    goal:6, goalText:"COLLECT THE PEARLS",
    jackpot:1400000,
    build:buildDeep, tick:deepTick,
    voice:{
      bumper(n){tone(392+n*80,0.34,"sine",0.2,196+n*40);tone(1568,0.1,"sine",0.06);},
      sling(){noise(0.16,0.16,300,1400);tone(180,0.14,"sine",0.16,90);},
      roll(){SND.deepPop();},
      target(){tone(587,0.3,"sine",0.22,880);}
    }
  }
};
const LEVEL_ORDER=["spiral","forge","deep"];

/* ============================================================
   WARPING — the transition, the visit, and the way home
   ============================================================ */
/* where you arrive, and the gate you came in through */
const LEVEL_ENTRY={
  spiral:()=>({x:PW/2-400,y:PH*0.20,vx: 900,vy:  240}),
  forge: ()=>({x:PW*0.26, y:320,    vx: 700,vy:  380}),
  deep:  ()=>({x:PW*0.24, y:PH*0.26,vx: 620,vy: -160})
};
let warpGate=null;                 // the tower scoop we left through
let gateCool={spiral:0,forge:0,deep:0};
const GATE_COOLDOWN=34;

function warpAvailable(id){return !level&&warpT<=0&&gateCool[id]<=0;}

/* stage 1: the room folds in on itself */
function warpBegin(id,gateScoop){
  if(warpT>0)return;
  warpTo=id;warpDir=1;warpT=0.5;
  warpGate=gateScoop||null;
  for(const b of balls){b.scoop=null;b.hold=undefined;b.magnet=null;b.rail=null;}
  SND.warpCharge();
  flash(0.5,LEVELS[id].col);shake(14);
  announce("WARPING → "+LEVELS[id].name,LEVELS[id].col,true);
}
/* stage 2: the swap itself, at the darkest point of the transition */
function enterLevel(id){
  const L=LEVELS[id];
  towerStash=snapshotWorld();
  clearWorld();
  PW=L.pw;PH=L.ph;
  DECKS=[{id:0,name:L.name,short:L.short,y0:0,y1:L.ph,mult:L.mult,
          col:L.col,hue:L.hue,dark:L.dark}];
  for(let i=0;i<DECK_FLIP_Y.length;i++)DECK_FLIP_Y[i]=0;
  L.build(L);
  rebuildPaths();

  level=L;voice=L.voice||null;
  gravMul=L.grav;dragMul=L.drag;swirl=L.swirl||0;
  levelT=L.dur;levelProg=0;levelGoal=L.goal;levelJack=L.jackpot;levelDone=false;
  levelSaves=2;

  for(let i=balls.length-1;i>=0;i--)balls.splice(i,1);
  const e=LEVEL_ENTRY[id]();
  const b=spawnBall(e.x,e.y,e.vx,e.vy);
  b.deck=0;b.prevDeck=0;
  ballInPlunger=false;
  cam.x=PW/2;cam.y=PH*0.4;cam.view=Math.max(PH*0.6,900);
  cam.tx=cam.x;cam.ty=cam.y;cam.tview=cam.view;
  SND.warpIn();
  announce(L.name,L.col,true);
  toast(L.goalText+"  —  "+shortNum(L.jackpot),L.col2,"◆");
}
/* stage 3: back up the hole you fell down */
function leaveLevel(paid){
  if(!level)return;
  const L=level;
  gateCool[L.id]=GATE_COOLDOWN;
  level=null;voice=null;
  gravMul=1;dragMul=0;swirl=0;
  restoreWorld(towerStash);
  towerStash=null;

  for(let i=balls.length-1;i>=0;i--)balls.splice(i,1);
  const g=warpGate&&scoopBy(warpGate)||null;
  const x=g?g.x:830, y=g?g.y:2200;
  /* Clear of the mouth, not in it. Returning the ball 30px above the gate put
     it straight back inside the capture radius, so the gate swallowed the ball
     it had just spat out — over and over, which is what a player sees as the
     ball being stuck on the hole. The gate also gets a moment to close. */
  const b=spawnBall(x,y-140,rand(-420,420),-rand(1900,2400));
  if(g)g.cool=Math.max(g.cool,2.5);
  b.deck=deckAt(b.y).id;b.prevDeck=b.deck;
  ballInPlunger=false;
  ballSaveT=Math.max(ballSaveT,6);
  cam.x=x;cam.y=y;cam.tx=x;cam.ty=y;
  SND.warpOut();
  if(paid)announce("BACK FROM "+L.short,L.col,false);
  else{announce("THE "+L.short+" SPAT YOU OUT",L.col2,false);SND.levelEnd();}
}
function warpExit(paid){
  if(!level||warpT>0)return;
  warpDir=-1;warpT=0.5;warpTo=null;
  flash(0.45,level.col);shake(12);
}

/* the objective, scored */
function levelScore(){
  levelProg++;
  const L=level;
  if(levelProg<levelGoal){
    const p=addScore(Math.round(L.jackpot*0.16),PW/2,PH*0.4,{col:L.col2,size:30});
    announce(L.goalText+"  "+levelProg+"/"+levelGoal,L.col2,true);
    floatText(PW/2,PH*0.4-60,"+"+shortNum(p),L.col2,26);
    return;
  }
  if(levelDone){
    const p=addScore(Math.round(L.jackpot*0.4),PW/2,PH*0.4,{col:YL,size:34});
    announce("SUPER "+L.short+" +"+shortNum(p),YL,true);
    return;
  }
  levelDone=true;
  const p=addScore(L.jackpot,PW/2,PH*0.4,{col:YL,size:46});
  announce(L.short+" JACKPOT  +"+shortNum(p),YL,true);
  SND.levelJack();flash(0.7,YL);shake(20);
  stats.warps=(stats.warps||0)+1;
  levelT=Math.max(levelT,14);            // a victory lap
  unlock("warped","THROUGH THE LOOKING GLASS","Cleared a warp machine");
}

/* per-frame: transition stages, the visit clock, the room's own animation */
function levelTick(dt){
  for(const k in gateCool)if(gateCool[k]>0)gateCool[k]-=dt;

  if(warpT>0){
    warpT-=dt;
    if(warpT<=0){
      if(warpDir===1&&warpTo){enterLevel(warpTo);warpTo=null;warpDir=2;warpT=0.42;}
      else if(warpDir===-1){leaveLevel(true);warpDir=2;warpT=0.42;}
      else{warpDir=0;warpT=0;}
    }
    return;
  }
  if(!level)return;
  if(!levelHold)levelT-=dt;
  level.tick(dt,level);
  if(levelT<=0){warpExit(false);return;}
  if(levelT<6&&Math.floor(levelT+dt)!==Math.floor(levelT))SND.tick();
}
/* The tower's drain rule does not apply down here. A warp is a reward, so the
   room hands the ball back twice before it gives up on you — otherwise a bad
   bounce ten seconds in wastes the whole visit and the gate's cooldown. */
function levelDrain(){
  if(!level)return false;
  if(levelHold||levelSaves>0){          // levelHold: the test harness keeps the room open
    if(!levelHold)levelSaves--;
    const e=LEVEL_ENTRY[level.id]();
    const b=spawnBall(e.x,e.y,e.vx,e.vy);
    b.deck=0;b.prevDeck=0;
    if(!levelHold){SND.save();flash(0.35,level.col2);
      announce("THE ROOM KEEPS YOU  ("+levelSaves+" left)",level.col2,false);}
    return true;
  }
  warpExit(false);
  return true;
}
