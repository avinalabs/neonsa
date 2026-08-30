/* ============================================================
   p4 :: CAMERA + PHYSICS
   ============================================================ */

const cam={x:830,y:2600,view:1000,tx:830,ty:2600,tview:1000,shx:0,shy:0,kick:0};
const VIEW_MIN=760,VIEW_MAX=2300;

/* The world is drawn into a "play window" that excludes the HUD bands, so
   nothing the game draws can ever end up underneath a panel — the flippers
   in particular. playTop()/hudBottomH() live in p8 with the HUD.        */
function playTop(){return hudTopH();}
function playH(){return Math.max(160,VH-playTop()-hudBottomH());}
function camScale(){return playH()/cam.view;}
function camAspect(){return VW/Math.max(playH(),1);}
function w2s(x,y){
  const s=camScale();
  return{x:(x-cam.x)*s+VW/2+cam.shx, y:(y-cam.y)*s+playTop()+playH()/2+cam.shy};
}
function s2w(sx,sy){
  const s=camScale();
  return{x:(sx-VW/2-cam.shx)/s+cam.x, y:(sy-playTop()-playH()/2-cam.shy)/s+cam.y};
}
function focusBall(){
  let best=null,bs=-1;
  for(const b of balls){
    if(b.ghost)continue;
    let sc=0;
    if(b.inLane)sc+=2e6;
    if(b.gold)sc+=1e6;
    if(b.rail)sc+=4e5;
    if(b.scoop)sc+=1e5;
    sc+=Math.hypot(b.vx,b.vy);
    sc+=(2900-b.y)*0.4;
    if(sc>bs){bs=sc;best=b;}
  }
  return best;
}
function updateCamera(dt){
  const aspect=camAspect();
  const TIGHT=VW<700;                   // phone-shaped: prioritise a steady frame
  const OVER=420;                       // how far past the table edge the camera may look

  if(camMode==="overview"){
    cam.tx=PW/2;cam.ty=PH/2;
    cam.tview=Math.max(PH*1.04, PW*1.04/aspect);
  }else{
    const live=balls.filter(b=>!b.gone&&!b.ghost);
    const lane=live.find(b=>b.inLane&&b.launchT<0);
    if(lane&&ballInPlunger){
      /* SERVE: keep the ball, the lane and its floor markers comfortably framed */
      cam.tview=clamp(Math.max(1180, 720/Math.max(aspect,0.01)),VIEW_MIN,1750);
      cam.tx=lane.x-Math.min(300,cam.tview*aspect*0.22);
      cam.ty=lane.y-Math.min(320,cam.tview*0.22);
    }else if(live.length>1){
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      for(const b of live){x0=Math.min(x0,b.x);x1=Math.max(x1,b.x);y0=Math.min(y0,b.y);y1=Math.max(y1,b.y);}
      const f=focusBall();
      const spanY=(y1-y0)+460, spanX=((x1-x0)+460)/Math.max(aspect,0.01);
      const v=Math.max(spanY,spanX);
      if(v>VIEW_MAX*1.05&&f){cam.tx=f.x;cam.ty=f.y;cam.tview=VIEW_MAX*0.78;}
      else{cam.tx=(x0+x1)/2;cam.ty=(y0+y1)/2;cam.tview=clamp(v,VIEW_MIN+180,VIEW_MAX);}
    }else{
      const b=live[0];
      if(b){
        const sp=Math.hypot(b.vx,b.vy);
        let tx=b.x+clamp(b.vx*0.12,-300,300);
        let ty=b.y+clamp(b.vy*0.12,-340,340);
        let tv=clamp(VIEW_MIN+Math.min(sp*0.12,300)+(b.rail?180:0),VIEW_MIN,1560);
        /* As the ball drops toward the flippers of whatever deck it is on,
           lean the shot into frame so you can aim instead of guessing. */
        const fy=DECK_FLIP_Y[b.deck];
        if(fy&&b.y<fy&&b.vy>-260){
          const t=clamp((b.y-(fy-1150))/1150,0,1);
          ty=lerp(ty,fy-210,t*0.62);
          tv=Math.max(tv,Math.min(TIGHT?1180:1340,(fy+170-b.y)+430));
        }
        cam.tx=tx;cam.ty=ty;cam.tview=tv;
      }
    }
    if(boss.active&&boss.hp>0&&balls.some(b=>b.y<900))cam.tview=Math.max(cam.tview,1120);
  }
  /* Narrow windows and phones must still see a usable slice of the table's
     width — and on a phone the zoom is held inside a narrow band, because a
     view that swings between extremes reads as the camera misbehaving. */
  const minW=(TIGHT?820:640)/Math.max(aspect,0.01);
  cam.tview=Math.max(cam.tview,minW);
  if(TIGHT&&camMode!=="overview")cam.tview=Math.min(cam.tview,minW*1.22);
  cam.tview=clamp(cam.tview,VIEW_MIN,camMode==="overview"?99999:VIEW_MAX);

  const halfV=cam.tview/2, halfH=cam.tview*aspect/2;
  if(halfV*2<PH+OVER)cam.ty=clamp(cam.ty,halfV-OVER,PH-halfV+OVER);else cam.ty=PH/2;
  if(halfH*2<PW+OVER)cam.tx=clamp(cam.tx,halfH-OVER,PW-halfH+OVER);else cam.tx=PW/2;

  const k=1-Math.pow(0.0011,dt);
  cam.x=lerp(cam.x,cam.tx,k);
  cam.y=lerp(cam.y,cam.ty,k);
  const wantView=cam.tview*(1-cam.kick*0.15);
  if(Math.abs(wantView-cam.view)>cam.view*0.012)
    cam.view=lerp(cam.view,wantView,1-Math.pow(TIGHT?0.10:0.03,dt));
  cam.kick*=Math.pow(0.02,dt);

  /* Hard guarantee: whatever the smoothing was doing, the ball you are
     playing stays inside the middle of the play window. */
  if(camMode!=="overview"&&(state==="PLAY"||state==="BONUS")){
    const f=focusBall();
    if(f){
      const s=camScale(),vpT=playTop(),vpH=playH();
      const sx=(f.x-cam.x)*s+VW/2;
      const sy=(f.y-cam.y)*s+vpT+vpH/2;
      const mx=Math.max(48,VW*0.17), my=Math.max(48,vpH*0.17);
      if(sx<mx)cam.x+=(sx-mx)/s;
      else if(sx>VW-mx)cam.x+=(sx-(VW-mx))/s;
      if(sy<vpT+my)cam.y+=(sy-(vpT+my))/s;
      else if(sy>vpT+vpH-my)cam.y+=(sy-(vpT+vpH-my))/s;
    }
  }
  if(shakeMag>0.3){
    cam.shx=rand(-shakeMag,shakeMag);cam.shy=rand(-shakeMag,shakeMag);
  }else{cam.shx=0;cam.shy=0;}
}

