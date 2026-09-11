/** Targeted source-module regression for the founder's multiball drain report.
 * Runs the real game, room and physics functions in Node. Canvas/audio/browser
 * presentation is stubbed; this is not a browser playthrough or kernel review.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const source = resolve(process.argv[2]);
const files = ['02-core.js','03-table.js','03b-levels.js','04-physics.js','05-game.js','06-update.js'];
function game(room, saves=0) {
  const canvas={getContext(){return {};},getBoundingClientRect(){return {width:900,height:1500};}};
  const context=createContext({console,window:{matchMedia(){return {matches:false};}},
    document:{getElementById(){return canvas;}},addEventListener(){},
    localStorage:{getItem(){return null;},setItem(){}},setTimeout(){},
    rebuildPaths(){},gameOver(){runInContext('state="OVER"',context);}});
  for(const f of files)runInContext(readFileSync(resolve(source,'src',f),'utf8'),context,{filename:f,timeout:1000});
  runInContext('state="PLAY"; muted=true; ballSaveT=0; savesThisBall=2; quality=0; Math.random=()=>0.5;',context);
  if(room!=='tower')runInContext(`enterLevel(${JSON.stringify(room)}); levelSaves=${saves};`,context);
  else runInContext('spawnBall(PW/2,PH/2,0,0);',context);
  runInContext(`
    function snapshot(){return {state,ballNum,extraBalls,ballsPlayed,savesThisBall,
      roomSaves:levelSaves,roomLost:levelLost,warping:warpT>0,
      realBalls:balls.filter(b=>!b.ghost&&!b.gone).length};}
    function drainAt(index){
      const b=balls.filter(x=>!x.ghost&&!x.gone)[index];
      b.x=PW/2;b.y=PH+80;b.vx=0;b.vy=0;b.inLane=false;b.launchT=-1;
      b.scoop=null;b.rail=null;b.magnet=null;b.shield=false;
      physics(1/240);
    }
    function split(){const b=balls.find(x=>!x.ghost);collectOrb({kind:"SPLIT",x:b.x,y:b.y},b);}
    split();
  `,context);
  return expression=>runInContext(expression,context,{timeout:1000});
}

const results=[];
function check(name, ok, observed){results.push({name,pass:!!ok,observed});}
for(const room of ['tower','spiral','forge','deep']){
  const g=game(room);
  const initial=g('snapshot()');
  check(`${room}: real SPLIT creates a second playable ball`,initial.realBalls===2,initial);
  const first=g('drainAt(1); snapshot()');
  check(`${room}: extra drain preserves the current turn and surviving ball`,
    first.state==='PLAY'&&first.ballNum===initial.ballNum&&first.ballsPlayed===initial.ballsPlayed&&
    first.extraBalls===initial.extraBalls&&first.realBalls===1&&
    first.roomSaves===initial.roomSaves&&!first.roomLost&&!first.warping,first);
  const last=g('drainAt(0); if(level){levelTick(1);levelTick(1);} snapshot()');
  check(`${room}: last drain ends the turn once`,last.state==='BONUS'&&last.realBalls===0,last);
  const next=g('endOfBallFinish(); snapshot()');
  check(`${room}: next turn consumes exactly one numbered ball`,next.ballNum===initial.ballNum+1&&
    next.ballsPlayed===initial.ballsPlayed+1&&next.state==='PLAY'&&next.realBalls===1,next);
}
for(const room of ['spiral','forge','deep']){
  const g=game(room,2);
  const first=g('drainAt(1); snapshot()');
  check(`${room}: extra drain does not spend or replace a room save`,
    first.realBalls===1&&first.roomSaves===2&&!first.roomLost&&!first.warping,first);
  const saved=g('drainAt(0); snapshot()');
  check(`${room}: last drain still uses one available room save`,
    saved.realBalls===1&&saved.roomSaves===1&&!saved.roomLost&&!saved.warping&&saved.ballNum===1,saved);
  const simultaneous=game(room,2);
  const both=simultaneous('for(const b of balls){b.x=PW/2;b.y=PH+80;b.vx=0;b.vy=0;}physics(1/240);snapshot()');
  check(`${room}: simultaneous drains spend only one room save`,
    both.realBalls===1&&both.roomSaves===1&&!both.roomLost&&!both.warping,both);
  const ghost=game(room,0);
  const remaining=ghost('drainAt(1);spawnBall(300,300,0,0,{ghost:true});drainAt(0);snapshot()');
  check(`${room}: a ghost does not prevent the final real ball from ending the visit`,
    remaining.realBalls===0&&remaining.roomLost&&remaining.warping,remaining);
}
const failed=results.filter(r=>!r.pass);
console.log(JSON.stringify({scope:'Real source-module execution; presentation stubbed',source,
  passed:results.length-failed.length,total:results.length,results},null,2));
process.exitCode=failed.length?1:0;
