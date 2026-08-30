/* ============================================================
   p3 :: WORLD GEOMETRY — the five-deck tower
   ============================================================ */

const walls=[],posts=[],bumpers=[],slings=[],flippers=[],rollovers=[],scoops=[],
      spinners=[],rails=[],portals=[],magnets=[],bricks=[],dropBanks=[],decor=[],
      kickbacks=[],lanes=[];

function W(x1,y1,x2,y2,e,ow){walls.push({x1,y1,x2,y2,e:e===undefined?0.42:e,ow:ow||null});}
function P(x,y,r,col){posts.push({x,y,r,col:col||WH});}

/* ---------- separator definitions (deck floors) ----------
   Each floor has three openings: a left chute, a centre hole guarded by that
   deck's flipper pair, and a right chute. Fall down a chute and you lose a
   floor; fall through the centre and you missed the flippers.            */
const SEPS=[
  {y:2410, cx:[720,960],  lx:[250,400],  rx:[1260,1410], deck:1},
  {y:1860, cx:[700,940],  lx:[200,350],  rx:[1310,1460], deck:2},
  {y:1250, cx:[730,970],  lx:[230,380],  rx:[1280,1430], deck:3},
  {y:640,  cx:[710,950],  lx:[290,430],  rx:[1230,1370], deck:4}
];

/* ---------- outer shell ---------- */
(function shell(){
  const cx=830,cy=250,rx=770,ry=200,N=22;
  let px=cx-rx,py=cy;
  for(let i=1;i<=N;i++){
    const th=Math.PI-(Math.PI*i/N);
    const x=cx+rx*Math.cos(th), y=cy-ry*Math.sin(th);
    W(px,py,x,y,0.48);px=x;py=y;
  }
  W(60,250,60,2600,0.46);
  W(1600,250,1600,2600,0.46);
})();

/* ---------- separators + per-deck flipper kits ---------- */
function buildSeparator(s){
  const y=s.y,[c0,c1]=s.cx,[l0,l1]=s.lx,[r0,r1]=s.rx;
  const col=DECKS[s.deck].col;
  W(60,y-26, l0,y+12, 0.34);
  W(l1,y-30, c0-120,y+6, 0.34);
  W(c1+120,y+6, r0,y-30,0.34);
  W(r1,y+12, 1600,y-26,0.34);
}
function buildFlipperKit(s){
  const y=s.y,[c0,c1]=s.cx,d=s.deck,col=DECKS[d].col;
  const LX=c0-120, RX=c1+120, PY=y-72, LEN=172;
  flippers.push({px:LX,py:PY,len:LEN,a:0.42,rest:0.42,up:-0.60,dir:1,omega:0,key:false,deck:d,side:0});
  flippers.push({px:RX,py:PY,len:LEN,a:Math.PI-0.42,rest:Math.PI-0.42,up:Math.PI+0.60,dir:-1,omega:0,key:false,deck:d,side:1});
  // slingshots
  slings.push({ax:LX-210,ay:PY-320,bx:LX-46,by:PY-210,cx:LX-196,cy:PY-170,fx:0,deck:d});
  slings.push({ax:RX+210,ay:PY-320,bx:RX+46,by:PY-210,cx:RX+196,cy:PY-170,fx:0,deck:d});
  // lane guides: outer rail, then an inlane floor that releases the ball
  // OVER the blade (never onto the pivot, which is a dead spot)
  W(LX-300,PY-260, LX-262,PY-110, 0.34);
  W(RX+300,PY-260, RX+262,PY-110, 0.34);
  W(LX-262,PY-110, LX+70,PY-46, 0.26);
  W(RX+262,PY-110, RX-70,PY-46, 0.26);
  // inlane rollovers
  lanes.push({x:LX-140,y:PY-104,r:28,id:d*2,lit:false,cool:-9,deck:d,minor:true});
  lanes.push({x:RX+140,y:PY-104,r:28,id:d*2+1,lit:false,cool:-9,deck:d,minor:true});
}
SEPS.forEach(s=>{buildSeparator(s);buildFlipperKit(s);});