/* ---------- gravity vector (missions can bend it) ---------- */
let gravAng=Math.PI/2, gravTarget=Math.PI/2, windX=0, windTarget=0, windT=0;
function gravX(){return Math.cos(gravAng)*G;}
function gravY(){return Math.sin(gravAng)*G;}

/* ---------- ball factory ---------- */
let ballIdSeq=0;
function spawnBall(x,y,vx,vy,opt){
  const b=Object.assign({
    id:++ballIdSeq,x,y,vx,vy,r:BALLR,trail:[],
    rail:null,railD:0,railSpd:0,railRail:null,
    scoop:null,scoopT:0,magnet:null,
    deck:deckAt(y).id,prevDeck:deckAt(y).id,
    gold:false,plasma:0,phase:0,shield:false,heavy:0,ghost:false,
    still:0,stuckLv:0,spawnT:timeSec,gone:false,inLane:false,launchT:-1
  },opt||{});
  balls.push(b);
  return b;
}

/* ---------- collision helpers ---------- */
function bounceLine(b,x1,y1,x2,y2,e,pad,ow){
  const c=closestSeg(b.x,b.y,x1,y1,x2,y2);
  let nx=b.x-c.x,ny=b.y-c.y,d=Math.hypot(nx,ny);
  const rr=b.r+(pad||0);
  if(d<rr&&d>0.0001){
    nx/=d;ny/=d;
    if(ow&&(b.vx*ow.nx+b.vy*ow.ny)>=0)return null;
    b.x=c.x+nx*rr;b.y=c.y+ny*rr;
    const vn=b.vx*nx+b.vy*ny;
    if(vn<0){
      b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;
      return{nx,ny,vn,cx:c.x,cy:c.y};
    }
  }
  return null;
}
function bounceCircle(b,cx,cy,cr,e,jitter){
  let nx=b.x-cx,ny=b.y-cy,d=Math.hypot(nx,ny);
  const rr=b.r+cr;
  if(d<rr&&d>0.0001){
    nx/=d;ny/=d;
    if(jitter){
      const j=rand(-jitter,jitter),cs=Math.cos(j),sn=Math.sin(j);
      const ax=nx*cs-ny*sn, ay=nx*sn+ny*cs;nx=ax;ny=ay;
    }
    b.x=cx+nx*rr;b.y=cy+ny*rr;
    const vn=b.vx*nx+b.vy*ny;
    if(vn<0){b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;}
    return{nx,ny,vn};
  }
  return null;
}
function pointInTri(px,py,A,B,C){
  const d1=(B[0]-A[0])*(py-A[1])-(B[1]-A[1])*(px-A[0]);
  const d2=(C[0]-B[0])*(py-B[1])-(C[1]-B[1])*(px-B[0]);
  const d3=(A[0]-C[0])*(py-C[1])-(A[1]-C[1])*(px-C[0]);
  const neg=(d1<0)||(d2<0)||(d3<0), pos=(d1>0)||(d2>0)||(d3>0);
  return !(neg&&pos);
}
function circleRect(b,rx,ry,rw,rh){
  const nx=clamp(b.x,rx,rx+rw), ny=clamp(b.y,ry,ry+rh);
  const dx=b.x-nx,dy=b.y-ny,d2=dx*dx+dy*dy;
  if(d2<b.r*b.r){
    let d=Math.sqrt(d2);
    let ux,uy;
    if(d<0.0001){
      const cxr=rx+rw/2,cyr=ry+rh/2;
      ux=b.x<cxr?-1:1;uy=0;d=0.001;
    }else{ux=dx/d;uy=dy/d;}
    return{ux,uy,d};
  }
  return null;
}

