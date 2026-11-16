/* Source-derived counts and fixed absolute density. No settlement/ruler proxies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AncientWorldsPopulation=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n),integer=n=>finite(n)&&Number.isInteger(n),object=v=>v&&typeof v==='object'&&!Array.isArray(v),MAX_CELLS=131072,MIN_YEAR=500,MAX_YEAR=3200;
const levels=Object.freeze([.1,1,5,10,25,50,100]),stops=[[0,[224,196,139]],[.36,[208,151,90]],[.7,[170,88,52]],[1,[119,49,40]]];
function colorForDensity(density){
 if(!finite(density)||density<=0)return [0,0,0,0];
 const t=Math.max(0,Math.min(1,Math.log1p(density)/Math.log1p(100)));let a=stops[0],b=stops[1];
 for(let i=1;i<stops.length;i++){b=stops[i];a=stops[i-1];if(t<=b[0])break}
 const u=(t-a[0])/(b[0]-a[0]),rgb=a[1].map((n,i)=>Math.round(n+(b[1][i]-n)*u));
 // Vanish continuously in sparsely populated cells instead of tinting every
 // tiny positive source count with the same blanket desert wash.
 return [...rgb,Math.round(255*.8*Math.sqrt(t))];
}
const scale=Object.freeze(levels.map(density=>Object.freeze({density,rgba:Object.freeze(colorForDensity(density))})));
function validate(data){
 const errors=[],fail=message=>{if(errors.length<100)errors.push(message)};
 if(!object(data))return {valid:false,errors:['Population data must be an object.']};
 if(data.schemaVersion!==1)fail('Population schemaVersion must be 1.');
 if(data.id!=='population24')fail('Population dataset identity must be population24.');
 const g=data.grid,b=data.coverage?.bounds;
 if(!object(g)||!finite(g.west)||!finite(g.north)||!finite(g.stepDegrees)||g.stepDegrees<=0||g.stepDegrees>10||!integer(g.width)||!integer(g.height)||g.width<1||g.height<1||g.width>1440||g.height>720||g.width*g.height>MAX_CELLS){fail('A bounded finite regular population grid is required.');return {valid:false,errors}}
 const n=g.width*g.height,east=g.west+g.width*g.stepDegrees,south=g.north-g.height*g.stepDegrees;
 if(g.west< -180||east>180+1e-9||south< -90-1e-9||g.north>90)fail('Population grid lies outside geographic longitude/latitude bounds.');
 if(!Array.isArray(b)||b.length!==4||!b.every(finite)||b[0]>=b[2]||b[1]>=b[3]||b.some((v,i)=>Math.abs(v-[g.west,south,east,g.north][i])>1e-8))fail('Coverage bounds must exactly match the grid footprint.');
 if(!Array.isArray(data.areaKm2)||data.areaKm2.length!==n)fail('areaKm2 must provide one value per grid cell.');
 if(!Array.isArray(data.valid)||data.valid.length!==n)fail('valid must provide one explicit 0/1 value per grid cell.');
 if(errors.length)return {valid:false,errors};
 let validCells=0;
 for(let i=0;i<n;i++){
  const area=data.areaKm2[i],known=data.valid[i];
  if(known!==0&&known!==1)fail('Invalid source-validity flag at cell '+i+'.');
  if(!finite(area)||area<0||(known===1&&area<=0))fail('Invalid square-kilometre area at cell '+i+'.');
  if(known===1)validCells++;
 }
 if(!validCells)fail('Population data contains no valid source cells.');
 if(!Array.isArray(data.sources)||!data.sources.length||data.sources.length>256)fail('Population source provenance is required.');
 else {const ids=new Set();for(const s of data.sources){if(!object(s)||typeof s.id!=='string'||!s.id.trim()||ids.has(s.id))fail('Population source identifiers must be nonempty and unique.');else ids.add(s.id)}}
 if(!Array.isArray(data.frames)||data.frames.length<2||data.frames.length>64){fail('Between two and 64 source population frames are required.');return {valid:false,errors}}
 let previous=Infinity;
 for(const [k,f] of data.frames.entries()){
  if(!object(f)||!integer(f.yearBce)||f.yearBce< -2500||f.yearBce>12000||f.yearBce>=previous){fail('Source frames must have unique descending finite year coordinates.');continue}
  previous=f.yearBce;
  if(typeof f.sourceLabel!=='string'||!f.sourceLabel.trim())fail('Source frame '+k+' needs its original source-label convention.');
  if(!Array.isArray(f.population)||f.population.length!==n){fail('Source frame '+k+' has the wrong cell count.');continue}
  let known=0,total=0;
  for(let i=0;i<n;i++){
   const p=f.population[i];
   if(data.valid[i]===0){if(p!==null)fail('No-data cell '+i+' must remain null, not zero or an estimate.');continue}
   if(p===null)continue;
   if(!finite(p)||p<0||p>1e12||!finite(p/data.areaKm2[i])){fail('Invalid population count or density in frame '+k+', cell '+i+'.');continue}
   known++;total+=p;
  }
  if(!known)fail('Source frame '+k+' has no known population values.');
  if(!finite(total)||total>1e12)fail('Source frame '+k+' exceeds the bounded population total.');
 }
 if(!integer(data.frames[0]?.yearBce)||data.frames[0].yearBce<MAX_YEAR||!integer(data.frames[data.frames.length-1]?.yearBce)||data.frames[data.frames.length-1].yearBce>MIN_YEAR)fail('Source frames must bracket the complete 3200–500 BCE atlas; extrapolation is not allowed.');
 return {valid:errors.length===0,errors};
}
function compensated(values){let sum=0,c=0;for(const value of values){const y=value-c,t=sum+y;c=(t-sum)-y;sum=t}return sum}
function createModel(data){
 const result=validate(data);if(!result.valid)throw new TypeError(result.errors.join(' '));
 const grid=Object.freeze({...data.grid}),coverage=Object.freeze({...data.coverage,bounds:Object.freeze([...data.coverage.bounds])}),area=Float64Array.from(data.areaKm2),sourceValid=Uint8Array.from(data.valid),frames=data.frames.map(f=>({yearBce:f.yearBce,sourceLabel:f.sourceLabel,population:Float64Array.from(f.population,p=>p===null?NaN:p)})),cache=new Map();
 const sourceMetadata=JSON.parse(JSON.stringify(data.sources)),metadata=JSON.parse(JSON.stringify(data.metadata||{})),sourceValidCells=sourceValid.reduce((a,b)=>a+b,0);let sampleBuilds=0;
 function bracket(y){for(let i=0;i<frames.length;i++){if(y===frames[i].yearBce)return {older:i,younger:i,fraction:0};if(i<frames.length-1&&frames[i].yearBce>y&&y>frames[i+1].yearBce)return {older:i,younger:i+1,fraction:(frames[i].yearBce-y)/(frames[i].yearBce-frames[i+1].yearBce)}}throw new RangeError('Population source frames do not bracket this year.')}
 function build(y){
  const b=bracket(y),older=frames[b.older],younger=frames[b.younger],population=new Float64Array(area.length),density=new Float64Array(area.length),valid=new Uint8Array(area.length),counts=[],areas=[];population.fill(NaN);density.fill(NaN);let validCells=0;
  for(let i=0;i<area.length;i++){
   const a=older.population[i],z=younger.population[i];if(!sourceValid[i]||!Number.isFinite(a)||!Number.isFinite(z))continue;
   const value=b.older===b.younger?a:a+(z-a)*b.fraction;
   if(!finite(value)||value<0)throw new RangeError('Interpolated source population is invalid.');
   population[i]=value;density[i]=value/area[i];valid[i]=1;counts.push(value);areas.push(area[i]);validCells++;
  }
  sampleBuilds++;return {yearBce:y,bracket:Object.freeze({older:older.yearBce,younger:younger.yearBce,fraction:b.fraction,olderLabel:older.sourceLabel,youngerLabel:younger.sourceLabel}),population,density,valid,totalPopulation:validCells?compensated(counts):NaN,coveredAreaKm2:compensated(areas),validCells,sourceValidCells,complete:validCells===sourceValidCells,noDataCells:area.length-validCells};
 }
 function sample(yearBce){
  if(!integer(yearBce)||yearBce<MIN_YEAR||yearBce>MAX_YEAR)throw new RangeError('Population display year must be an integer from 3200 to 500 BCE.');
  let value=cache.get(yearBce);if(value){cache.delete(yearBce);cache.set(yearBce,value)}else{value=build(yearBce);cache.set(yearBce,value);while(cache.size>3)cache.delete(cache.keys().next().value)}
  // Caller-owned arrays prevent an inspector or renderer from poisoning cached data.
  return Object.freeze({...value,population:new Float64Array(value.population),density:new Float64Array(value.density),valid:new Uint8Array(value.valid)});
 }
 return Object.freeze({sample,grid,coverage,get sources(){return JSON.parse(JSON.stringify(sourceMetadata))},get metadata(){return JSON.parse(JSON.stringify(metadata))},get years(){return frames.map(f=>f.yearBce)},get stats(){return {sampleBuilds,sampleCacheEntries:cache.size,sourceCells:area.length,sourceFrames:frames.length}},clear(){cache.clear()}});
}
return Object.freeze({validate,createModel,colorForDensity,densityScale:scale,MIN_YEAR,MAX_YEAR,MAX_CELLS,meaning:'Estimated total human population divided by the declared aggregated cell area in square kilometres. The fixed absolute colour scale is shared by all dates; visual smoothing does not create finer population observations.'});
});

/* A bounded source-grid raster on the existing flat map plane, warped once upstream. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./population24_core.js'):root.AncientWorldsPopulation);if(typeof module==='object'&&module.exports)module.exports=api;else root.AncientWorldsPopulationRenderer=api})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n),factoryDefault=()=>typeof document!=='undefined'?document.createElement('canvas'):null;
function create({model,canvasFactory=factoryDefault}={}){
 if(!model||typeof model.sample!=='function'||!model.grid||!model.coverage)throw new TypeError('Population renderer needs a validated population model.');
 const fields=new Map(),screens=new Map();let fieldBuilds=0,maskBuilds=0,imageDraws=0,lastYear=null,lastReason='not-drawn';
 function keep(map,key,value,limit){map.delete(key);map.set(key,value);while(map.size>limit){const oldest=map.keys().next().value,entry=map.get(oldest);if(map===fields&&entry.canvas){entry.canvas.width=0;entry.canvas.height=0}map.delete(oldest)}return value}
 function use(map,key){if(!map.has(key))return null;const value=map.get(key);map.delete(key);map.set(key,value);return value}
 function affine(project){
  let a,e,n;try{a=project(0,0);e=project(1,0);n=project(0,1)}catch(_){return null}
  if(![a,e,n].every(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(finite)))return null;
  const m={a:e[0]-a[0],b:e[1]-a[1],c:n[0]-a[0],d:n[1]-a[1],e:a[0],f:a[1]};
  // This contract prevents applying the 4% display curve twice.
  if(m.a<=0||m.d>=0||Math.abs(m.b)>1e-8||Math.abs(m.c)>1e-8)return null;
  let probe;try{probe=project(2,2)}catch(_){return null}
  if(!Array.isArray(probe)||probe.length<2||!probe.slice(0,2).every(finite)||Math.abs(probe[0]-(2*m.a+m.e))>1e-6||Math.abs(probe[1]-(2*m.d+m.f))>1e-6)return null;
  return m;
 }
 function field(year){
  let entry=use(fields,year);if(entry)return entry;
  const sample=model.sample(year),g=model.grid,canvas=canvasFactory(g.width,g.height);if(!canvas||typeof canvas.getContext!=='function')return null;
  canvas.width=g.width;canvas.height=g.height;const context=canvas.getContext('2d');if(!context||typeof context.putImageData!=='function'||typeof context.createImageData!=='function')return null;
  const image=context.createImageData(g.width,g.height),runs=[];
  for(let row=0;row<g.height;row++){
   let start=-1;
   for(let col=0;col<=g.width;col++){
    const i=row*g.width+col,known=col<g.width&&sample.valid[i]===1;
    if(known){if(start<0)start=col;image.data.set(Core.colorForDensity(sample.density[i]),i*4)}
    else if(start>=0){runs.push([g.west+start*g.stepDegrees,g.north-(row+1)*g.stepDegrees,g.west+col*g.stepDegrees,g.north-row*g.stepDegrees]);start=-1}
   }
  }
  context.putImageData(image,0,0);fieldBuilds++;
  entry={year,canvas,runs,totalPopulation:sample.totalPopulation,coveredAreaKm2:sample.coveredAreaKm2,validCells:sample.validCells,noDataCells:sample.noDataCells,bracket:sample.bracket};
  return keep(fields,year,entry,2);
 }
 function projectedMask(entry,m){
  const key=[entry.year,m.a,m.d,m.e,m.f].join('|');let value=use(screens,key);if(value)return value;
  value=entry.runs.map(b=>({x:b[0]*m.a+m.e,y:b[3]*m.d+m.f,w:(b[2]-b[0])*m.a,h:(b[1]-b[3])*m.d}));maskBuilds++;return keep(screens,key,value,4);
 }
 function draw(ctx,{project,view,bounds,landPath,year,strength=.5}={}){
  const result={drawn:false,year,sourceCellDegrees:model.grid.stepDegrees,sourceBased:true};
  const stop=reason=>{lastReason=reason;return {...result,reason}};
  if(!finite(strength)||strength<0||strength>1)return stop('invalid-strength');
  if(strength===0)return stop('hidden');
  if(!Number.isInteger(year)||year<Core.MIN_YEAR||year>Core.MAX_YEAR)return stop('invalid-year');
  if(!ctx||!['save','restore','drawImage','clip','beginPath','rect'].every(k=>typeof ctx[k]==='function')||typeof project!=='function')return stop('canvas-unavailable');
  if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height].every(finite)||bounds.width<=0||bounds.height<=0)return stop('invalid-bounds');
  const m=affine(project);if(!m)return stop('flat-map-plane-required');
  const b=model.coverage.bounds,x=b[0]*m.a+m.e,y=b[3]*m.d+m.f,w=(b[2]-b[0])*m.a,h=(b[1]-b[3])*m.d;
  if(x+w<bounds.x||x>bounds.x+bounds.width||y+h<bounds.y||y>bounds.y+bounds.height)return stop('outside-coverage');
  const entry=field(year);if(!entry)return stop('raster-unavailable');
  const mask=projectedMask(entry,m);if(!mask.length)return stop('source-data-unavailable');
  ctx.save();
  try{
   ctx.beginPath();for(const r of mask)ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();
   if(landPath){try{ctx.clip(landPath)}catch(_){return stop('land-mask-unavailable')}}
   ctx.globalCompositeOperation='multiply';ctx.globalAlpha=(finite(ctx.globalAlpha)?ctx.globalAlpha:1)*strength;ctx.imageSmoothingEnabled=true;if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
   ctx.drawImage(entry.canvas,x,y,w,h);imageDraws++;lastYear=year;lastReason='drawn';
  }finally{ctx.restore()}
  return {...result,drawn:true,totalPopulation:entry.totalPopulation,coveredAreaKm2:entry.coveredAreaKm2,validCells:entry.validCells,noDataCells:entry.noDataCells,bracket:entry.bracket,legendMaximumDensity:100,display:'Softened colour from a coarse source grid; no finer population data is inferred.'};
 }
 function clear(){for(const entry of fields.values()){entry.canvas.width=0;entry.canvas.height=0}fields.clear();screens.clear();lastReason='cleared'}
 return Object.freeze({draw,clear,get stats(){return {fieldBuilds,screenMaskBuilds:maskBuilds,imageDraws,fieldCacheEntries:fields.size,screenMaskCacheEntries:screens.size,lastYear,lastReason}}});
}
return Object.freeze({create});
});

const POPULATION24_CONFIG={"schemaVersion":1,"mode":"streamed","assetBase":"./","descriptor":{"url":"./assets/ca84e7f329ebdefd752c6c6bf7e8044eb6bba941eb9d72ef8653c0940fe415fc.json","bytes":635548,"sha256":"ca84e7f329ebdefd752c6c6bf7e8044eb6bba941eb9d72ef8653c0940fe415fc","mimeType":"application/json"},"data":null};
/* Optional rough population, independent of research-record density and old preferences. */
(function(){
'use strict';
if(window.population24&&typeof window.population24.open==='function')return;
if(typeof POPULATION24_CONFIG==='undefined'||typeof AncientWorldsPopulation==='undefined'||typeof AncientWorldsPopulationRenderer==='undefined'||typeof terrainLayer==='undefined'||typeof terrainLayer.render!=='function'){
 document.querySelector('.detail-hud')?.append(' · Population unavailable; map retained');return;
}
const config=POPULATION24_CONFIG,KEY='ancient-worlds.population24.v1',DEFAULT=Object.freeze({schemaVersion:1,enabled:false,strength:.55}),MAX_BYTES=2*1024*1024;
let settings={...DEFAULT},notice='',state='idle',lastError='',model=null,renderer=null,pending=null,attemptUsed=false,requestCount=0,generation=0,dataRevision=0,closed=false,suspended=false,view=null,renderFault=false,lastPaint=null,hudKey='',sampleKey='',sampleSummary=null,sourceFrames=[];
function validSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['schemaVersion','enabled','strength'].includes(k))||value.schemaVersion!==1||typeof value.enabled!=='boolean'||typeof value.strength!=='number'||!Number.isFinite(value.strength)||value.strength<0||value.strength>1)throw new TypeError('Population appearance needs schema version 1, an enabled flag and strength from 0 to 1.');
 return {schemaVersion:1,enabled:value.enabled,strength:value.strength};
}
try{const stored=localStorage.getItem(KEY);if(stored){if(stored.length>8192)throw Error('oversize');settings=validSettings(JSON.parse(stored))}}catch(_){notice='Saved population preferences could not be read. The default off setting is retained.'}
const style=el('style');style.textContent=`.p24{--p24-ink:#e9dcc1;--p24-muted:#c3cbbd;--p24-amber:#dfbb82}.p24 p{font-size:13px;line-height:1.75}.p24-hero{padding:21px;margin:18px 0;border:1px solid #9a8763;border-radius:9px;background:linear-gradient(130deg,#443b2c,#243539)}.p24 h3{font:27px/1.3 Georgia,serif;color:#f0d6a8;margin:7px 0 15px}.p24 .p24-muted{font-size:12px;color:var(--p24-muted)}.p24-kicker{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#d6b681}.p24-controls{display:grid;gap:14px;margin:20px 0}.p24-controls label{display:flex;align-items:center;gap:11px;flex-wrap:wrap;font-size:13px}.p24-controls input[type=range]{width:min(310px,100%)}.p24-actions{display:flex;gap:9px;flex-wrap:wrap;margin:17px 0}.p24-status{min-height:1.6em;color:#e0c38e;font-size:12px;line-height:1.65}.p24-sources{border-top:1px solid #6c7765;padding-top:16px;margin-top:20px}.p24-sources summary{cursor:pointer;color:#e0d3b4}.p24-sources a{overflow-wrap:anywhere}.p24-source{border-left:1px solid #8c9876;padding-left:13px;margin:18px 0}.p24-legend{margin-top:7px;padding-top:7px;border-top:1px solid #bda27666;max-width:310px}.p24-legend-title{color:#e4c493;font-size:10px;line-height:1.5}.p24-legend-meta{font-size:9px;line-height:1.5;color:#c0c9b8}.p24-legend-bar{height:6px;border-radius:3px;margin:6px 0 4px;border:1px solid #c5ad7d55}.p24-legend-ticks{height:13px;position:relative;font-size:8px;color:#d9cfb9}.p24-legend-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}.p24-legend-ticks span:first-child{transform:none}.p24-legend-ticks span:last-child{transform:translateX(-100%)}.p24 .p24-legend{max-width:100%;padding:14px;border:1px solid #7c8169;border-radius:7px;background:#1d3031}.p24 .p24-legend-title{font-size:12px}.p24 .p24-legend-meta{font-size:11px}#population24Legend{width:270px;max-width:100%;box-sizing:border-box}#population24Legend .p24-legend-title,#population24Legend .p24-legend-meta{height:1.5em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:620px){.p24-hero{padding:16px}.p24 h3{font-size:24px}.p24 p{font-size:12px}.p24-legend{max-width:270px}}`;document.head.append(style);
const tools=$('stage').querySelector('.maptools'),launch=btn(tools,'Population',()=>open());launch.id='population24Control';launch.setAttribute('aria-haspopup','dialog');
const hud=$('stage').querySelector('.detail-hud'),legend=createLegend();legend.root.id='population24Legend';legend.root.classList.add('hidden');hud?.append(legend.root);
let reader=null;try{if(typeof AncientWorldsAssets!=='undefined')reader=AncientWorldsAssets.create({baseURL:new URL(config.assetBase,location.href).href,maxActive:1,maxQueued:2})}catch(error){lastError=error.message}
const originalRender=terrainLayer.render,world=window.worldController,originalWorldMode=world?.setEnabled;
const living=()=>world?.enabled!==false,desired=()=>!closed&&!suspended&&settings.enabled&&living();
function repaint(){if(closed)return;curvaturePaintKey='';invalidate()}
function cancel(reason){
 generation++;if(pending){pending.controller.abort();pending=null;if(!model)attemptUsed=false}
 if(!model)state=attemptUsed&&lastError?'error':reason==='original'||reason==='suspended'?'paused':'idle';
}
function cachedSummary(){
 if(!model)return null;const key=dataRevision+'|'+year;if(sampleKey===key)return sampleSummary;
 const s=model.sample(year);sampleKey=key;return sampleSummary={yearBce:s.yearBce,totalPopulation:s.totalPopulation,coveredAreaKm2:s.coveredAreaKm2,validCells:s.validCells,sourceValidCells:s.sourceValidCells,complete:s.complete,bracket:s.bracket};
}
function roundedTotal(value){if(!Number.isFinite(value))return 'unavailable';return Number(value.toPrecision(2)).toLocaleString('en-US')}
function statusText(){
 if(closed)return 'Population layer closed.';
 if(!settings.enabled)return 'Population shading is off. Enable it to load the study-window estimates.';
 if(!living())return 'Population shading is paused in Original map. Your population setting is retained for Living world.';
 if(suspended)return 'Population loading is paused while this page is suspended.';
 if(state==='loading')return 'Loading population estimates · the map remains available.';
 if(renderFault)return 'Population shading is unavailable on this view. The map is retained; Retry can redraw the verified data.';
 if(state==='error'||state==='unavailable')return 'Population estimates could not be loaded or verified. The map remains available. Retry when ready.';
 if(lastPaint?.reason==='land-mask-pending')return 'Population shading is waiting for the land reference. The map remains available.';
 if(model){const s=cachedSummary();if(!s?.validCells)return 'Population estimates are unavailable at this date; unknown data is left unshaded.';return 'Baseline estimates · '+year+' BCE · substantial uncertainty remains.'}
 return 'Enable population density to inspect this optional layer.';
}
function gradient(){return 'linear-gradient(90deg,'+Array.from({length:33},(_,i)=>{const t=i/32,d=Math.expm1(t*Math.log1p(100)),c=AncientWorldsPopulation.colorForDensity(d);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+(c[3]/255*settings.strength).toFixed(4)+') '+(t*100).toFixed(2)+'%'}).join(',')+')'}
function createLegend(){
 const root=el('section','p24-legend'),title=el('div','p24-legend-title','Population · estimated people/km² of land'),bar=el('div','p24-legend-bar'),ticks=el('div','p24-legend-ticks'),meta=el('div','p24-legend-meta');
 root.setAttribute('aria-label','Population density legend');for(const stop of AncientWorldsPopulation.densityScale){const span=el('span','',stop.density===100?'100+':String(stop.density));span.style.left=(Math.log1p(stop.density)/Math.log1p(100)*100)+'%';ticks.append(span)}root.append(title,bar,ticks,meta);return {root,title,bar,ticks,meta};
}
function refresh(){
 if(closed)return;const active=settings.enabled&&living()&&!suspended,visible=active,status=statusText(),key=[settings.enabled,settings.strength,living(),suspended,state,renderFault,dataRevision,year,lastPaint?.drawn||false,lastPaint?.reason||'',notice].join('|');
 if(key!==hudKey){hudKey=key;const known=Boolean(model&&cachedSummary()?.validCells),landPending=lastPaint?.reason==='land-mask-pending';launch.classList.toggle('active',settings.enabled);launch.setAttribute('title','Population shading '+(settings.enabled?'on':'off')+' · open controls');legend.root.classList.toggle('hidden',!visible);legend.bar.style.background=gradient();const inkVisible=known&&!landPending&&!renderFault&&state==='ready';legend.bar.style.visibility=inkVisible?'visible':'hidden';legend.ticks.style.visibility=inkVisible?'visible':'hidden';
  legend.meta.textContent=landPending?'Land reference pending · shading paused':known&&!renderFault&&state==='ready'?(year+' BCE · '+(lastPaint?.reason==='outside-coverage'?'outside this layer’s coverage':'rough baseline · 0.5° cells')):state==='loading'?'Loading population estimates…':model&&!renderFault&&state==='ready'?'No population estimate at this date':'Population unavailable · use Retry';
 }
 if(view?.shell?.isConnected&&$('modal').contains(view.shell)&&!$('modalShade').classList.contains('hidden')&&view.key!==key){
  view.key=key;
  view.enabled.checked=settings.enabled;view.strength.value=String(Math.round(settings.strength*100));view.percent.textContent=Math.round(settings.strength*100)+'%';view.status.textContent=[status,notice].filter(Boolean).join(' ');view.retry.disabled=!settings.enabled||state==='loading'||!living()||suspended;
  const s=model?cachedSummary():null;view.sample.textContent=s?.validCells?'At '+year+' BCE, counts are interpolated between '+s.bracket.olderLabel+' and '+s.bracket.youngerLabel+'. '+(s.complete?'Study-window total':'Known-cell subtotal')+' about '+roundedTotal(s.totalPopulation)+' inhabitants.':'';
  view.legend.bar.style.background=gradient();view.legend.meta.textContent='Fixed absolute scale at every date. Shading intensity changes appearance, not population estimates.';
  if(view.sourceRevision!==dataRevision){populateSources(view.sourceRows);view.sourceRevision=dataRevision}
 }
}
function adopt(candidate){
 const checked=AncientWorldsPopulation.validate(candidate);if(!checked.valid)throw new TypeError(checked.errors.join(' '));
 const next=AncientWorldsPopulation.createModel(candidate),paint=AncientWorldsPopulationRenderer.create({model:next});
 renderer?.clear();model?.clear();model=next;renderer=paint;sourceFrames=candidate.frames.map(f=>({yearBce:f.yearBce,sourceLabel:f.sourceLabel}));dataRevision++;sampleKey='';sampleSummary=null;state='ready';lastError='';renderFault=false;lastPaint=null;
}
function ensure(){
 if(!desired()||model||pending||attemptUsed)return pending?.promise||Promise.resolve(Boolean(model));
 attemptUsed=true;state='loading';lastError='';const job={id:++generation,controller:new AbortController(),promise:null};pending=job;
 job.promise=Promise.resolve().then(()=>{
  if(job.id!==generation||job.controller.signal.aborted||!desired())throw Object.assign(new Error('Population load canceled'),{name:'AbortError'});
  if(config.mode==='embedded')return config.data;
  if(config.mode!=='streamed'||!reader||!/^https?:$/.test(location.protocol))throw Error('Use the local browser launcher or online game for streamed population data.');
  requestCount++;return reader.json(config.descriptor,{signal:job.controller.signal,maxBytes:MAX_BYTES});
 }).then(candidate=>{if(job.id!==generation||!desired()||job.controller.signal.aborted)return false;adopt(candidate);repaint();refresh();return true}).catch(error=>{
  if(job.id!==generation||closed||job.controller.signal.aborted)return false;
  state='error';lastError=error?.message||'Population data unavailable';refresh();return false;
 }).finally(()=>{if(pending===job)pending=null});refresh();return job.promise;
}
function setSettings(candidate){if(closed)return {...settings};const next=validSettings(candidate);settings=next;notice='';if(!settings.enabled)cancel('off');else if(!living())cancel('original');repaint();refresh();if(desired())void ensure();return {...settings}}
function setEnabled(value){if(typeof value!=='boolean')throw new TypeError('Population enabled must be boolean.');return setSettings({...settings,enabled:value})}
function setStrength(value){return setSettings({...settings,strength:value})}
function save(){if(closed)return false;try{localStorage.setItem(KEY,JSON.stringify(settings));notice='Population appearance saved on this device.'}catch(_){notice='Device preferences could not be saved. The current population drawing is retained.'}refresh()}
function reset(){if(closed)return false;setSettings({...DEFAULT});try{localStorage.removeItem(KEY);notice='Default population appearance restored; only its device preference was cleared.'}catch(_){notice='Default population appearance restored; the device preference could not be cleared.'}refresh()}
function retry(){if(closed||!settings.enabled||!living()||suspended)return Promise.resolve(false);if(model){renderer.clear();renderFault=false;lastPaint=null;state='ready';lastError='';repaint();refresh();return Promise.resolve(true)}cancel('retry');attemptUsed=false;state='idle';return ensure()}
function reconcileMode(){if(closed)return;if(!living()||suspended){cancel(!living()?'original':'suspended');lastPaint=null}else if(desired())void ensure();refresh()}
function wrappedRender(context,options={}){
 const result=originalRender.apply(this,arguments);if(closed)return result;
 if(!living()||suspended){if(pending)cancel(!living()?'original':'suspended');lastPaint=null;refresh();return result}
 if(settings.enabled&&renderer&&!renderFault){
  if(!options.landPath){lastPaint={drawn:false,reason:'land-mask-pending'};refresh();return result}
  let painted=null,last=null;try{
   const draw=project=>{const value=renderer.draw(context,{project,view:current,bounds:options.bounds,landPath:options.landPath,year,strength:settings.strength});last=value;if(value.drawn)painted=value};
   if(typeof worldCopies==='function')worldCopies(options.project,options.bounds,draw);else draw(options.project);
   lastPaint=painted||last||{drawn:false,reason:'outside-coverage'};
   if(['canvas-unavailable','flat-map-plane-required','raster-unavailable','land-mask-unavailable'].includes(lastPaint.reason)){renderFault=true;lastError=lastPaint.reason}
  }catch(error){renderFault=true;lastError=error?.message||'Population rendering unavailable';lastPaint=null}
 }
 refresh();return result;
}
terrainLayer.render=wrappedRender;
function wrappedMode(){const result=originalWorldMode.apply(this,arguments);reconcileMode();return result}
if(world&&typeof originalWorldMode==='function')world.setEnabled=wrappedMode;
const observer=typeof MutationObserver==='function'?new MutationObserver(reconcileMode):null;observer?.observe(document.body,{attributes:true,attributeFilter:['class']});
const offMap=window.mapView?.subscribe(()=>{if(!closed){reconcileMode();refresh()}});
function populateSources(rows){
 rows.replaceChildren();if(!model)return;
 for(const s of model.sources){const row=el('section','p24-source');p(row,s.title||s.id);for(const key of ['author','authors','attribution','license','access','meaning'])if(s[key])p(row,Array.isArray(s[key])?s[key].join(', '):String(s[key]),'p24-muted');if(/^https?:\/\//.test(s.url||'')){const link=el('a','source','Open source ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link)}rows.append(row)}
}
function sourceDetails(parent){
 const details=el('details','p24-sources');details.append(el('summary','','Sources, method and uncertainty'));
 p(details,'HYDE 3.3 population counts include urban and rural inhabitants. Ancient populations are reconstructed estimates with substantial uncertainty. This first layer shows the published baseline; uncertainty ranges are not displayed.');
 p(details,'The study window is 20°E–80°E and 4°N–50°N. Unshaded areas outside this window are outside this layer’s coverage. They do not indicate an absence of people. Counts from the source 5-arcminute cells are summed into 0.5° cells; density uses their aggregated HYDE land area.');
 p(details,'Counts are linearly interpolated between the coarse source dates. The colour field is softened for display, without creating finer local observations as you zoom. All dates use one fixed absolute density scale.');
 p(details,'The source folder’s 0 AD label is retained as the numeric interpolation anchor 0. The game displays only 3200–500 BCE; this does not assert an actual historical year zero.');
 p(details,'The downloaded grid README states CC BY 3.0, while the data portal lists CC BY 4.0. Both notices and source provenance are retained with the dataset.');
 const a=el('a','source','HYDE 3.3 dataset, source documentation and notices ↗');a.href='https://doi.org/10.24416/UU01-94FNH0';a.target='_blank';a.rel='noopener noreferrer';details.append(a);
 const rows=el('div');populateSources(rows);details.append(rows);parent.append(details);return rows;
}
function open(){
 if(closed)return null;window.worldController?.pauseJourney?.();const box=modal('Population through time'),shell=el('section','p24'),hero=el('section','p24-hero');
 hero.append(el('div','p24-kicker','HUMAN POPULATION · A ROUGH RECONSTRUCTION'),el('h3','','People across the landscape'));p(hero,'Explore estimated human population density as the shared timeline changes. The shading includes urban and rural inhabitants and remains independent of kingdoms, ecology and this project’s research focus.');shell.append(hero);
 const controls=el('div','p24-controls'),enabledRow=el('label'),enabled=el('input');enabled.type='checkbox';enabled.checked=settings.enabled;enabled.setAttribute('aria-label','Show population density');enabled.onchange=()=>setEnabled(enabled.checked);enabledRow.append(enabled,document.createTextNode('Show population density'));controls.append(enabledRow);
 const strengthRow=el('label','','Shading intensity'),strength=el('input'),percent=el('span');strength.type='range';strength.min=0;strength.max=100;strength.step=1;strength.value=String(Math.round(settings.strength*100));strength.setAttribute('aria-label','Population shading intensity');strength.oninput=()=>setStrength(Number(strength.value)/100);strengthRow.append(strength,percent);controls.append(strengthRow);shell.append(controls);
 const status=el('p','p24-status');status.setAttribute('role','status');shell.append(status);const sample=el('p','p24-muted');shell.append(sample);const key=createLegend();shell.append(key.root);
 const actions=el('div','p24-actions');btn(actions,'Save population appearance',save);btn(actions,'Reset population appearance',reset);const retryButton=btn(actions,'Retry population data',()=>void retry());shell.append(actions);const sourceRows=sourceDetails(shell);box.append(shell);view={box,shell,enabled,strength,percent,status,sample,legend:key,retry:retryButton,sourceRows,sourceRevision:dataRevision};refresh();return box;
}
function pagehide(event){suspended=true;cancel('suspended');if(!event?.persisted)close();else refresh()}
function pageshow(){if(closed)return;suspended=false;reconcileMode();repaint()}
function close(){
 if(closed)return;closed=true;cancel('closed');observer?.disconnect();offMap?.();window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);renderer?.clear();model?.clear();
 if(terrainLayer.render===wrappedRender)terrainLayer.render=originalRender;if(world&&world.setEnabled===wrappedMode)world.setEnabled=originalWorldMode;
 legend.root.remove();launch.remove();style.remove();view=null;state='closed';curvaturePaintKey='';invalidate();
}
window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
window.population24={open,setEnabled,setStrength,setSettings,retry,save,reset,close,get settings(){return {...settings}},get state(){return state},get stats(){return {state,enabled:settings.enabled,living:living(),closed,suspended,requestCount,automaticAttemptUsed:attemptUsed,pending:Boolean(pending),dataRevision,renderFault,lastError,render:renderer?.stats||null,assets:reader?.stats||null,sourceFrames:sourceFrames.map(f=>({...f}))}},get summary(){const s=closed?null:cachedSummary();return s?{...s,bracket:{...s.bracket}}:null},get densityScale(){return AncientWorldsPopulation.densityScale}};
reconcileMode();refresh();
})();