/* ---------- DECK 0 :: THE GUTTER ---------- */
(function gutter(){
  // outlanes, aprons, and inlane feeds (mirrored about x=830)
  W(60,2600,230,2818,0.4);    W(230,2818,702,2888,0.22);
  W(1600,2600,1430,2818,0.4); W(1430,2818,958,2888,0.22);
  W(340,2450,430,2680,0.35);  W(1320,2450,1230,2680,0.35);
  W(430,2680,680,2716,0.26);  W(1230,2680,980,2716,0.26);

  const PY=2766,LEN=192;
  flippers.push({px:580,py:PY,len:LEN,a:0.42,rest:0.42,up:-0.62,dir:1,omega:0,key:false,deck:0,side:0,main:true});
  flippers.push({px:1080,py:PY,len:LEN,a:Math.PI-0.42,rest:Math.PI-0.42,up:Math.PI+0.62,dir:-1,omega:0,key:false,deck:0,side:1,main:true});
  slings.push({ax:488,ay:2470,bx:654,by:2578,cx:504,cy:2620,fx:0,deck:0});
  slings.push({ax:1172,ay:2470,bx:1006,by:2578,cx:1156,cy:2620,fx:0,deck:0});
  kickbacks.push({x:168,y:2716,r:36,side:0,name:"KICKBACK"});
  kickbacks.push({x:1492,y:2716,r:36,side:1,name:"KICKBACK"});
  lanes.push({x:448,y:2640,r:32,id:0,lit:false,cool:-9,deck:0});
  lanes.push({x:1212,y:2640,r:32,id:1,lit:false,cool:-9,deck:0});
  decor.push({x:830,y:2560,t:"THE GUTTER",s:46,c:CY,a:0.10});
  decor.push({x:830,y:2618,t:"x1  ALTITUDE",s:22,c:CY,a:0.13});
})();

/* ---------- DECK 1 :: NEON BAZAAR ---------- */
(function bazaar(){
  const bank={targets:[],word:CHAOS_WORD,type:"chaos",resetT:0};
  for(let i=0;i<5;i++){
    const t=i/4, cx=190+t*250, cy=2000+t*206;
    const dx=0.78,dy=-0.63,h=34;
    bank.targets.push({cx,cy,x1:cx-dx*h,y1:cy-dy*h,x2:cx+dx*h,y2:cy+dy*h,up:true,idx:i,fx:0});
  }
  dropBanks.push(bank);
  bumpers.push({x:1088,y:2010,r:46,deck:1,col:GR,fx:0});
  bumpers.push({x:1226,y:2094,r:46,deck:1,col:YL,fx:0});
  bumpers.push({x:1088,y:2178,r:46,deck:1,col:MG,fx:0});
  P(1158,2010,14,MG);P(1158,2178,14,MG);
  scoops.push({x:1466,y:1958,r:40,name:"MYSTERY",kind:"mystery",cool:0,lit:true,col:PU,deck:1});
  spinners.push({x:132,y:2010,r:38,ang:0,vel:0,cool:-9,col:CY,deck:1,name:"BAZAAR SPIN"});
  W(60,2100,152,2250,0.4);
  [420,620,830,1040,1240].forEach((x,i)=>{
    rollovers.push({x,y:1944,r:30,id:i,group:"storm",cool:-9,deck:1});
  });
  [520,725,935,1140].forEach(x=>P(x,1944,11,CY));
  decor.push({x:830,y:2280,t:"NEON BAZAAR",s:42,c:MG,a:0.10});
  decor.push({x:830,y:2330,t:"x2",s:26,c:MG,a:0.13});
})();