/* ============================================================
   MAIN PHYSICS STEP
   ============================================================ */
function stepFlippers(dt){
  const boost=surgeT>0?1.35:1;
  for(const f of flippers){
    const target=f.key?f.up:f.rest;
    const spd=(f.key?24:13)*boost;
    const prev=f.a;
    f.a+=clamp(target-f.a,-spd*dt,spd*dt);
    f.omega=(f.a-prev)/dt;
    if(Math.abs(f.a-target)<0.008)f.omega*=0.2;
  }
}
const tipX=f=>f.px+f.len*Math.cos(f.a);
const tipY=f=>f.py+f.len*Math.sin(f.a);

function physics(dt){
  for(let bi=balls.length-1;bi>=0;bi--){
    const b=balls[bi];
    if(b.gone){balls.splice(bi,1);continue;}

    /* ---- rail ride ---- */
    if(b.rail){
      const R=b.rail;
      b.railD+=b.railSpd*dt;
      const p=pathPoint(R,b.railD);
      b.x=p.x;b.y=p.y;b.vx=p.tx*b.railSpd;b.vy=p.ty*b.railSpd;
      R.fx=1;
      if(Math.random()<dt*46)parts.push({x:b.x+rand(-8,8),y:b.y+rand(-8,8),vx:rand(-40,40),vy:rand(-40,40),
        life:rand(.2,.45),max:.45,col:R.col,size:rand(2,4)});
      if(b.railD>=R.total){
        const spd=Math.max(b.railSpd*R.exitBoost,980);
        b.vx=p.tx*spd;b.vy=p.ty*spd;
        b.x=p.x+p.tx*6;b.y=p.y+p.ty*6;
        b.rail=null;
        onRailExit(b,R);
      }
      pushTrail(b);continue;
    }

    /* ---- launch lane ride ---- */
    if(b.launchT>=0){
      b.railD+=b.railSpd*dt;
      const p=pathPoint(launchRail,b.railD);
      b.x=p.x;b.y=p.y;
      const ex=LAUNCH_EXITS[b.launchDeck];
      if(b.railD>=launchRail.total*ex.t){
        b.launchT=-1;b.inLane=false;
        b.x=ex.x;b.y=ex.y;
        const k=0.75+b.launchPow*0.55;
        b.vx=ex.vx*k;b.vy=ex.vy*k;
        onLaneExit(b,ex.deck);
      }
      pushTrail(b);continue;
    }

    /* ---- held by magnet ---- */
    if(b.magnet){
      const m=b.magnet;
      b.x=lerp(b.x,m.x,1-Math.pow(0.001,dt));
      b.y=lerp(b.y,m.y,1-Math.pow(0.001,dt));
      b.vx*=0.2;b.vy*=0.2;
      pushTrail(b);continue;
    }

    /* ---- in a scoop ---- */
    if(b.scoop){
      b.scoopT+=dt;
      b.x=lerp(b.x,b.scoop.x,1-Math.pow(0.004,dt));
      b.y=lerp(b.y,b.scoop.y,1-Math.pow(0.004,dt));
      b.vx=0;b.vy=0;
      if(b.scoop.kind==="cannon"){
        if(cannon.firing){/* handled in game logic */}
      }
      pushTrail(b);continue;
    }

    /* ---- parked in the shooter lane ---- */
    if(b.inLane&&b.launchT<0){
      b.x=LAUNCH_PATH[0][0];
      b.y=LAUNCH_PATH[0][1]+plungerCharge*46;
      b.vx=0;b.vy=0;b.still=0;
      pushTrail(b);continue;
    }

    /* ---- free flight ---- */
    b.vx+=(gravX()+windX)*dt;
    b.vy+=gravY()*dt;
    if(b.plasma>0)b.vy-=140*dt;                       // plasma balls float a touch
    const sp0=Math.hypot(b.vx,b.vy);
    if(sp0>VMAX){b.vx*=VMAX/sp0;b.vy*=VMAX/sp0;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    pushTrail(b);

    /* magnets attract */
    for(const m of magnets){
      if(m.state!=="pull"&&m.state!=="hold")continue;
      const d=dist(b.x,b.y,m.x,m.y);
      if(d<m.r*3.4&&d>1){
        const f=clamp(3400*(1-d/(m.r*3.4)),0,3400);
        b.vx+=(m.x-b.x)/d*f*dt;b.vy+=(m.y-b.y)/d*f*dt;
      }
      if(m.state==="pull"&&d<m.r*0.55&&!b.magnet){
        m.state="hold";m.t=0;m.ball=b;b.magnet=m;
        SND.magnet();ring(m.x,m.y,m.col,20,m.r*1.6);
      }
    }

    /* ---- walls ---- */
    for(const w of walls){
      const h=bounceLine(b,w.x1,w.y1,w.x2,w.y2,w.e,0,w.ow);
      if(h&&h.vn<-620)noise(0.022,Math.min(0.13,-h.vn/9000),800);
    }

    /* ---- posts ---- */
    for(const p of posts)bounceCircle(b,p.x,p.y,p.r,0.86);

    /* ---- slingshots (solid triangles; eject if ever pushed inside) ---- */
    for(const s of slings){
      const A=[s.ax,s.ay],B=[s.bx,s.by],C=[s.cx,s.cy];
      if(pointInTri(b.x,b.y,A,B,C)){
        let best=null,bd=1e9;
        for(const e of [[A,B],[B,C],[C,A]]){
          const cp=closestSeg(b.x,b.y,e[0][0],e[0][1],e[1][0],e[1][1]);
          const d=Math.hypot(b.x-cp.x,b.y-cp.y);
          if(d<bd){bd=d;best=cp;}
        }
        const gx=(s.ax+s.bx+s.cx)/3, gy=(s.ay+s.by+s.cy)/3;
        let ux=best.x-gx, uy=best.y-gy;
        const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
        b.x=best.x+ux*(b.r+3); b.y=best.y+uy*(b.r+3);
        b.vx=ux*760; b.vy=uy*760-200;
        onSling(s,best.x,best.y);
        continue;
      }
      const h=bounceLine(b,s.ax,s.ay,s.bx,s.by,0.55,3);
      if(h){
        b.vx+=h.nx*820;b.vy+=h.ny*820-160;
        onSling(s,h.cx,h.cy);
      }
      bounceLine(b,s.bx,s.by,s.cx,s.cy,0.45,2);
      bounceLine(b,s.cx,s.cy,s.ax,s.ay,0.45,2);
    }

    /* ---- bumpers ---- */
    for(const bp of bumpers){
      const h=bounceCircle(b,bp.x,bp.y,bp.r,1.0,0.2);
      if(h){
        const along=b.vx*h.nx+b.vy*h.ny;
        const want=superBumperT>0?1450:1080;
        if(along<want){b.vx+=h.nx*(want-along);b.vy+=h.ny*(want-along);}
        onBumper(bp,b);
      }
    }

    /* ---- bricks ---- */
    if(b.phase<=0){
      for(const br of bricks){
        if(!br.alive)continue;
        const c=circleRect(b,br.x,br.y,br.w,br.h);
        if(c){
          b.x=b.x+c.ux*(b.r-c.d);b.y=b.y+c.uy*(b.r-c.d);
          const vn=b.vx*c.ux+b.vy*c.uy;
          if(vn<0){b.vx-=(1+0.55)*vn*c.ux;b.vy-=(1+0.55)*vn*c.uy;}
          onBrick(br,b);
        }
      }
    }else{
      for(const br of bricks){
        if(!br.alive)continue;
        if(circleRect(b,br.x,br.y,br.w,br.h))onBrick(br,b);
      }
    }

    /* ---- drop targets ---- */
    for(const bank of dropBanks){
      for(const t of bank.targets){
        if(!t.up)continue;
        const h=bounceLine(b,t.x1,t.y1,t.x2,t.y2,0.5,2);
        if(h){onDropTarget(bank,t,b);}
      }
    }

    /* ---- flippers ---- */
    for(const f of flippers){
      const tx=tipX(f),ty=tipY(f);
      const c=closestSeg(b.x,b.y,f.px,f.py,tx,ty);
      let nx=b.x-c.x,ny=b.y-c.y,d=Math.hypot(nx,ny);
      const rr=b.r+13;
      if(d<rr){
        if(d<0.0001){nx=0;ny=-1;d=0.0001;}else{nx/=d;ny/=d;}
        b.x=c.x+nx*rr;b.y=c.y+ny*rr;
        const rx=c.x-f.px,ry=c.y-f.py;
        const svx=-f.omega*ry,svy=f.omega*rx;
        const rvx=b.vx-svx,rvy=b.vy-svy;
        const vn=rvx*nx+rvy*ny;
        if(vn<0){
          const e=0.42+(surgeT>0?0.14:0);
          b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;
          if(Math.abs(f.omega)>2.4){
            noise(0.028,0.1,1600);
            spark(c.x,c.y,4,YL,220);
            f.hitFx=1;
          }
        }
      }
    }

    /* ---- ball vs ball ---- */
    for(let bj=bi+1;bj<balls.length;bj++){
      const o=balls[bj];
      if(o.scoop||o.magnet||o.rail||o.launchT>=0||o.gone)continue;
      let nx=o.x-b.x,ny=o.y-b.y,d=Math.hypot(nx,ny);
      const rr=b.r*2;
      if(d<rr&&d>0.0001){
        nx/=d;ny/=d;
        const ov=(rr-d)/2;
        b.x-=nx*ov;b.y-=ny*ov;o.x+=nx*ov;o.y+=ny*ov;
        const rvn=(o.vx-b.vx)*nx+(o.vy-b.vy)*ny;
        if(rvn<0){
          const imp=rvn*0.92;
          b.vx+=imp*nx;b.vy+=imp*ny;o.vx-=imp*nx;o.vy-=imp*ny;
          noise(0.026,0.09,2000);
        }
      }
    }

    /* ---- sensors ---- */
    sensors(b,dt);

    /* ---- stuck nudger ---- */
    const sp=Math.hypot(b.vx,b.vy);
    if(sp<34)b.still+=dt; else {b.still=0;if(sp>240)b.stuckLv=0;}
    if(b.still>1.5&&state==="PLAY"){
      b.still=0;b.stuckLv++;
      if(b.stuckLv>=3){b.stuckLv=0;b.vx+=rand(-700,700);b.vy-=rand(900,1500);spark(b.x,b.y,10,YL,300);}
      else{b.vx+=rand(-280,280);b.vy-=rand(300,650);}
    }

    /* ---- deck tracking ---- */
    const dk=deckAt(b.y).id;
    if(dk!==b.deck){b.prevDeck=b.deck;b.deck=dk;onDeckChange(b,dk,b.prevDeck);}

    /* ---- out of bounds / drain ---- */
    if(b.x<-80||b.x>PW+120||b.y<-160){
      b.x=clamp(b.x,80,PW-80);b.y=Math.max(b.y,120);
      b.vx*=-0.4;b.vy=Math.abs(b.vy)*0.4+120;
    }
    if(b.y>PH+30){
      if(b.shield){
        b.shield=false;
        b.x=830;b.y=2500;b.vx=rand(-160,160);b.vy=-1900;
        announce("SHIELD SAVE!",GR,true);SND.save();flash(.4,GR);
        ring(830,2500,GR,20,240);
        continue;
      }
      b.gone=true;
      spark(b.x,PH-30,26,RD,320);
      balls.splice(bi,1);
      onDrain(b);
    }
  }
}

function pushTrail(b){
  b.trail.push({x:b.x,y:b.y});
  if(b.trail.length>16)b.trail.shift();
}

/* ============================================================
   SENSORS
   ============================================================ */
function sensors(b,dt){
  /* rollovers (STORM lanes) */
  for(const r of rollovers){
    if(dist(b.x,b.y,r.x,r.y)<r.r+b.r&&timeSec-r.cool>0.4){
      r.cool=timeSec;onRollover(r,b);
    }
  }
  /* inlanes */
  for(const l of lanes){
    if(dist(b.x,b.y,l.x,l.y)<l.r+b.r&&timeSec-l.cool>0.5){
      l.cool=timeSec;onInlane(l,b);
    }
  }
  /* spinners */
  for(const s of spinners){
    if(dist(b.x,b.y,s.x,s.y)<s.r+b.r&&timeSec-s.cool>0.28){
      s.cool=timeSec;
      const v=Math.hypot(b.vx,b.vy);
      s.vel+=clamp(v*0.014,3,26);
      onSpinner(s,b);
    }
  }
  /* kickbacks */
  for(const k of kickbacks){
    if(dist(b.x,b.y,k.x,k.y)<k.r+b.r&&b.vy>60&&timeSec-(k.cool||-9)>1){
      k.cool=timeSec;onKickback(k,b);
    }
  }
  /* rail mouths */
  if(!b.rail&&b.launchT<0){
    for(const R of rails){
      const m=R.mouth;
      if(dist(b.x,b.y,m.x,m.y)<m.r+b.r){
        const sp=Math.hypot(b.vx,b.vy);
        const p0=R.pts[0],p1=R.pts[1];
        const tx=(p1[0]-p0[0]),ty=(p1[1]-p0[1]),tl=Math.hypot(tx,ty);
        const dot=(b.vx*tx+b.vy*ty)/(tl*Math.max(sp,1));
        if(sp>=R.minSpd&&dot>0.15){
          b.rail=R;b.railD=0;b.railSpd=Math.max(sp*0.98,R.minSpd*1.1);
          onRailEnter(b,R);
        }
      }
    }
  }
  /* portals */
  for(const p of portals){
    if(p.cool>0)continue;
    const da=dist(b.x,b.y,p.a.x,p.a.y), db=dist(b.x,b.y,p.b.x,p.b.y);
    if(da<p.r){teleport(b,p,p.b,p.a);}
    else if(db<p.r){teleport(b,p,p.a,p.b);}
  }
  /* scoops */
  for(const s of scoops){
    if(s.cool>0)continue;
    if(dist(b.x,b.y,s.x,s.y)<s.r*0.9&&!b.scoop){
      b.scoop=s;b.scoopT=0;s.cool=1.6;
      onScoop(s,b);
    }
  }
  /* shards & orbs are collected in game logic */
}

function teleport(b,p,to,from){
  p.cool=1.15;
  spark(from.x,from.y,26,p.col,420);
  ring(from.x,from.y,p.col,10,120);
  b.x=to.x;b.y=to.y;
  const sp=Math.max(Math.hypot(b.vx,b.vy),900);
  const ang=Math.atan2(b.vy,b.vx)+rand(-0.35,0.35);
  b.vx=Math.cos(ang)*sp;b.vy=Math.sin(ang)*sp;
  b.trail.length=0;
  spark(to.x,to.y,30,p.col,480);
  ring(to.x,to.y,p.col,10,150);
  SND.portal();
  onPortal(b,p);
}
