import * as THREE from "./vendor/three.module.js";
import { DriveMode } from "./js/drive/driveMode.js";
import { TRACK_PATHS, CAR_SPAWN } from "./js/data/tracks.js";

if (typeof globalThis.document === "undefined") {
  const makeCtx = () => ({ fillStyle:"",strokeStyle:"",lineWidth:1,globalAlpha:1,font:"",textAlign:"",textBaseline:"",
    fillRect(){},strokeRect(){},clearRect(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},
    quadraticCurveTo(){},bezierCurveTo(){},arc(){},ellipse(){},rect(){},stroke(){},fill(){},clip(){},save(){},restore(){},
    translate(){},rotate(){},scale(){},setTransform(){},setLineDash(){},fillText(){},strokeText(){},measureText:()=>({width:0}),
    drawImage(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    createPattern:()=>null,getImageData:()=>({data:new Uint8ClampedArray(4),width:1,height:1}),putImageData(){} });
  globalThis.document = { createElement:(t)=>t==="canvas"?{width:0,height:0,getContext:()=>makeCtx(),style:{}}:{style:{},appendChild(){},addEventListener(){},removeEventListener(){}},
    addEventListener(){},removeEventListener(){},getElementById:()=>null,querySelector:()=>null,body:{appendChild(){}} };
}
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60,1,0.1,200);
const drive = new DriveMode(scene, camera);
const tracks = drive.tracks;
const byId = Object.fromEntries(TRACK_PATHS.map(p=>[p.id,p]));

function d3(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)}
function nearestOn(pathId, pt) {
  const p = byId[pathId];
  let best = Infinity, bestPt=null, idx=-1;
  p.points.forEach((q,i)=>{ const d=d3(pt,q); if(d<best){best=d;bestPt=q;idx=i;} });
  return {d:best, pt:bestPt, idx};
}

const checks = [
  ["foyer_skirting", "ramp_foyer_console"],
  ["ramp_foyer_console", "furniture_foyer_console"],
  ["furniture_foyer_console", "ramp_console_to_foyer_cornice"],
  ["ramp_console_to_foyer_cornice", "cornice_foyer"],
  ["foyer_skirting", "ramp_foyer_to_landing"],
  ["ramp_foyer_to_landing", "landing_skirting"],
  ["landing_skirting", "ramp_landing_to_landing_cornice"],
  ["ramp_landing_to_landing_cornice", "cornice_landing_east"],
  ["ramp_landing_to_landing_cornice", "cornice_landing_west"],
  ["ramp_stair_to_cornice", "cornice_foyer"],
  ["ramp_stair_to_cornice", "ramp_foyer_to_landing"],
  ["cornice_foyer", "cornice_hall_west"],
  ["cornice_hall_west", "cornice_hall_cross_mid"],
  ["cornice_hall_east", "cornice_conservatory"],
  ["cornice_landing_west", "balcony_loop"],
  ["ramp_landing_to_balcony", "balcony_loop"],
  ["ramp_landing_to_balcony", "landing_skirting"],
  ["shelf_highway_hall", "furniture_library_tops"],
  ["ramp_foyer_console", "foyer_skirting"],
];

for (const [a,b] of checks) {
  if (!byId[a]||!byId[b]) { console.log("MISSING", a, b); continue; }
  const A=byId[a], B=byId[b];
  let best=Infinity, info=null;
  // ends of A to any of B
  for (const end of [A.points[0], A.points.at(-1)]) {
    const n = nearestOn(b, end);
    if (n.d < best) { best=n.d; info={from:`${a} end`, to:`${b}[${n.idx}]`, d:n.d, pt:n.pt, end}; }
  }
  for (const end of [B.points[0], B.points.at(-1)]) {
    const n = nearestOn(a, end);
    if (n.d < best) { best=n.d; info={from:`${b} end`, to:`${a}[${n.idx}]`, d:n.d, pt:n.pt, end}; }
  }
  const wa=A.width||0.35, wb=B.width||0.35;
  const thresh=Math.max(0.22,(wa+wb)*0.55);
  console.log(`${a} ↔ ${b}: d=${best.toFixed(3)} thresh=${thresh.toFixed(3)} ${best<=thresh?"OK":"GAP"}`, 
    info && {end: info.end, to: info.to});
}

// Physical drive simulation: step along a polyline of waypoints using querySnap support
function drivePolyline(waypoints, step=0.15, label="") {
  let pos = {...waypoints[0]};
  let fails=0, supported=0, onTrack=0, total=0;
  const failPts=[];
  for (let wi=1; wi<waypoints.length; wi++) {
    const target = waypoints[wi];
    for (let iter=0; iter<500; iter++) {
      const dx=target.x-pos.x, dy=target.y-pos.y, dz=target.z-pos.z;
      const len=Math.hypot(dx,dy,dz);
      if (len < step*0.5) break;
      const t=Math.min(1, step/len);
      const nx=pos.x+dx*t, ny=pos.y+dy*t, nz=pos.z+dz*t;
      const snap=tracks.querySnap(nx, ny, nz, 2.2);
      total++;
      if (snap.onTrack) onTrack++;
      if (snap.supported || snap.nearDeck || snap.carpet) {
        supported++;
        // stick to surface Y when elevated
        pos = { x:nx, y: snap.supported ? snap.y : ny, z:nz };
      } else {
        fails++;
        if (failPts.length<8) failPts.push({x:+nx.toFixed(2),y:+ny.toFixed(2),z:+nz.toFixed(2),kind:snap.kind,pathId:snap.pathId});
        pos = { x:nx, y:ny, z:nz }; // continue anyway to map hole
      }
      if (len < step) break;
    }
  }
  console.log(`DRIVE ${label}: steps=${total} onTrack=${onTrack} supported=${supported} fails=${fails}`, failPts);
  return {total,onTrack,supported,fails,failPts};
}