/* ---------- DECK 2 :: THE FOUNDRY ---------- */
(function foundry(){
  const cols=8,rows=3,bw=52,bh=40,gx=7,gy=9,x0=150,y0=1330;
  const bcol=[RD,OR,YL];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
    bricks.push({x:x0+c*(bw+gx),y:y0+r*(bh+gy),w:bw,h:bh,alive:true,col:bcol[r],fx:0,row:r,col_:c});
  decor.push({x:x0+cols*(bw+gx)/2-4,y:1306,t:"SMELTER WALL",s:22,c:OR,a:0.32});
  magnets.push({x:830,y:1640,r:96,name:"FORGE",col:OR,state:"idle",t:0,ball:null,deck:2,cool:0,lit:false});
  scoops.push({x:868,y:1316,r:40,name:"LOCK",kind:"lock",cool:0,lit:false,col:PU,deck:2});
  const bank={targets:[],word:["C","R","Y"],type:"cryo",resetT:0};
  [0,1,2].forEach(i=>{
    const cx=1276+i*84, cy=1580;
    bank.targets.push({cx,cy,x1:cx-32,y1:cy,x2:cx+32,y2:cy,up:true,idx:i,fx:0});
  });
  dropBanks.push(bank);
  spinners.push({x:1136,y:1330,r:38,ang:0,vel:0,cool:-9,col:OR,deck:2,name:"FORGE SPIN"});
  bumpers.push({x:1490,y:1300,r:42,deck:2,col:OR,fx:0});
  bumpers.push({x:1490,y:1424,r:42,deck:2,col:CY,fx:0});
  decor.push({x:830,y:1720,t:"THE FOUNDRY",s:42,c:OR,a:0.10});
  decor.push({x:830,y:1770,t:"x3",s:26,c:OR,a:0.13});
})();

/* ---------- DECK 3 :: STORM SPINE ---------- */
(function spine(){
  const nest=[[830,860],[700,940],[960,940],[770,1050],[890,1050]];
  const ncol=[PU,CY,MG,GR,YL];
  nest.forEach((p,i)=>bumpers.push({x:p[0],y:p[1],r:48,deck:3,col:ncol[i],fx:0}));
  scoops.push({x:286,y:790,r:44,name:"MISSION",kind:"mission",cool:0,lit:true,col:GR,deck:3});
  scoops.push({x:1180,y:722,r:38,name:"VENT",kind:"vent",cool:0,lit:false,col:RD,deck:3});
  scoops.push({x:1420,y:830,r:42,name:"CANNON",kind:"cannon",cool:0,lit:true,col:YL,deck:3});
  magnets.push({x:520,y:1000,r:92,name:"CORE",col:PU,state:"idle",t:0,ball:null,deck:3,cool:0,lit:false});
  spinners.push({x:150,y:1090,r:40,ang:0,vel:0,cool:-9,col:PU,deck:3,name:"SPINE SPIN"});
  const bank={targets:[],word:["I","O","N"],type:"ion",resetT:0};
  [0,1,2].forEach(i=>{
    const cx=1096+i*82,cy=1140;
    bank.targets.push({cx,cy,x1:cx-30,y1:cy,x2:cx+30,y2:cy,up:true,idx:i,fx:0});
  });
  dropBanks.push(bank);
  W(60,700,182,782,0.4);
  W(1600,700,1478,782,0.4);
  decor.push({x:830,y:1190,t:"STORM SPINE",s:42,c:PU,a:0.10});
  decor.push({x:830,y:1236,t:"x5",s:26,c:PU,a:0.13});
})();

/* ---------- DECK 4 :: THE CROWN ---------- */
(function crown(){
  bumpers.push({x:250,y:430,r:44,deck:4,col:YL,fx:0});
  bumpers.push({x:1410,y:430,r:44,deck:4,col:YL,fx:0});
  scoops.push({x:830,y:466,r:46,name:"CROWN",kind:"crown",cool:0,lit:true,col:YL,deck:4});
  scoops.push({x:830,y:132,r:38,name:"ROD",kind:"rod",cool:0,lit:true,col:IC,deck:4});
  rollovers.push({x:470,y:556,r:28,id:5,group:"crown",cool:-9,deck:4});
  rollovers.push({x:1190,y:556,r:28,id:6,group:"crown",cool:-9,deck:4});
  decor.push({x:830,y:612,t:"THE CROWN",s:40,c:YL,a:0.10});
  decor.push({x:830,y:230,t:"x8",s:30,c:YL,a:0.10});
})();

/* ---------- slingshot normals ---------- */
slings.forEach(s=>{
  const dx=s.bx-s.ax,dy=s.by-s.ay,l=Math.hypot(dx,dy);
  s.nx=-dy/l;s.ny=dx/l;
  if(s.nx*(s.cx-s.ax)+s.ny*(s.cy-s.ay)>0){s.nx=-s.nx;s.ny=-s.ny;}
});

