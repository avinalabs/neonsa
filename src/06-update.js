/* ============================================================
   p6 :: UPDATE — timers, particles, weather, entities
   ============================================================ */
let weather={rain:0.25,gustT:4,flashT:6};
/* adaptive quality: a 2,900px table on a weak GPU still has to feel smooth */
let perfAvg=16.7, quality=1, lastScaleChange=0;
function perfTick(ms){
  perfAvg=perfAvg*0.92+ms*0.08;
  if(perfAvg>27)quality=Math.max(0.32,quality-0.02);
  else if(perfAvg<18.5)quality=Math.min(1,quality+0.008);
  /* if trimming effects is not enough, render fewer pixels */
  if(timeSec-lastScaleChange>1.6){
    const want = perfAvg>36?0.62 : perfAvg>27?0.78 : perfAvg<17.5?1 : renderScale;
    if(Math.abs(want-renderScale)>0.06){
      renderScale=want;lastScaleChange=timeSec;resize();
    }
  }
}

function update(dt){
  timeSec+=dt;
  hudTick(dt);

  /* Pause has to stop the GAME, not just the physics. Everything below that
     advances play — ball save counting down, a mission running out, a scoop
     resolving and paying — is skipped while paused; the presentation (shake,
     flash, particles, camera) keeps running so the screen stays alive.
     A scoop resolving through a pause was worth real points, and the zoom
     watchdog pauses on its own, so this was reachable without even asking. */
  const live=!paused;

  /* anti-cheat sampling */
  scoreWindowT+=dt;
  if(scoreWindowT>1){scoreWindowT-=1;if(scoreWindowPts>2.5e8)cheatFlag=true;scoreWindowPts=0;}

  /* timers */
  if(live){
  if(comboT>0){comboT-=dt;if(comboT<=0)combo=0;}
  if(frenzyT>0)frenzyT-=dt;
  if(superBumperT>0)superBumperT-=dt;
  if(ballSaveT>0)ballSaveT-=dt;
  if(goldT>0)goldT-=dt;
  if(surgeT>0)surgeT-=dt;
  if(slowmoT>0)slowmoT-=dt;
  if(hitStop>0)hitStop-=dt;
  tiltHeat=Math.max(0,tiltHeat-dt*0.42);
  if(shoveT>0){shoveT-=dt;if(shoveT<=0){shoveT=0;shoveX=0;shoveY=0;}}
  shakeMag*=Math.pow(0.02,dt);
  flashA*=Math.pow(0.0009,dt);
  bgPulse*=Math.pow(0.05,dt);
  excite=Math.max(mbActive||boss.active||wizard.active?0.55:0,excite-dt*0.16);
  if(timeSec-lastScoreTime<0.6)excite=clamp(excite+dt*0.5,0,1);
  }else{
    /* presentation only, so a paused screen still breathes */
    shakeMag*=Math.pow(0.02,dt);
    flashA*=Math.pow(0.0009,dt);
    bgPulse*=Math.pow(0.05,dt);
  }

  /* gravity / wind easing */
  if(live){
  gravAng+=clamp(gravTarget-gravAng,-dt*1.3,dt*1.3);
  if(windT>0){windT-=dt;windX=lerp(windX,windTarget,1-Math.pow(0.05,dt));}
  else{windTarget=0;windX=lerp(windX,0,1-Math.pow(0.2,dt));}

  /* toy decay */
  for(const bp of bumpers)bp.fx=Math.max(0,bp.fx-dt*4);
  for(const s of slings)s.fx=Math.max(0,s.fx-dt*5);
  for(const br of bricks)br.fx=Math.max(0,br.fx-dt*4);
  for(const R of rails)R.fx=Math.max(0,R.fx-dt*2.4);
  for(const f of flippers)if(f.hitFx)f.hitFx=Math.max(0,f.hitFx-dt*5);
  for(const b of dropBanks){
    for(const t of b.targets)t.fx=Math.max(0,t.fx-dt*4);
    if(b.resetT>0){b.resetT-=dt;if(b.resetT<=0)b.targets.forEach(t=>t.up=true);}
  }
  if(brickResetT>0){brickResetT-=dt;if(brickResetT<=0){bricks.forEach(b=>b.alive=true);announce("WALL REBUILT",OR,false);}}
  for(const p of portals)if(p.cool>0)p.cool-=dt;
  for(const s of scoops)if(s.cool>0)s.cool-=dt;
  for(const r of rails)if(r.miss>0)r.miss=Math.max(0,r.miss-dt*2.2);

  /* spinners */
  for(const s of spinners){
    s.vel*=Math.pow(0.34,dt);
    s.ang+=s.vel*dt*6;
    if(s.vel>0.6){
      s.acc=(s.acc||0)+s.vel*dt*2;
      while(s.acc>1){
        s.acc-=1;stats.spins++;
        SND.spinTick();
        addScore(900,s.x,s.y,{col:s.col,quiet:true,noCombo:true});
        addStorm(0.006);addSurge(0.004);
      }
      if(Math.random()<dt*10)floatText(s.x,s.y-46,"SPIN",s.col,16);
    }
    if(s.hot)s.hot=Math.max(0,s.hot-dt*3);
  }

  /* scoop hold timers */
  for(const b of balls){
    if(b.scoop){
      if(b.hold===undefined)b.hold=0.7;
      if(b.hold<90){
        b.hold-=dt;
        if(b.hold<=0){b.hold=undefined;resolveScoop(b);}
      }
    }
  }

  /* magnets, cannon, missions, boss, wizard — all of it the tower's, so it
     holds its breath while you are off in one of the warp rooms */
  magnetTick(dt);
  if(!level){
    cannonTick(dt);
    missionTick(dt);
    bossTick(dt);
    wizardTick(dt);
  }

  /* ball buffs decay */
  for(const b of balls){
    if(!live)break;
    if(b.plasma>0){
      b.plasma-=dt;
      if(Math.random()<dt*46)parts.push({x:b.x+rand(-10,10),y:b.y+rand(-10,10),vx:rand(-60,60),vy:-rand(40,180),
        life:rand(.25,.6),max:.6,col:Math.random()<.5?OR:YL,size:rand(2,5)});
    }
    if(b.phase>0)b.phase-=dt;
    if(b.heavy>0)b.heavy-=dt;
  }

  /* mission entities: meteors */
  for(let i=meteors.length-1;i>=0;i--){
    const m=meteors[i];m.t+=dt;
    m.vy+=380*dt;m.x+=m.vx*dt;m.y+=m.vy*dt;
    if(m.x<120||m.x>PW-120)m.vx*=-1;
    if(Math.random()<dt*24)parts.push({x:m.x+rand(-14,14),y:m.y+rand(-14,14),vx:rand(-40,40),vy:-rand(20,90),
      life:.35,max:.35,col:pick([OR,RD,YL]),size:rand(2,5)});
    let hit=false;
    for(const b of balls){
      if(b.ghost||b.rail||b.scoop)continue;
      if(dist(b.x,b.y,m.x,m.y)<m.r+b.r){
        hit=true;
        b.vx+=(b.x-m.x)*3.4;b.vy+=(b.y-m.y)*3.4-260;
        break;
      }
    }
    if(hit){
      meteors.splice(i,1);stats.meteors++;
      SND.meteor();spark(m.x,m.y,26,OR,520);ring(m.x,m.y,OR,14,180);shake(6);
      addScore(40000,m.x,m.y,{col:OR,size:30});
      if(mission.active&&mission.id==="meteor"){
        mission.prog++;
        if(mission.prog>=mission.goal)endMission(true);
      }
      continue;
    }
    if(m.y>PH-80||m.t>16){meteors.splice(i,1);spark(m.x,m.y,10,RD,240);}
  }

  /* boss drones */
  for(let i=drones.length-1;i>=0;i--){
    const d=drones[i];d.t+=dt;d.life-=dt;
    const f=focusBall();
    if(f){
      const a=Math.atan2(f.y-d.y,f.x-d.x);
      d.vx+=Math.cos(a)*520*dt;d.vy+=Math.sin(a)*520*dt;
    }
    const s=Math.hypot(d.vx,d.vy);if(s>620){d.vx*=620/s;d.vy*=620/s;}
    d.x+=d.vx*dt;d.y+=d.vy*dt;
    for(const b of balls){
      if(b.ghost||b.rail)continue;
      if(dist(b.x,b.y,d.x,d.y)<d.r+b.r){
        b.vx+=(b.x-d.x)*4;b.vy+=(b.y-d.y)*4;
        drones.splice(i,1);spark(d.x,d.y,18,RD,420);SND.bossHit();
        addScore(16000,d.x,d.y,{col:RD,size:24});
        break;
      }
    }
    if(d.life<=0)drones.splice(i,1);
  }

  /* wisp trail */
  if(mission.active&&mission.data&&mission.data.wisp){
    const w=mission.data.wisp;
    if(Math.random()<dt*44)parts.push({x:w.x+rand(-12,12),y:w.y+rand(-12,12),vx:rand(-30,30),vy:rand(-30,30),
      life:.5,max:.5,col:GR,size:rand(2,4)});
  }

  /* orbs */
  orbTimer-=dt;
  if(orbTimer<=0&&state==="PLAY"&&orbs.length<3&&!level){
    orbTimer=rand(15,26);
    const d=DECKS[irand(1,Math.max(1,DECKS.length-1))];
    spawnOrb(rand(220,1440),rand(d.y0+120,d.y1-140));
  }
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];o.t+=dt;o.life-=dt;
    o.x+=o.vx*dt;o.y+=o.vy*dt;
    o.vx+=Math.sin(o.t*1.7)*40*dt;o.vy+=Math.cos(o.t*1.3)*40*dt;
    o.x=clamp(o.x,130,PW-200);o.y=clamp(o.y,110,PH-160);
    let got=false;
    for(const b of balls){
      if(b.ghost||b.rail||b.scoop)continue;
      if(dist(b.x,b.y,o.x,o.y)<o.r+b.r){collectOrb(o,b);got=true;break;}
    }
    if(got||o.life<=0)orbs.splice(i,1);
  }

  /* shards drift to nearest ball */
  for(let i=shards.length-1;i>=0;i--){
    const s=shards[i];s.life-=dt;
    let near=null,nd=1e9;
    for(const b of balls){
      if(b.ghost)continue;
      const d=dist(b.x,b.y,s.x,s.y);
      if(d<nd){nd=d;near=b;}
    }
    if(near&&nd<520){
      const f=clamp(2600*(1-nd/520),0,2600);
      const a=Math.atan2(near.y-s.y,near.x-s.x);
      s.vx+=Math.cos(a)*f*dt;s.vy+=Math.sin(a)*f*dt;
    }else s.vy+=520*dt;
    s.vx*=Math.pow(0.4,dt);s.vy*=Math.pow(0.55,dt);
    s.x+=s.vx*dt;s.y+=s.vy*dt;
    if(near&&nd<near.r+s.r+4){
      shards.splice(i,1);stats.shards++;
      addSurge(0.014);
      addScore(2500,s.x,s.y,{col:s.col,quiet:true,noCombo:true});
      SND.shard();
      parts.push({x:s.x,y:s.y,vx:0,vy:0,life:.3,max:.3,col:WH,size:6});
      continue;
    }
    if(s.life<=0)shards.splice(i,1);
  }

  /* weather */
  weather.gustT-=dt;
  if(weather.gustT<=0&&state==="PLAY"&&!level){
    weather.gustT=rand(14,30);
    if(Math.random()<0.55&&!boss.active){
      windTarget=rand(-560,560);windT=rand(2.4,4);
      SND.windGust();toast("GALE — the table is leaning",CY,"≈");
    }
  }
  weather.flashT-=dt;
  if(weather.flashT<=0){
    weather.flashT=rand(6,16);
    if(Math.random()<0.5){
      bolts.push({x:rand(120,1640),y0:60,y1:rand(600,PH),t:0,life:.35,seed:Math.random()*999,soft:true});
      flash(.14,IC);
      if(Math.random()<0.5)noise(0.9,0.1,60,700);
    }
  }
  weather.rain=clamp(0.2+excite*0.6+(boss.active?0.5:0)+(mission.active?0.2:0),0,1);
  const wantDrops=Math.round(weather.rain*90*quality);
  while(rainDrops.length<wantDrops)rainDrops.push({x:rand(0,PW),y:rand(0,PH),v:rand(900,1800),l:rand(20,60)});
  while(rainDrops.length>wantDrops)rainDrops.pop();
  for(const d of rainDrops){
    d.y+=d.v*dt;d.x+=windX*0.0012*d.v*dt;
    if(d.y>PH){d.y=-40;d.x=rand(0,PW);}
  }
  for(let i=bolts.length-1;i>=0;i--){bolts[i].t+=dt;if(bolts[i].t>bolts[i].life)bolts.splice(i,1);}

  /* particles / floats / rings */
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=900*dt;p.vx*=0.99;
    if(p.life<=0)parts.splice(i,1);
  }
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i];f.life-=dt*0.85;f.y+=f.vy*dt;f.vy*=0.94;
    if(f.life<=0)floats.splice(i,1);
  }
  for(let i=rings.length-1;i>=0;i--){
    const r=rings[i];r.life-=dt;r.r+=(r.r1-r.r)*dt*9;
    if(r.life<=0)rings.splice(i,1);
  }
  for(let i=toasts.length-1;i>=0;i--){
    toasts[i].t+=dt;
    if(toasts[i].t>toasts[i].life)toasts.splice(i,1);
  }
  if(announceCur){
    announceCur.t+=dt;
    if(announceCur.t>(announceCur.big?1.7:1.15))announceCur=null;
  }
  if(!announceCur&&announceQ.length)announceCur=announceQ.shift();

  }   /* end of the paused gate — everything above advances play */

  musicTick(dt);

  /* warp transitions and whatever room we are standing in */
  levelTick(dt);

  /* physics — frozen while the world is being swapped underneath us */
  if(state==="PLAY"&&!paused&&warpT<=0){
    if(charging){
      plungerCharge+=dt*1.15*(plungerDir);
      if(plungerCharge>=1){plungerCharge=1;plungerDir=-1;}
      if(plungerCharge<=0){plungerCharge=0;plungerDir=1;}
    }
    const ts=(slowmoT>0?0.42:1)*(hitStop>0?0.15:1);
    let vmaxNow=600;
    for(const b of balls)vmaxNow=Math.max(vmaxNow,Math.hypot(b.vx,b.vy),b.railSpd||0);
    const nsub=clamp(Math.ceil(vmaxNow*dt*ts/9),4,18);
    const sdt=dt*ts/nsub;
    for(let i=0;i<nsub;i++){stepFlippers(sdt);physics(sdt);}
  }else if(state==="BONUS"&&!paused){
    endBonusTimer+=dt;
    const steps=14,per=endBonus/steps;
    if(endBonusStep<steps&&endBonusTimer>endBonusStep*0.09+0.35){
      endBonusStep++;score+=Math.round(per);feedChain(per|0);SND.tick();
    }
    if(endBonusTimer>steps*0.09+1.1)endOfBallFinish();
  }else if(state==="ATTRACT"){
    attractTick(dt);
  }
  updateCamera(dt);
}
let plungerDir=1;