// Build waypoint chains from path densify
function densify(points, closed, step=0.35) {
  const pts=points.slice();
  if (closed && pts.length>1) {
    const a=pts[0],b=pts.at(-1);
    if (d3(a,b)>0.05) pts.push({...a});
  }
  const out=[];
  for (let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    const len=d3(a,b);
    const n=Math.max(1,Math.ceil(len/step));
    for(let k=0;k<n;k++){
      const t=k/n;
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    }
  }
  out.push({...pts.at(-1)});
  return out;
}

// Primary tour physical: spawn → along foyer skirt near console ramp → console → cornice → lap
{
  const spawn = CAR_SPAWN;
  const ramp = byId.ramp_foyer_console;
  const furn = byId.furniture_foyer_console;
  const up = byId.ramp_console_to_foyer_cornice;
  const corn = byId.cornice_foyer;
  const chain = [
    spawn,
    ...densify(ramp.points, false, 0.3),
    ...densify(furn.points, true, 0.3),
    ...densify(up.points, false, 0.3),
    ...densify(corn.points, true, 0.35),
  ];
  drivePolyline(chain, 0.12, "spawn→console→cornice lap");
}

{
  const ramp = byId.ramp_foyer_to_landing;
  const land = byId.landing_skirting;
  const up = byId.ramp_landing_to_landing_cornice;
  const cw = byId.cornice_landing_west;
  // find nearest landing point to ramp end
  const re = ramp.points.at(-1);
  let best=Infinity, bestPt=null;
  for (const q of land.points) { const d=d3(re,q); if(d<best){best=d;bestPt=q;} }
  console.log("ramp_foyer_to_landing end → landing_skirting", best.toFixed(3), bestPt);
  const chain = [
    ...densify(ramp.points,false,0.3),
    bestPt,
    ...densify(up.points,false,0.3),
    ...densify(cw.points, !!cw.closed, 0.35),
  ];
  drivePolyline(chain, 0.12, "foyer stair→landing→landing cornice");
}

{
  const bal = byId.balcony_loop;
  const r = byId.ramp_landing_to_balcony;
  drivePolyline([...densify(r.points,false,0.3), ...densify(bal.points,true,0.3)], 0.12, "landing→balcony lap");
}

// Sample the "unsupported but same pathId" holes — are they real voids?
console.log("\n=== HOLE DEEP DIVE ===");
const holePts = [
  {x:-12.8,y:1.82,z:-4, expect:"furniture_cabinet_cases"},
  {x:3.1,y:6.81,z:-16.38, expect:"shelf_highway_hall"},
  {x:6.19,y:4.28,z:12.36, expect:"balcony_loop"},
  {x:-0.39,y:7.2,z:8.51, expect:"cornice_landing_west"},
  {x:-9.87,y:3.64,z:-30, expect:"cornice_dining_bridge"},
  {x:6.75,y:4.26,z:9.1, expect:"ramp_landing_to_balcony"},
];
for (const h of holePts) {
  const s = tracks.querySnap(h.x,h.y,h.z,2.0);
  const s2 = tracks.querySnap(h.x,h.y+0.05,h.z,2.0);
  console.log(h.expect, "at", h, "→", {kind:s.kind,pathId:s.pathId,onTrack:s.onTrack,supported:s.supported,nearDeck:s.nearDeck,carpet:s.carpet,dist:s.dist?.toFixed?.(3),halfW:s.halfW,elevated:s.elevated,y:s.y});
  console.log("  +0.05y →", {kind:s2.kind,pathId:s2.pathId,onTrack:s2.onTrack,supported:s2.supported,nearDeck:s2.nearDeck});
}

// List elev components with ids
const ELEV = new Set(["elevated","ramp","balcony","cornice","shortcut","mouse","shaft","chute"]);
const elevPaths = TRACK_PATHS.filter(p=>ELEV.has(p.kind));
function joinThresh(a,b){return Math.max(0.22,((a.width||0.35)+(b.width||0.35))*0.55)}
const adj=Object.fromEntries(elevPaths.map(p=>[p.id,[]]));
for(let i=0;i<elevPaths.length;i++){
  for(let j=i+1;j<elevPaths.length;j++){
    const a=elevPaths[i],b=elevPaths[j];
    for (const end of [a.points[0],a.points.at(-1)]) {
      let best=Infinity;
      for(const q of b.points) best=Math.min(best,d3(end,q));
      if(best<=joinThresh(a,b)){adj[a.id].push(b.id);adj[b.id].push(a.id);break;}
    }
  }
}
const seen=new Set(), comps=[];
for(const n of elevPaths.map(p=>p.id)){
  if(seen.has(n))continue;
  const st=[n],comp=[]; seen.add(n);
  while(st.length){const u=st.pop();comp.push(u);for(const v of adj[u]){if(!seen.has(v)){seen.add(v);st.push(v);}}}
  comps.push(comp);
}
comps.sort((a,b)=>b.length-a.length);
console.log("\n=== TOP ELEV COMPONENTS ===");
comps.slice(0,8).forEach((c,i)=>console.log(i, c.length, c.join(", ")));