/* ---------- RAILS (habitrails) ---------- */
function makeRail(o){
  const pts=o.pts,seg=[],cum=[0];
  let total=0;
  for(let i=0;i<pts.length-1;i++){
    const d=dist(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]);
    seg.push(d);total+=d;cum.push(total);
  }
  rails.push(Object.assign({pts,seg,cum,total,fx:0,hits:0},o));
}
makeRail({name:"SKY RAMP",short:"SKY",col:CY,
  mouth:{x:1450,y:2172,r:46},minSpd:820,exitBoost:0.9,
  pts:[[1450,2172],[1540,2032],[1548,1884],[1470,1772],[1330,1712]]});
makeRail({name:"FOUNDRY LIFT",short:"LIFT",col:OR,
  mouth:{x:684,y:1442,r:46},minSpd:780,exitBoost:0.9,
  pts:[[684,1442],[500,1392],[350,1272],[310,1122],[392,1012],[534,972]]});
makeRail({name:"GRAND ORBIT",short:"ORBIT",col:PU,
  mouth:{x:1500,y:1116,r:46},minSpd:900,exitBoost:1.0,
  pts:[[1500,1116],[1566,952],[1550,700],[1436,392],[1160,176],[830,116],[506,176],[236,392],[178,650],[300,790]]});
makeRail({name:"THE PLUNGE",short:"PLUNGE",col:RD,
  mouth:{x:1470,y:242,r:46},minSpd:520,exitBoost:1.25,
  pts:[[1470,242],[1532,520],[1520,900],[1380,1400],[1120,1820],[930,2050]]});

/* ---------- LAUNCH LANE (a rail with selectable exits) ---------- */
const LAUNCH_PATH=[[1664,2856],[1664,2400],[1664,1860],[1664,1250],[1664,700],[1652,420],[1560,220],[1380,132]];
const LAUNCH_EXITS=[
  {t:0.10, x:1546,y:2520, vx:-320,vy:-620, deck:0},
  {t:0.32, x:1544,y:2000, vx:-430,vy:-760, deck:1},
  {t:0.55, x:1544,y:1392, vx:-450,vy:-780, deck:2},
  {t:0.76, x:1544,y:800,  vx:-470,vy:-720, deck:3},
  {t:1.00, x:1356,y:158,  vx:-640,vy:190,  deck:4}
];
const launchRail=(()=>{
  const seg=[],cum=[0];let total=0;
  for(let i=0;i<LAUNCH_PATH.length-1;i++){
    const d=dist(LAUNCH_PATH[i][0],LAUNCH_PATH[i][1],LAUNCH_PATH[i+1][0],LAUNCH_PATH[i+1][1]);
    seg.push(d);total+=d;cum.push(total);
  }
  return{pts:LAUNCH_PATH,seg,cum,total};
})();

/* ---------- PORTALS ---------- */
portals.push({a:{x:830,y:2126},b:{x:1512,y:1440},r:40,cool:0,col:MG,name:"WARP I"});
portals.push({a:{x:1544,y:930}, b:{x:624,y:158}, r:40,cool:0,col:CY,name:"WARP II"});

/* ---------- helper: point on a polyline ---------- */
function pathPoint(rail,d){
  d=clamp(d,0,rail.total);
  let i=0;
  while(i<rail.seg.length-1&&rail.cum[i+1]<d)i++;
  const local=(d-rail.cum[i])/(rail.seg[i]||1);
  const a=rail.pts[i],b=rail.pts[i+1];
  return{
    x:lerp(a[0],b[0],local), y:lerp(a[1],b[1],local),
    tx:(b[0]-a[0])/(rail.seg[i]||1), ty:(b[1]-a[1])/(rail.seg[i]||1)
  };
}
/* which y each deck's flippers sit at — the camera leans toward these */
const DECK_FLIP_Y=[0,0,0,0,0];
flippers.forEach(f=>{DECK_FLIP_Y[f.deck]=f.py;});

const scoopBy=n=>scoops.find(s=>s.name===n);
const railBy=n=>rails.find(r=>r.name===n);