/* ---------- attract mode: a slow tour of the tower ---------- */
let attractT=0;
function attractTick(dt){
  attractT+=dt;
  camMode="attract";
  const p=(attractT*0.052)%1;
  cam.tx=830+Math.sin(attractT*0.28)*300;
  cam.ty=PH-140-p*(PH-320);
  cam.tview=1180+Math.sin(attractT*0.4)*180;
  cam.x=lerp(cam.x,cam.tx,1-Math.pow(0.05,dt));
  cam.y=lerp(cam.y,cam.ty,1-Math.pow(0.05,dt));
  cam.view=lerp(cam.view,cam.tview,1-Math.pow(0.2,dt));
  if(Math.random()<dt*7)spark(rand(120,1560),rand(120,PH-120),3,pick([CY,MG,YL,PU,GR]),240);
  if(Math.random()<dt*0.5)bolts.push({x:rand(150,1600),y0:60,y1:rand(700,PH),t:0,life:.35,seed:Math.random()*999,soft:true});
  for(let i=bolts.length-1;i>=0;i--){bolts[i].t+=dt;if(bolts[i].t>bolts[i].life)bolts.splice(i,1);}
  for(const s of spinners){s.ang+=dt*1.4;}
  for(const bp of bumpers)bp.fx=Math.max(0,bp.fx-dt*3);
  if(Math.random()<dt*3)bumpers[irand(0,bumpers.length-1)].fx=1;
}
