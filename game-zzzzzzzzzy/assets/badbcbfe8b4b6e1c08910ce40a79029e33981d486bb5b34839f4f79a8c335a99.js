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

/* Source-qualified historical names. No translation, transliteration generation or geographic inference. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AncientWorldsNames25=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MIN_YEAR=500,MAX_YEAR=3200;
const SCRIPT_RANGES=Object.freeze({Cuneiform:[[0x12000,0x123ff],[0x12400,0x1254f]],EgyptianHieroglyphs:[[0x13000,0x1342f]],Phoenician:[[0x10900,0x1091f]],Ugaritic:[[0x10380,0x1039f]],ImperialAramaic:[[0x10840,0x1085f]],OldPersian:[[0x103a0,0x103df]],Hebrew:[[0x0590,0x05ff]],OldSouthArabian:[[0x10a60,0x10a7f]]});
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_:./-]{1,128}$/.test(s),plain=(s,max=3000)=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/.test(s);
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
function validate(data){
 const errors=[];const check=(ok,message)=>{if(!ok)errors.push(message);return ok};
 if(!check(data&&typeof data==='object'&&!Array.isArray(data),'Historical-name data must be an object.'))return {valid:false,errors};
 check(data.schemaVersion===1,'Unsupported historical-name schema.');
 const languages=Array.isArray(data.languages)?data.languages:[],sources=Array.isArray(data.sources)?data.sources:[],forms=Array.isArray(data.forms)?data.forms:[];
 check(languages.length>0&&languages.length<=16,'Between one and sixteen languages are required.');check(sources.length>0&&sources.length<=200,'Between one and two hundred sources are required.');check(forms.length>0&&forms.length<=500,'Between one and five hundred historical forms are required.');
 const langs=new Map(),sourceIds=new Set(),formIds=new Set(),ranges=new Map();
 for(const l of languages){if(!l||typeof l!=='object'){check(false,'Invalid language record.');continue}check(id(l.id)&&!langs.has(l.id),'Language identifiers must be valid and unique.');check(plain(l.label,120),'Language label is required.');check(Object.hasOwn(SCRIPT_RANGES,l.script),'Unsupported or missing script.');check(['ltr','rtl'].includes(l.direction),'Explicit language direction is required.');check(id(l.fontKey),'A bundled font key is required.');langs.set(l.id,l)}
 for(const s of sources){if(!s||typeof s!=='object'){check(false,'Invalid source record.');continue}check(id(s.id)&&!sourceIds.has(s.id),'Source identifiers must be valid and unique.');sourceIds.add(s.id);check(plain(s.title,500),'A source title is required.');let safe=false;try{const u=new URL(s.url);safe=u.protocol==='https:'&&!u.username&&!u.password}catch(_){}check(safe,'Source URLs must use HTTPS without credentials.');}
 for(const f of forms){
  if(!f||typeof f!=='object'){check(false,'Invalid historical form.');continue}
  check(id(f.id)&&!formIds.has(f.id),'Historical-form identifiers must be valid and unique.');formIds.add(f.id);
  const language=langs.get(f.languageId);check(!!language,'A historical form must reference an entered language.');
  check(plain(f.english,250),'An English identification is required.');check(plain(f.transliteration,250),'A source transliteration is required.');check(['endonym','historical-name'].includes(f.nameKind),'A historical name kind is required.');
  const points=typeof f.text==='string'?[...f.text]:[];check(points.length>0&&points.length<=96&&f.text===f.text.trim(),'A complete original-script name is required.');
  const scriptRanges=SCRIPT_RANGES[language?.script]||[];check(points.every(c=>c===' '||scriptRanges.some(([a,b])=>c.codePointAt(0)>=a&&c.codePointAt(0)<=b))&&points.some(c=>c!==' '),'Original text must use the declared script, without bidi controls or editorial ASCII substitutes.');
  check(plain(f.attestationNote),'Attestation information is required.');check(plain(f.displayNote),'The historical display envelope must be explained.');
  const dates=f.dates,validDates=!!dates&&integer(dates.startBce,MIN_YEAR,MAX_YEAR)&&integer(dates.endBce,MIN_YEAR,MAX_YEAR)&&dates.startBce>=dates.endBce;check(validDates,'Historical-name display dates must be explicit within 3200–500 BCE.');check(integer(f.priority,0,100),'An explicit integer variant priority is required.');
  check(Array.isArray(f.sourceRefs)&&f.sourceRefs.length>0&&f.sourceRefs.length<=12,'A historical form requires source references.');for(const ref of Array.isArray(f.sourceRefs)?f.sourceRefs:[])check(ref&&sourceIds.has(ref.sourceId)&&plain(ref.locator,1000),'Each source reference needs an entered source and locator.');
  check(Array.isArray(f.targets)&&f.targets.length>0&&f.targets.length<=12,'A historical form requires exact atlas targets.');const seen=new Set();
  for(const t of Array.isArray(f.targets)?f.targets:[]){if(!check(t&&['place','period'].includes(t.type)&&id(t.id),'Historical names may target only an exact place or period identifier.'))continue;const key=t.type+'|'+t.id;check(!seen.has(key),'Repeated target in one historical form.');seen.add(key);if(validDates){const prior=ranges.get(key)||[];for(const p of prior)check(p.priority!==f.priority||dates.endBce>p.dates.startBce||dates.startBce<p.dates.endBce,'Overlapping variants need different explicit priorities: '+key);prior.push(f);ranges.set(key,prior)}}
 }
 return {valid:errors.length===0,errors};
}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value)}return value}
function create(data){
 const proof=validate(data);if(!proof.valid)throw new TypeError(proof.errors.join(' '));
 const copy=JSON.parse(JSON.stringify(data)),languages=copy.languages,sources=copy.sources,byLanguage=new Map(languages.map(l=>[l.id,l]));
 const forms=copy.forms.map(f=>{const l=byLanguage.get(f.languageId);return freeze({...f,languageLabel:l.label,script:l.script,direction:l.direction,fontKey:l.fontKey,sourceIds:[...new Set(f.sourceRefs.map(r=>r.sourceId))]})});
 const index=new Map();for(const form of forms)for(const target of form.targets){const key=target.type+'|'+target.id;if(!index.has(key))index.set(key,[]);index.get(key).push(form)}for(const list of index.values())list.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 function lookup(type,targetId,yearBce){if(!['place','period'].includes(type)||!id(targetId)||!integer(yearBce,MIN_YEAR,MAX_YEAR))return null;return (index.get(type+'|'+targetId)||[]).find(f=>yearBce<=f.dates.startBce&&yearBce>=f.dates.endBce)||null}
 return Object.freeze({lookup,forms:Object.freeze(forms),languages:freeze(languages),sources:freeze(sources),coverage:copy.coverage?freeze(copy.coverage):null});
}
return Object.freeze({validate,create,MIN_YEAR,MAX_YEAR,SCRIPT_RANGES});
});

const NAMES25_CONFIG={"schemaVersion":1,"data":{"schemaVersion":1,"languages":[{"id":"sux","label":"Sumerian (written reference)","script":"Cuneiform","direction":"ltr","fontKey":"cuneiform"},{"id":"akk","label":"Akkadian","script":"Cuneiform","direction":"ltr","fontKey":"cuneiform"},{"id":"egy","label":"Egyptian","script":"EgyptianHieroglyphs","direction":"ltr","fontKey":"egyptian-hieroglyphs"},{"id":"hit","label":"Hittite","script":"Cuneiform","direction":"ltr","fontKey":"cuneiform"},{"id":"uga","label":"Ugaritic","script":"Ugaritic","direction":"ltr","fontKey":"ugaritic"},{"id":"phn","label":"Phoenician","script":"Phoenician","direction":"rtl","fontKey":"phoenician"},{"id":"peo","label":"Old Persian","script":"OldPersian","direction":"ltr","fontKey":"old-persian"},{"id":"obm","label":"Moabite","script":"Phoenician","direction":"rtl","fontKey":"phoenician"}],"sources":[{"id":"L25-EPSD-UNUG","title":"ePSD2, Unug, o0048210","url":"https://oracc2.museum.upenn.edu/epsd2/cbd/sux/o0048210.html","accessed":"2026-11-16","institution":"University of Pennsylvania / Oracc","evidence":"Unicode spelling table and corpus-period list"},{"id":"L25-EPSD-URIM","title":"ePSD2 royal glossary, Urim, o0048262","url":"https://build-oracc.museum.upenn.edu/epsd2/royal/cbd/qpn-x-places/U.html","accessed":"2026-11-16","institution":"University of Pennsylvania / Oracc","evidence":"Unicode spelling table and ED IIIb / Ur III / Old Babylonian distribution"},{"id":"L25-EPSD-NIBRU","title":"ePSD2, Nibru, o0046646","url":"https://oracc.museum.upenn.edu/epsd2/cbd/sux/o0046646.html","accessed":"2026-11-16","institution":"University of Pennsylvania / Oracc","evidence":"Unicode spelling table and corpus periods"},{"id":"L25-EPSD-LARSAM","title":"ePSD2 royal glossary, Larsam, o0045754","url":"https://oracc.museum.upenn.edu/epsd2/royal/cbd/qpn-x-places/onebigfile.html","accessed":"2026-11-16","institution":"University of Pennsylvania / Oracc","evidence":"Unicode spelling table, ED IIIb and Old Babylonian attestations"},{"id":"L25-EPSD-ERIDUG","title":"ePSD2, Eridug, o0044493","url":"https://oracc.museum.upenn.edu/epsd2/cbd/sux/o0044493.html","accessed":"2026-11-16","institution":"University of Pennsylvania / Oracc","evidence":"Unicode spelling table and corpus periods"},{"id":"L25-BTMAO-BABILI","title":"Babylonian Topographical Material Online, Babili","url":"https://oracc.museum.upenn.edu/btmao/cbd/qpn-x-places/B.html","accessed":"2026-11-16","institution":"Oracc / Babylonian Topographical Material Online","evidence":"Babili glossary gives the written form KÁ.DINGIR.RA.KI"},{"id":"L25-SAA13-ASSUR","title":"State Archives of Assyria 13, place glossary: Aššur","url":"https://oracc.museum.upenn.edu/saao/saa13/cbd/qpn-x-places/onebigfile.html","accessed":"2026-11-16","institution":"State Archives of Assyria Online / Oracc","evidence":"Neo-Assyrian corpus gives URU.aš-šur"},{"id":"L25-DCCLT-NINUA","title":"Digital Corpus of Cuneiform Lexical Texts: Ninua","url":"https://build-oracc.museum.upenn.edu/dcclt/cbd/qpn-x-places/summaries.html","accessed":"2026-11-16","institution":"University of California, Berkeley / Oracc","evidence":"Ninua, Old Babylonian and Neo-Assyrian, written ni-nu-a"},{"id":"L25-OSL","title":"Oracc Sign List: authoritative sign-to-Unicode mapping","url":"https://raw.githubusercontent.com/oracc/osl/master/00lib/osl.asl","accessed":"2026-11-16","institution":"Oracc","licenseNote":"The ASL source declares CC0.","evidence":"Mapping used only where a source provides sign transliteration rather than an already encoded word"},{"id":"L25-TLA-70010","title":"Thesaurus Linguae Aegyptiae, Mn-nfr — Memphis (lemma 70010)","url":"https://tla.digital/lemma/70010","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-43350","title":"Thesaurus Linguae Aegyptiae, Wꜣs.t — Thebes (lemma 43350)","url":"https://tla.digital/lemma/43350","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-22850","title":"Thesaurus Linguae Aegyptiae, Jwn.w — Heliopolis (lemma 22850)","url":"https://tla.digital/lemma/22850","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-103","title":"Thesaurus Linguae Aegyptiae, Ꜣbḏ.w — Abydos (lemma 103)","url":"https://tla.digital/lemma/103","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-81","title":"Thesaurus Linguae Aegyptiae, Ꜣbw — Elephantine (lemma 81)","url":"https://tla.digital/lemma/81","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-233","title":"Thesaurus Linguae Aegyptiae, Ꜣḫ.t-Jtn — Akhetaten (lemma 233)","url":"https://tla.digital/lemma/233","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Egyptian lemma, normalized Unicode spelling or explicitly listed spelling variant, and corpus attestation span","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-TLA-99860","title":"Thesaurus Linguae Aegyptiae, Ḥw.t-wꜥr.t — Avaris (lemma 99860)","url":"https://tla.digital/lemma/99860","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Canonical identifier of the Avaris place lemma. Direct page not inspected beyond verification gate; exact name, glyphs, place classification and corpus span are confirmed in its related PLACE99860 listing on primary TLA44740, separately cited.","renderingNotice":"Linear normalized spelling; no claim to reproduce a particular inscription layout or paleographic hand."},{"id":"L25-LAMAN-HATTUSA","title":"LAMAN: names in Hittite texts, CTH 14","url":"https://laman.hittites.org/cth/14/","accessed":"2026-11-16","authors":"M. Ali Akman, Michele Cammarosano, Adam Kryszeń","licenseNote":"Page declares CC BY-SA 4.0.","evidence":"KUB 36.100 reverse 5, URU ḫa-at-tu-ša, text classified Old/Middle Hittite with uncertainty"},{"id":"L25-UGARIT-DUL","title":"G. del Olmo Lete, El vocabulario de la agricultura de Ugarit, Aula Orientalis 37/1 (2019), 5–24","url":"https://www.ub.edu/ipoa/wp-content/uploads/2021/07/20191AuOrDelOlmo.pdf","accessed":"2026-11-16","institution":"University of Barcelona","evidence":"Page5 explicitly identifies ủgrt / ú-ga-rí-it as both city and territory; cites DUL27–28 for textual references"},{"id":"L25-UGARIT-RSO12","title":"D. Pardee, Les textes rituels, Ras Shamra-Ougarit XII","url":"https://www.mission-ougarit.fr/wp-content/pdf/mission_ougarit_publication_rso_121.pdf","accessed":"2026-11-16","institution":"Mission archéologique de Ras Shamra–Ougarit","evidence":"Primary scholarly edition of Ugaritic ritual corpus; Ugarit name written ùgrt"},{"id":"L25-UNICODE-UGAR","title":"Unicode character reference: Ugaritic","url":"https://www.unicode.org/charts/PDF/U10380.pdf","accessed":"2026-11-16","evidence":"U+1039C U, U+10382 GAMLA, U+10397 RASHA, U+1039A TO; character identities only, no chart images reproduced"},{"id":"L25-OXFORD-GBL","title":"The Semantics of Word Division in Northwest Semitic Writing Systems, section3.4.2","url":"https://ora.ox.ac.uk/objects/uuid:274e4b96-1684-416f-b06e-85148be80c89/files/sk3569535f","accessed":"2026-11-16","institution":"Oxford Research Archive","evidence":"KAI1.1,4.1 and7.2: mlk gbl, king of Byblos; indexed scholarly text inspected; direct download returned403"},{"id":"L25-UNICODE-PHNX","title":"Unicode character reference: Phoenician","url":"https://www.unicode.org/charts/PDF/U10900.pdf","accessed":"2026-11-16","evidence":"U+10902 GAML, U+10901 BET, U+1090B LAMD; character identities only, no chart images reproduced"},{"id":"L25-IRANICA-PARSA","title":"A. Shapur Shahbazi, Persepolis, Encyclopaedia Iranica","url":"https://www.iranicaonline.org/articles/persepolis/","accessed":"2026-11-16","evidence":"Names Persepolis as the acropolis of the city of Pārsa; publication2009, update2016"},{"id":"L25-IRANICA-CAPITALS","title":"Capital Cities, Encyclopaedia Iranica","url":"https://www.iranicaonline.org/articles/capital-cities/","accessed":"2026-11-16","evidence":"City of Pārsa construction began under Darius about520BCE"},{"id":"L25-UNICODE-XPEO","title":"Unicode character reference: Old Persian","url":"https://www.unicode.org/charts/PDF/U103A0.pdf","accessed":"2026-11-16","evidence":"U+103B1 PA, U+103A0 A, U+103BC RA, U+103BF SA; character identities only, no chart images reproduced"},{"id":"L25-TEIXIDOR-GBL","title":"Javier Teixidor, L’inscription d’Ahiram à nouveau, Syria64 (1987),137–140","url":"https://www.persee.fr/doc/syria_0039-7946_1987_num_64_1_6979","institution":"CNRS / Syria","evidence":"Primary epigraphic re-edition, p137: KAI1 line1 GBL; Ahiram inscription c1000BCE. Full page inspected.","accessed":"2026-11-16"},{"id":"L25-MNAMON-TYRE","title":"Mnamon: Ugaritic, Letter RS18.031 / KTU2.38","url":"https://mnamon.sns.it/index.php?id=30&lang=en&page=Esempi","institution":"Scuola Normale Superiore","evidence":"Primary letter transcription and translation, lines3 and12: ṣr = Tyre; Bordreuil/Pardee, ManualofUgaritic2009 text26; Hoftijzer1979 and Cunchillos1989 references. Corpus14th–12thcenturyBCE.","accessed":"2026-11-16"},{"id":"L25-ELAYI-PHN","title":"Josette Elayi, An Updated Chronology of the Reigns of Phoenician Kings during the Persian Period (539–333BCE),2006","url":"https://www.digitorient.com/wp/wp-content/uploads/2006/10/2Updated%20Chronology1.pdf","institution":"CNRS, Paris; author-hosted scholarly research","evidence":"PDF p4 explicitly gives Phoenician city names ṢDN, ṢR and GBL. PDF pp6–7 distinguish Sidonian chronology proposals, favor sixth-century context; specific reign bounds remain approximate. Full PDF inspected; text extraction corrupts ṣ, checked against visible PDF.","accessed":"2026-11-16"},{"id":"L25-UNIBO-ESHMUNAZAR","title":"The Phoenician Inscription of Eshmunazar: university text and translation","url":"https://spec.unibo.it/beni-archeologici/it/ammissione/fenicio.pdf/@@download/file/fenicio.pdf","institution":"University of Bologna","evidence":"KAI14 lines16/18: bṣdn, in Sidon; standalone consonantal toponym ṣdn identified by exact word segmentation, not plural demonym ṣdnm. Full primary text transcription and translation inspected.","accessed":"2026-11-16"},{"id":"L25-LAMAN-HATTI-OLD","title":"LAMAN, KBo10.2 / CTH4.II.A, Annals of ḪattušiliI","url":"https://laman.hittites.org/fragment/4704/","institution":"University of Naples; M.Ali Akman, Michele Cammarosano, Adam Kryszeń","license":"CC BY-SA4.0","evidence":"ColumnI line2 complete ḫa-at-ti with KUR URU classifiers; text concerns OldKingdom ḪattušiliI but extant copy classified jh (NewHittite). Full entry inspected.","accessed":"2026-11-16"},{"id":"L25-LAMAN-HATTI-LATE","title":"LAMAN, CTH68, Treaty of MuršiliII with Kupanta-Kurunta of Mira and Kuwaliya","url":"https://laman.hittites.org/cth/68/","institution":"University of Naples; M.Ali Akman, Michele Cammarosano, Adam Kryszeń","license":"CC BY-SA4.0","evidence":"KBo5.13 II26′ and KUB6.44 I2/IV35′: complete ḫa-at-ti with KUR URU. NewHittite text witnesses; full page inspected.","accessed":"2026-11-16"},{"id":"L25-KLOEKHORST-HATTI","title":"Alwin Kloekhorst, The Phonetics and Phonology of Hittite Intervocalic Fortis and Lenis Stops, BibliothecaOrientalis78 (2021)","url":"https://www.kloekhorst.nl/KloekhorstPhoneticsPhonologyHittiteFortisLenisStops2021.pdf","evidence":"Footnote29 explains HATTI in Hittite KUR URU HATTI is an Akkadogram for Hittite Ḫattuša. Written form must not be presented as a guaranteed spoken Hittite pronunciation.","accessed":"2026-11-16"},{"id":"L25-RINAP-ASSYRIA","title":"RINAP1, Tiglath-pileserIII47 / Q003460, obverse43","url":"https://oracc.museum.upenn.edu/rinap/rinap1/Q003460/","institution":"ORACC / University of Pennsylvania; Tadmor and Yamada edition","evidence":"Obverse43: a-na mi-ṣir KUR aš-šur GUR-ra, translated annexed to Assyria; no trailing KI in this selected occurrence. Catalog dates composition744–727BCE. Indexed corpus transliteration/translation inspected; direct open intermittently502.","accessed":"2026-11-16"},{"id":"L25-RIAO-ASSYRIA","title":"RIAO, AshurnasirpalII inscription Q004492, line1","url":"https://oracc.museum.upenn.edu/riao/Q004492/","institution":"ORACC / University of Pennsylvania","evidence":"Primary royal titulary MAN KUR aš-šur, king of Assyria. Earlier NeoAssyrian witness supporting the written country name; indexed corpus text inspected; direct open timed out.","accessed":"2026-11-16"},{"id":"L25-ALIZADEH-PARSA","title":"Kiumars Alizadeh, The Earliest Persians in Iran: Toponyms and Persian Ethnicity, DABIR7 (2020)","url":"https://bpb-us-e2.wpmucdn.com/sites.uci.edu/dist/4/2521/files/2020/05/7_03_DABIR-Issue-7_Alizadeh.pdf","institution":"University of California, Irvine, SamuelJordanCenter","evidence":"Article p40 / PDFp30: Bīsotūn DBI§6 line14 Pārsa, a toponym for southwest Persia (Fārs), distinguished from ethnonym uses and earlier debated Parsua/Parsumaš. Full scholarly primary-text analysis inspected.","accessed":"2026-11-16"},{"id":"L25-MNAMON-DIBON","title":"Mnamon: Moabite, Meša stone transcription and translation","url":"https://mnamon.sns.it/index.php?id=44&lang=en&page=Esempi","institution":"Scuola Normale Superiore","evidence":"Meša stone, second half of ninth centuryBCE: complete DYBN in lines21,28; translation Dibon. Use undisputed city-name sequence, not disputed bottom-line royal reconstruction. Full page inspected.","accessed":"2026-11-16"},{"id":"L25-TLA-44740-RELATED","title":"Thesaurus Linguae Aegyptiae, wꜥr.t (lemma44740), related PLACE lemma99860","url":"https://tla.digital/lemma/44740","accessed":"2026-11-16","institution":"Berlin-Brandenburg Academy of Sciences and Humanities / Saxon Academy of Sciences in Leipzig","evidence":"Cached primary related-lemmata listing explicitly identifies PLACE99860 as Avaris, prints 𓉗𓏏𓉐𓂾𓏏𓊖 and corpus1548–1198BCE, Wb1,287.8. Separately listed institution852422 is a later Osiris sanctuary and is excluded. Direct download was a verification page, not lemma content."}],"forms":[{"id":"L25-URUK-SUX","targets":[{"type":"place","id":"PL912986"}],"english":"Uruk","languageId":"sux","text":"𒀕𒆠","transliteration":"Unug; unug{ki}","dates":{"startBce":2600,"endBce":1600},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-EPSD-UNUG","locator":"o0048210, spelling[1] and ED IIIa through Old Babylonian corpus periods"}],"attestationNote":"ePSD2 prints this exact Unicode spelling. Sumerian Unug is linked to Akkadian Uruk in its lexical associations. The initial pass uses the conservative Early Dynastic-to-Old Babylonian reference window.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-UR-SUX","targets":[{"type":"place","id":"PL912985"}],"english":"Ur","languageId":"sux","text":"𒋀𒀕𒆠","transliteration":"Urim; urim₂{ki}","dates":{"startBce":2500,"endBce":1600},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-EPSD-URIM","locator":"Urim o0048262, spelling[2], with ED IIIb, Old Akkadian, Ur III and Old Babylonian examples"}],"attestationNote":"The royal glossary prints this exact Unicode spelling; the alternative urim₅ spelling is not substituted. The KI sign is a written place classifier, not a pronounced part of Urim.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-NIPPUR-SUX","targets":[{"type":"place","id":"PL912910"}],"english":"Nippur","languageId":"sux","text":"𒂗𒆤𒆠","transliteration":"Nibru; nibru{ki}","dates":{"startBce":2600,"endBce":1600},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-EPSD-NIBRU","locator":"o0046646 spelling[1]; ED IIIa through Old Babylonian corpus periods"}],"attestationNote":"Exact ePSD2 Unicode spelling of the Sumerian place name; no inference from the individual signs is made.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-LARSA-SUX","targets":[{"type":"place","id":"PL912897"}],"english":"Larsa","languageId":"sux","text":"𒌓𒀕𒆠","transliteration":"Larsam; larsam{ki}","dates":{"startBce":2500,"endBce":1600},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-EPSD-LARSAM","locator":"Larsam o0045754 spelling[1], ED IIIb and Old Babylonian attestations"}],"attestationNote":"Exact Unicode spelling in ePSD2 royal glossary, with the normalized Sumerian place-name reading Larsam.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-ERIDU-SUX","targets":[{"type":"place","id":"PL912845"}],"english":"Eridu","languageId":"sux","text":"𒉣𒆠","transliteration":"Eridug; eridug{ki}","dates":{"startBce":2500,"endBce":1600},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-EPSD-ERIDUG","locator":"o0044493 spelling[1], ED IIIb through Old Babylonian corpus periods"}],"attestationNote":"Exact ePSD2 Unicode spelling, normalized as Sumerian Eridug. It is a reference name, not a reconstruction of the changing settlement footprint.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-BABYLON-AKK","targets":[{"type":"place","id":"PL893951"}],"english":"Babylon","languageId":"akk","text":"𒆍𒀭𒊏𒆠","transliteration":"Bābili; KÁ.DINGIR.RA.KI","dates":{"startBce":2000,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-BTMAO-BABILI","locator":"Babili entry, written form KÁ.DINGIR.RA.KI"},{"sourceId":"L25-OSL","locator":"KA₂ + AN(DINGIR) + RA + KI Unicode sign mappings"}],"attestationNote":"A normalized Unicode rendering of an explicitly attested logographic spelling read Bābili in Akkadian. Many historical spellings exist; this is one conventional reference form. The window denotes the Babylonian written tradition, not the earliest dated instance of this exact sign sequence.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-ASSUR-AKK","targets":[{"type":"place","id":"PL893945"}],"english":"Assur","languageId":"akk","text":"𒌷𒀸𒋩","transliteration":"Aššur; URU.aš-šur","dates":{"startBce":911,"endBce":609},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-SAA13-ASSUR","locator":"Aššur place entry: URU.aš-šur"},{"sourceId":"L25-OSL","locator":"URU + AŠ + ŠUR Unicode mappings"}],"attestationNote":"Source-qualified Neo-Assyrian city spelling, with the city classifier URU. It is not the divine name with DINGIR and is not a modern Syriac or Arabic replacement.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-NINEVEH-AKK","targets":[{"type":"place","id":"PL874621"}],"english":"Nineveh","languageId":"akk","text":"𒉌𒉡𒀀","transliteration":"Ninua; ni-nu-a","dates":{"startBce":2000,"endBce":609},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-DCCLT-NINUA","locator":"Ninua[1], Old Babylonian and Neo-Assyrian, written ni-nu-a"},{"sourceId":"L25-OSL","locator":"NI + NU + A Unicode mappings"}],"attestationNote":"Normalized Unicode conversion of the source sign transliteration. The Old Babylonian-to-Neo-Assyrian display envelope is not an inferred annual attestation or a settlement occupation span.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-MEMPHIS-EGY","targets":[{"type":"place","id":"PL736963"}],"english":"Memphis","languageId":"egy","text":"𓏠𓈖𓄤𓉴𓊖","transliteration":"Mn-nfr","dates":{"startBce":1539,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-70010","locator":"Lemma70010 normalized hieroglyphic spelling; corpus span1539BCE–30BCE"}],"attestationNote":"TLA prints this exact normalized spelling. The earlier name of Memphis is not silently replaced with Mn-nfr before the source corpus window.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-THEBES-EGY","targets":[{"type":"place","id":"PL786017"}],"english":"Thebes","languageId":"egy","text":"𓋆𓏏𓊖","transliteration":"Wꜣs.t","dates":{"startBce":2008,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-43350","locator":"Lemma43350, explicitly listed spelling 𓋆𓏏𓊖; corpus span2008BCE–324CE"}],"attestationNote":"A directly listed TLA variant of the Egyptian place name. The font displays a normalized horizontal line rather than an inscription-specific quadrat arrangement.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-HELIOPOLIS-EGY","targets":[{"type":"place","id":"PL727117"}],"english":"Heliopolis","languageId":"egy","text":"𓇋𓏌𓊖","transliteration":"Jwn.w","dates":{"startBce":2686,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-22850","locator":"Lemma22850, explicitly listed spelling 𓇋𓏌𓊖; corpus span2686BCE–324CE"}],"attestationNote":"An explicitly listed spelling variant is selected instead of the newer extended-Unicode headword glyph. The source documents the Egyptian name, not a modern Arabic label.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-ABYDOS-EGY","targets":[{"type":"place","id":"PL756512"}],"english":"Abydos","languageId":"egy","text":"𓍋𓃀𓈋𓊖","transliteration":"Ꜣbḏ.w","dates":{"startBce":2686,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-103","locator":"Lemma103 normalized hieroglyphic spelling; corpus span2686BCE–324CE"}],"attestationNote":"Exact TLA normalized hieroglyphic spelling of Abydos. The corpus span is a lemma-level attestation envelope, not the first/last year of this individual visual variant.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-ELEPHANTINE-EGY","targets":[{"type":"place","id":"PL786021"}],"english":"Elephantine","languageId":"egy","text":"𓍋𓃀𓃰𓅱𓎶𓈉","transliteration":"Ꜣbw","dates":{"startBce":2686,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-81","locator":"Lemma81 normalized hieroglyphic spelling; lemma corpus spans3350BCE–324CE"}],"attestationNote":"Exact TLA normalized spelling; its lemma includes very early evidence. This first display is conservatively limited to the Old Kingdom and later, without projecting this normalized spelling into the earliest writing.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-AKHETATEN-EGY","targets":[{"type":"place","id":"PL149576487"}],"english":"Akhetaten / Amarna","languageId":"egy","text":"𓈌𓐍𓏏𓇋𓏏𓈖𓇳","transliteration":"Ꜣḫ.t-Jtn","dates":{"startBce":1353,"endBce":664},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-233","locator":"Lemma233 normalized hieroglyphic spelling; corpus span1353BCE–664BCE"}],"attestationNote":"Exact TLA normalized spelling. Later textual recollection of the name does not establish that the royal city continued to operate through664BCE.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-AVARIS-EGY","targets":[{"type":"place","id":"PL727080"}],"english":"Avaris","languageId":"egy","text":"𓉗𓏏𓉐𓂾𓏏𓊖","transliteration":"Ḥw.t-wꜥr.t","dates":{"startBce":1548,"endBce":1198},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TLA-44740-RELATED","locator":"Related lemmata: PLACE99860, Avaris, 𓉗𓏏𓉐𓂾𓏏𓊖, 12 corpus sentences,1548–1198BCE,Wb1,287.8; excludes institution852422"},{"sourceId":"L25-TLA-99860","locator":"Canonical PLACE identifier; direct access verification-gated, actual printed confirmation in related PLACE listing on lemma44740"}],"attestationNote":"The exact printed name and glyph sequence are confirmed in the primary TLA44740 related-lemmata listing for PLACE99860, Avaris. Direct lemma99860 access was verification-gated. The separately listed later Osiris sanctuary, institution852422, supplies no glyphs or dates to this record.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-HATTUSA-HIT","targets":[{"type":"place","id":"PL283602441"}],"english":"Hattusa","languageId":"hit","text":"𒌷𒄩𒀜𒌅𒊭","transliteration":"Ḫattuša; URU.ḫa-at-tu-ša","dates":{"startBce":1650,"endBce":1180},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-LAMAN-HATTUSA","locator":"CTH14; KUB36.100 reverse5: URU ḫa-at-tu-ša, ah./mh?"},{"sourceId":"L25-OSL","locator":"URU + ḪA + AT + TU + ŠA Unicode mappings"}],"attestationNote":"The complete source sign sequence is normalized into Unicode, preserving the unpronounced city classifier. The broad Old-to-Late Hittite reference window is editorial; it does not turn a copy-date classification into an exact founding date.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-UGARIT-UGA","targets":[{"type":"place","id":"UGARIT"}],"english":"Ugarit / Ras Shamra","languageId":"uga","text":"𐎜𐎂𐎗𐎚","transliteration":"ủgrt","dates":{"startBce":1400,"endBce":1180},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-UGARIT-DUL","locator":"Page5, ủgrt; DUL27–28 reference"},{"sourceId":"L25-UGARIT-RSO12","locator":"Ritual corpus, toponym ùgrt"},{"sourceId":"L25-UNICODE-UGAR","locator":"U+1039C U + U+10382 GAMLA + U+10397 RASHA + U+1039A TO"}],"attestationNote":"Unicode conversion of the scholarly consonantal spelling, including Ugaritic u-aleph rather than a generic a-aleph. The city and kingdom shared this toponym; this record targets only the actual city label.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-BYBLOS-PHN","targets":[{"type":"place","id":"PL668216"}],"english":"Byblos","languageId":"phn","text":"𐤂𐤁𐤋","transliteration":"gbl","dates":{"startBce":1000,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-TEIXIDOR-GBL","locator":"Syria64 (1987),p137, Ahiram/KAI1 line1: MLK GBL; c1000BCE"},{"sourceId":"L25-OXFORD-GBL","locator":"Section3.4.2, KAI1.1/4.1/7.2: mlk gbl, king of Byblos"},{"sourceId":"L25-UNICODE-PHNX","locator":"GAML + BET + LAMD"}],"attestationNote":"Normalized Phoenician letters for the attested consonantal name gbl. No unattested vowels are inserted into the original-script line. The conservative Iron Age display window is separate from the much longer history of the site.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-PERSEPOLIS-PEO","targets":[{"type":"place","id":"PL922695"}],"english":"Persepolis","languageId":"peo","text":"𐎱𐎠𐎼𐎿","transliteration":"Pārsa","dates":{"startBce":520,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-IRANICA-PARSA","locator":"Opening identification: acropolis of the city of Pārsa"},{"sourceId":"L25-IRANICA-CAPITALS","locator":"Pārsa construction beginning about520BCE"},{"sourceId":"L25-UNICODE-XPEO","locator":"PA + A + RA + SA"}],"attestationNote":"A normalized Old Persian rendering of the ancient city name Pārsa. The name also designated Persia; it is not assigned to every Persian province or to all earlier Anshan periods.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-TYRE-UGA","targets":[{"type":"place","id":"PL678437"}],"english":"Tyre","languageId":"uga","text":"𐎕𐎗","transliteration":"ṣr","dates":{"startBce":1400,"endBce":1180},"priority":50,"nameKind":"historical-name","sourceRefs":[{"sourceId":"L25-MNAMON-TYRE","locator":"RS18.031 / KTU2.38 lines3,12; king of Tyre and ships at Tyre"},{"sourceId":"L25-UNICODE-UGAR","locator":"U+10395 SADE + U+10397 RASHA"}],"attestationNote":"Historical Ugaritic diplomatic spelling of Tyre, from a letter issued by its king but probably translated from Akkadian. This is not a claim that Ugaritic was the exclusive vernacular of Tyre. The display window follows the corpus horizon, not a precisely dated individual letter.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-TYRE-PHN","targets":[{"type":"place","id":"PL678437"}],"english":"Tyre","languageId":"phn","text":"𐤑𐤓","transliteration":"ṣr","dates":{"startBce":539,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-ELAYI-PHN","locator":"PDFp4: Phoenician name of Tyre, ṢR"},{"sourceId":"L25-UNICODE-PHNX","locator":"U+10911 SADE + U+10913 ROSH"}],"attestationNote":"Consonantal Phoenician city name explicitly stated in Elayi’s original epigraphic-historical synthesis. The restricted Persian-period display is an editorial reference envelope. A specific pre500BCE artifact spelling is not claimed here; this is the scholar’s normalized historical name rather than a dated local epigraphic facsimile.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-SIDON-PHN","targets":[{"type":"place","id":"PL678393"}],"english":"Sidon","languageId":"phn","text":"𐤑𐤃𐤍","transliteration":"ṣdn","dates":{"startBce":550,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-UNIBO-ESHMUNAZAR","locator":"KAI14 lines16,18; BṢDN, in Sidon; p2 of transcription"},{"sourceId":"L25-ELAYI-PHN","locator":"PDFp4 identifies ṢDN; pp6–7 explain higher sixth-century dating and approximations"},{"sourceId":"L25-UNICODE-PHNX","locator":"SADE + DELT + NUN"}],"attestationNote":"Phoenician city name selected from b-ṣdn in Eshmunazar’s inscription, preserving the base city name and excluding the prefixed preposition. It is distinct from ṣdnm, Sidonians. The sixth-century display follows Elayi’s higher chronology; alternative fifth-century dating exists and is not silently resolved by this optional label.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-HATTI-HIT","targets":[{"type":"period","id":"CA04"},{"type":"period","id":"CA05"},{"type":"period","id":"CA06"}],"english":"Ḫatti / Hittite kingdom","languageId":"hit","text":"𒆳𒌷𒄩𒀜𒋾","transliteration":"Ḫatti (written Akkadogram); KUR.URU.ḫa-at-ti","dates":{"startBce":1650,"endBce":1180},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-LAMAN-HATTI-OLD","locator":"KBo10.2 / CTH4.II.A columnI line2, KUR URU ḫa-at-ti; NewHittite copy of OldKingdom annals"},{"sourceId":"L25-LAMAN-HATTI-LATE","locator":"KBo5.13 II26′; KUB6.44 I2/IV35′: KUR URU ḫa-at-ti"},{"sourceId":"L25-KLOEKHORST-HATTI","locator":"Footnote29: HATTI is an Akkadogram in Hittite writing"},{"sourceId":"L25-OSL","locator":"KUR + URU + ḪA + AT + TI Unicode mappings"}],"attestationNote":"Country name used in Hittite writing, retaining the country and city classifiers. Ḫatti is the conventional reading of an Akkadogram, not a guaranteed spoken Hittite pronunciation. Targets refer only to the Hittite-kingdom component of the captions; this does not rename the Kaska, assign boundaries, or turn a later manuscript into a contemporary OldKingdom artifact.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-ASSYRIA-AKK","targets":[{"type":"period","id":"NM12"}],"english":"Assyria / Neo-Assyrian kingdom","languageId":"akk","text":"𒆳𒀸𒋩","transliteration":"māt Aššur; KUR.aš-šur","dates":{"startBce":911,"endBce":609},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-RINAP-ASSYRIA","locator":"Tiglath-pileserIII47 obverse43, Q003460: KUR aš-šur; selected country occurrence without trailing KI"},{"sourceId":"L25-RIAO-ASSYRIA","locator":"Q004492 line1: MAN KUR aš-šur, king of Assyria"},{"sourceId":"L25-OSL","locator":"KUR + AŠ + ŠUR Unicode mappings"}],"attestationNote":"Country-name spelling with KUR, distinct from the URU-classified city Aššur record. The NeoAssyrian atlas-period window limits display, while source witnesses are actual royal texts within that period. The modern prefix Neo- and the word empire have not been translated into invented ancient words.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-PERSIA-PEO","targets":[{"type":"period","id":"FA08"}],"english":"Persia / Achaemenid heartland","languageId":"peo","text":"𐎱𐎠𐎼𐎿","transliteration":"Pārsa","dates":{"startBce":520,"endBce":500},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-ALIZADEH-PARSA","locator":"Articlep40 / PDFp30: DBcolumnI §6 line14, Pārsa as southwest Persian country"},{"sourceId":"L25-UNICODE-XPEO","locator":"PA + A + RA + SA"}],"attestationNote":"Pārsa as the Persian homeland in Darius’s Bīsotūn inscription, corresponding to the existing Fārs/Anshan heartland caption. This country use is separate from the Persepolis city-name record. It does not rename the entire multinational empire or project OldPersian script back onto earlier Anshan. Display begins conservatively within Darius’s inscriptional era.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."},{"id":"L25-DIBON-OBM","targets":[{"type":"place","id":"PL697654"}],"english":"Dibon","languageId":"obm","text":"𐤃𐤉𐤁𐤍","transliteration":"dybn","dates":{"startBce":850,"endBce":800},"priority":50,"nameKind":"endonym","sourceRefs":[{"sourceId":"L25-MNAMON-DIBON","locator":"Meša stone lines21,28: DYBN; second half of ninth centuryBCE"},{"sourceId":"L25-UNICODE-PHNX","locator":"DELT + YOD + BET + NUN"}],"attestationNote":"Moabite city spelling from Meša’s inscription. Unicode Phoenician-block letters encode the shared early NorthwestSemitic letter identities; the typeface is a normalized comparison, not a reproduction of the particular Moabite hand. The deliberately narrow ninth-century envelope does not imply Dibon disappeared afterward.","displayNote":"A conservative editorial display window for a sourced historical written name. It is not a year-by-year spelling series, an occupation span, a claim of exclusive spoken language, or a facsimile of ancient handwriting."}],"coverage":{"status":"curated source-backed proposal with explicit evidence qualifications; not exhaustive","placeCount":22,"formCount":26,"languageCount":8,"sourceQualification":"All source facts come from academic dictionaries, scholarly corpora/editions, authoritative subject scholarship or normative character references. Unicode conversion is identified where the source supplies transliteration. No modern geographic-language assignment.","datePolicy":"Display dates are explicit conservative editorial name-reference envelopes, not annual observations, language-frontier polygons, city occupation dates or dates for a particular paleographic font. Lemma-level source spans may include historical recollections.","omissions":"No guessed readings for undeciphered scripts; no modern square-Hebrew/Arabic/Persian stand-ins; no automatic translation of editorial dynasty numbers or entire composite regions. Hebrew, Aramaic, Hurrian and Elamite forms await specific qualified records. Tyre Phoenician is a scholar-stated normalized form without a dated pre500 artifact locator; preserve that qualification.","periodTargetCount":5,"realmFormCount":3}},"fonts":[{"key":"cuneiform","family":"AW25Cuneiform","bytes":298032,"sha256":"4a92af1f332ccd2d64375e98ca6becf79a26e50381fda3e268a44c90f8699be0","mimeType":"font/woff2","url":"./assets/4a92af1f332ccd2d64375e98ca6becf79a26e50381fda3e268a44c90f8699be0.woff2"},{"key":"egyptian-hieroglyphs","family":"AW25Egyptian","bytes":265168,"sha256":"d81f5f673ac465bc84646e16e93c315bfe9d15fba0f6a520309e01539b6260c6","mimeType":"font/woff2","url":"./assets/d81f5f673ac465bc84646e16e93c315bfe9d15fba0f6a520309e01539b6260c6.woff2"},{"key":"old-persian","family":"AW25OldPersian","bytes":4908,"sha256":"8f1fe97c70d27985a886f1bce45dd88a81b3b65360674f1b37f2981e9ceced1f","mimeType":"font/woff2","url":"./assets/8f1fe97c70d27985a886f1bce45dd88a81b3b65360674f1b37f2981e9ceced1f.woff2"},{"key":"phoenician","family":"AW25Phoenician","bytes":3384,"sha256":"1fd27b9dd8475be099eee4e5b046b2de400b1f8ada59ddc923a75889cc953f00","mimeType":"font/woff2","url":"./assets/1fd27b9dd8475be099eee4e5b046b2de400b1f8ada59ddc923a75889cc953f00.woff2"},{"key":"ugaritic","family":"AW25Ugaritic","bytes":2880,"sha256":"ff632ea6c0fedca176494f1aaa40db9a1ca2bc71a2831d52ab8280351816b4a4","mimeType":"font/woff2","url":"./assets/ff632ea6c0fedca176494f1aaa40db9a1ca2bc71a2831d52ab8280351816b4a4.woff2"}],"assetBase":"./","fontLicense":{"url":"./assets/c14d6dac822aae95c63b3954e8274735dd0effc9212a60f0505e9d1cc359d849.txt","bytes":5359,"sha256":"c14d6dac822aae95c63b3954e8274735dd0effc9212a60f0505e9d1cc359d849","mimeType":"text/plain"},"fontLicenseText":"Ancient Worlds original-language label fonts — derived Noto faces\n\nModifications: full original repertoire retained; WOFF2 packaging and AW25 family/PostScript names only. Outlines, advance metrics, character mappings and source notices remain exact. No endorsement by Noto Project authors is implied.\n\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/cuneiform)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/egyptian-hieroglyphs)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/phoenician)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/ugaritic)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/imperial-aramaic)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/old-persian)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/hebrew)\nCopyright 2024 The Noto Project Authors (https://github.com/notofonts/hebrew)\nCopyright 2022 The Noto Project Authors (https://github.com/notofonts/old-south-arabian)\n\nFamilies: AW25Cuneiform, AW25Egyptian, AW25Phoenician, AW25Ugaritic, AW25Aramaic, AW25OldPersian, AW25Hebrew, AW25SouthArabian\n\nExact upstream OFL.txt files are retained separately per face. The common SIL Open Font License follows.\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n-----------------------------------------------------------\n\nPREAMBLE\nThe goals of the Open Font License (OFL) are to stimulate worldwide\ndevelopment of collaborative font projects, to support the font creation\nefforts of academic and linguistic communities, and to provide a free and\nopen framework in which fonts may be shared and improved in partnership\nwith others.\n\nThe OFL allows the licensed fonts to be used, studied, modified and\nredistributed freely as long as they are not sold by themselves. The\nfonts, including any derivative works, can be bundled, embedded, \nredistributed and/or sold with any software provided that any reserved\nnames are not used by derivative works. The fonts and derivatives,\nhowever, cannot be released under any other type of license. The\nrequirement for fonts to remain under this license does not apply\nto any document created using the fonts or their derivatives.\n\nDEFINITIONS\n\"Font Software\" refers to the set of files released by the Copyright\nHolder(s) under this license and clearly marked as such. This may\ninclude source files, build scripts and documentation.\n\n\"Reserved Font Name\" refers to any names specified as such after the\ncopyright statement(s).\n\n\"Original Version\" refers to the collection of Font Software components as\ndistributed by the Copyright Holder(s).\n\n\"Modified Version\" refers to any derivative made by adding to, deleting,\nor substituting -- in part or in whole -- any of the components of the\nOriginal Version, by changing formats or by porting the Font Software to a\nnew environment.\n\n\"Author\" refers to any designer, engineer, programmer, technical\nwriter or other person who contributed to the Font Software.\n\nPERMISSION & CONDITIONS\nPermission is hereby granted, free of charge, to any person obtaining\na copy of the Font Software, to use, study, copy, merge, embed, modify,\nredistribute, and sell modified and unmodified copies of the Font\nSoftware, subject to the following conditions:\n\n1) Neither the Font Software nor any of its individual components,\nin Original or Modified Versions, may be sold by itself.\n\n2) Original or Modified Versions of the Font Software may be bundled,\nredistributed and/or sold with any software, provided that each copy\ncontains the above copyright notice and this license. These can be\nincluded either as stand-alone text files, human-readable headers or\nin the appropriate machine-readable metadata fields within text or\nbinary files as long as those fields can be easily viewed by the user.\n\n3) No Modified Version of the Font Software may use the Reserved Font\nName(s) unless explicit written permission is granted by the corresponding\nCopyright Holder. This restriction only applies to the primary font name as\npresented to the users.\n\n4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font\nSoftware shall not be used to promote, endorse or advertise any\nModified Version, except to acknowledge the contribution(s) of the\nCopyright Holder(s) and the Author(s) or with their explicit written\npermission.\n\n5) The Font Software, modified or unmodified, in part or in whole,\nmust be distributed entirely under this license, and must not be\ndistributed under any other license. The requirement for fonts to\nremain under this license does not apply to any document created\nusing the Font Software.\n\nTERMINATION\nThis license becomes null and void if any of the above conditions are\nnot met.\n\nDISCLAIMER\nTHE FONT SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT\nOF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE\nCOPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,\nINCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL\nDAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\nFROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM\nOTHER DEALINGS IN THE FONT SOFTWARE.\n"};
/* Additive original-language renderer. The retained renderer is used exactly while off. */
/* Living atlas canvas overlays. Every geographic anchor comes from the caller.
 * Ribbons are schematic connections, medallions are symbols, and context names
 * are captions: this renderer creates no borders, coastlines or habitat areas.
 * Coordinates and dimensions are CSS pixels in the caller's current transform.
 * `time` is requestAnimationFrame time in milliseconds. No animation is scheduled
 * here; a reduced-motion draw is independent of time.
 * Optional finishStrength0–1 refines the emblems and ink treatment only. The
 * Label metrics are independent of finish so material changes cannot relayout
 * the captions. Geographic anchors and symbolic interaction radii stay unchanged.
 */
(function(root,factory){
  'use strict';
  const previous=root.AncientWorldsWorldRenderer||(typeof require==='function'?require('./world_renderer.js'):null),enhanced=factory();
  const active=()=>!!root.originalLanguages25?.enabled&&root.worldController?.enabled!==false;
  const settleTimers=new WeakMap(),pendingSettles=new Set(),now=()=>root.performance?.now?.()??Date.now();
  function settle(c,delay){
    const old=settleTimers.get(c);if(!delay||!active()){if(old){root.clearTimeout(old.timer);settleTimers.delete(c);pendingSettles.delete(old)}return}
    if(typeof root.setTimeout!=='function'||typeof root.invalidate!=='function')return;
    const due=now()+delay;if(old&&old.due<=due+3)return;if(old){root.clearTimeout(old.timer);pendingSettles.delete(old)}
    const record={timer:null,due,context:c};record.timer=root.setTimeout(()=>{settleTimers.delete(c);pendingSettles.delete(record);if(active())root.invalidate()},delay);settleTimers.set(c,record);pendingSettles.add(record);
  }
  root.addEventListener?.('pagehide',()=>{for(const record of pendingSettles){root.clearTimeout(record.timer);settleTimers.delete(record.context)}pendingSettles.clear()});
  const api=Object.freeze({...enhanced,draw(c,o){if(!active()){settle(c,0);return previous.draw(c,o)}const result=enhanced.draw(c,{...o,names25:root.originalLanguages25});if(o?.pass==='foreground')settle(c,enhanced.layoutStats(c).settleDelayMs||0);return result},layoutStats(c){return active()?enhanced.layoutStats(c):previous.layoutStats(c)}});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AncientWorldsWorldRenderer=api;
})(typeof globalThis!=='undefined'?globalThis:typeof window!=='undefined'?window:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  const palette=Object.freeze({gold:'#ddbf83',ivory:'#eee4cd',teal:'#99c3c6',sage:'#aec59b',ink:'#14262a',shadow:'#081419'});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const labelOf=item=>String(item.label||item.name||'');
  function hashString(value){
    let h=2166136261;
    const s=String(value||'');
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0)/4294967296;
  }
  function classifyStatus(status){
    const s=String(status||'').toLowerCase();
    if(['dated','evidence','dated-evidence','active','matching'].includes(s))return 'dated';
    if(s==='window'||s.includes('uncertainty')||s.includes('dating-window'))return 'window';
    return 'reference';
  }
  function normalizeBox(box){
    if(!box)return null;
    const x=finite(box.x)?box.x:box.left,y=finite(box.y)?box.y:box.top;
    const w=finite(box.w)?box.w:finite(box.width)?box.width:box.right-x;
    const h=finite(box.h)?box.h:finite(box.height)?box.height:box.bottom-y;
    return [x,y,w,h].every(finite)&&w>=0&&h>=0?{x,y,w,h}:null;
  }
  const boxesIntersect=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;
  function projectPoint(project,point){
    if(!point||!finite(point.lon)||!finite(point.lat))return null;
    const p=project(point.lon,point.lat);
    const x=Array.isArray(p)?p[0]:p&&p.x,y=Array.isArray(p)?p[1]:p&&p.y;
    return finite(x)&&finite(y)?{x,y}:null;
  }
  const inView=(p,w,h,pad=0)=>p&&p.x>=-pad&&p.y>=-pad&&p.x<=w+pad&&p.y<=h+pad;
  function roundRect(c,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  }
  function line(c,points){
    c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));
  }
  // Rounded corners stay inside the supplied screen-space polyline's corner
  // triangles. No new geographic control points are inferred or persisted.
  function routeGeometry(points,project){
    const groups=[];let group=[];
    for(const raw of Array.isArray(points)?points:[]){
      const p=projectPoint(project,raw);
      if(!p){if(group.length>1)groups.push(group);group=[];continue}
      const last=group[group.length-1];
      if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.05)group.push(p);
    }
    if(group.length>1)groups.push(group);
    return groups.map(input=>{
      const output=[input[0]];
      for(let i=1;i<input.length-1;i++){
        const a=input[i-1],b=input[i],d=input[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bd=Math.hypot(d.x-b.x,d.y-b.y);
        const r=Math.min(12,ab*.16,bd*.16);
        const start={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab};
        const end={x:b.x+(d.x-b.x)*r/bd,y:b.y+(d.y-b.y)*r/bd};
        output.push(start);
        const steps=Math.max(2,Math.ceil(r/2));
        for(let k=1;k<=steps;k++){
          const t=k/steps,u=1-t;
          output.push({x:u*u*start.x+2*u*t*b.x+t*t*end.x,y:u*u*start.y+2*u*t*b.y+t*t*end.y});
        }
      }
      output.push(input[input.length-1]);
      let length=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      output.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-output[i-1].x,p.y-output[i-1].y);p.distance=length;minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)});
      return {points:output,length,bounds:{x:minX,y:minY,w:maxX-minX,h:maxY-minY}};
    }).filter(g=>g.length>.1);
  }
  function pointAtDistance(geometry,distance){
    const points=geometry&&geometry.points;
    if(!points||points.length<2)return null;
    const d=clamp(distance,0,geometry.length);let low=1,high=points.length-1;
    while(low<high){const middle=(low+high)>>1;if(points[middle].distance<d)low=middle+1;else high=middle}
    const a=points[low-1],b=points[low],length=b.distance-a.distance,t=length?(d-a.distance)/length:0;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  function clipSegment(a,b,width,height,pad=0){
    const dx=b.x-a.x,dy=b.y-a.y,p=[-dx,dx,-dy,dy],q=[a.x+pad,width+pad-a.x,a.y+pad,height+pad-a.y];
    let start=0,end=1;
    for(let i=0;i<4;i++){
      if(Math.abs(p[i])<1e-12){if(q[i]<0)return null;continue}
      const t=q[i]/p[i];
      if(p[i]<0)start=Math.max(start,t);else end=Math.min(end,t);
      if(start>end)return null;
    }
    return [{x:a.x+dx*start,y:a.y+dy*start},{x:a.x+dx*end,y:a.y+dy*end}];
  }
  function visibleSegments(g,width,height){
    const segments=[];
    for(let i=1;i<g.points.length;i++){const segment=clipSegment(g.points[i-1],g.points[i],width,height,2);if(segment)segments.push(segment)}
    return segments;
  }
  function connectionStyle(item){
    if(Array.isArray(item.interactionIds)&&item.interactionIds.length){
      const colors={trade:'#94b9bc',diplomacy:'#d0c098',alliance:'#a9bc95',conflict:'#c18e7c',administration:'#aaa5be'};
      return {interaction:true,water:false,color:colors[item.interactionType]||'#b4b7ad',dash:[3,6]};
    }
    const water=/sea|maritime|water|sail|river|coast|ship/i.test(String(item.mode||''));
    return {water,color:water?palette.teal:palette.gold,dash:water?[1,5.6]:[5.5,5.8]};
  }
  function makeHit(type,item,p,radius,rect){
    const hit={type,id:item.id,x:p.x,y:p.y,radius,label:labelOf(item)};
    if(rect){hit.rect=rect;if(rect.placementId)hit.placementId=rect.placementId;}
    return hit;
  }
  function routeHits(item,segments,hits){
    let count=0,last=null;
    for(const [a,b] of segments){
      const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(length/20));
      for(let i=0;i<=steps&&count<250;i++){
        const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
        if(last&&Math.hypot(p.x-last.x,p.y-last.y)<13)continue;
        hits.push(makeHit('connection',item,p,12));last=p;count++;
      }
    }
  }
  const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  function material(c,r,dated,finish){if(typeof c.createRadialGradient==='function'){const g=c.createRadialGradient(-r*.32,-r*.4,r*.08,0,0,r);if(g&&typeof g.addColorStop==='function'){const base=dated?'#dabb84':'#102228';g.addColorStop(0,mix(base,dated?'#f0dca6':'#345255',finish));g.addColorStop(.58,mix(base,dated?'#d4b77b':'#19373c',finish));g.addColorStop(1,mix(base,dated?'#927543':'#0c2028',finish));return g}}return mix(dated?'#dabb84':'#102228',dated?'#dbc18b':'#183238',finish)}
  function drawInteraction(c,item,g,style,width,height,hits,segments,finish){
    // A static source relation has neither traveling glints nor a moving dash.
    // The modest open chevron denotes an explicitly directed single record.
    c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([]);c.lineDashOffset=0;line(c,g.points);
    c.strokeStyle=palette.shadow;c.globalAlpha=.42;c.lineWidth=2.8-.4*finish;c.stroke();
    c.strokeStyle=style.color;c.globalAlpha=.17;c.lineWidth=1.15;c.stroke();
    c.setLineDash(style.dash);c.globalAlpha=.68;c.lineWidth=1.05-.15*finish;c.stroke();c.setLineDash([]);
    if(item.interactionIds.length===1&&item.direction==='one-way'&&g.length>70){
      const p=pointAtDistance(g,g.length*.66),r=4.2;
      if(inView(p,width,height,5)){c.beginPath();c.moveTo(p.x-Math.cos(p.angle-.55)*r,p.y-Math.sin(p.angle-.55)*r);c.lineTo(p.x,p.y);c.lineTo(p.x-Math.cos(p.angle+.55)*r,p.y-Math.sin(p.angle+.55)*r);c.globalAlpha=.7;c.lineWidth=.95;c.stroke()}
    }
    c.restore();routeHits(item,segments,hits);
  }
  function drawRegionalAnchors(c,item,project,width,height){
    const points=(item.points||[]).filter(p=>p.kind==='region').map(p=>projectPoint(project,p)).filter(p=>inView(p,width,height,4));
    if(!points.length)return;c.save();c.setLineDash([]);c.strokeStyle=connectionStyle(item).color;c.globalAlpha=.75;c.lineWidth=.9;
    // Hollow rings mark editorial regional references, never invented cities.
    for(const p of points){c.beginPath();c.arc(p.x,p.y,3.5,0,TAU);c.stroke()}c.restore();
  }
  function drawConnection(c,item,g,clock,reduced,width,height,hits,finish=0){
    if(!boxesIntersect(g.bounds,{x:0,y:0,w:width,h:height},8))return;
    const segments=visibleSegments(g,width,height);if(!segments.length)return;
    const style=connectionStyle(item),seed=hashString(item.id);
    if(style.interaction){drawInteraction(c,item,g,style,width,height,hits,segments,finish);return}
    c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
    line(c,g.points);
    if(finish){
      c.strokeStyle=palette.shadow;c.globalAlpha=.66;c.lineWidth=4.2+(2.6-4.2)*finish;c.stroke();
      c.strokeStyle=style.color;c.globalAlpha=.09+(.25-.09)*finish;c.lineWidth=6.6+(1.6-6.6)*finish;c.stroke();
      c.setLineDash(style.water?[.8,4.8]:[4.2,4.8]);c.lineDashOffset=reduced?0:-(clock*.003+seed*20);c.globalAlpha=.88;c.lineWidth=style.water?1.65+(1.05-1.65)*finish:1.35+(.9-1.35)*finish;c.stroke();c.setLineDash([]);
      c.strokeStyle=palette.ivory;c.globalAlpha=.24*finish;c.lineWidth=.35;c.stroke();
    }else{
      c.strokeStyle=palette.shadow;c.globalAlpha=.68;c.lineWidth=4.2;c.stroke();
      c.strokeStyle=style.color;c.globalAlpha=.09;c.lineWidth=6.6;c.stroke();
      c.globalAlpha=.18;c.lineWidth=.65;c.stroke();
      c.setLineDash(style.dash);c.lineDashOffset=reduced?0:-(clock*.003+seed*20);
      c.globalAlpha=.87;c.lineWidth=style.water?1.65:1.35;c.stroke();c.setLineDash([]);
    }
    // Opposing slow glints convey activity without asserting a trade direction.
    // Their phase is deterministic, so paused/reduced-motion frames stay fixed.
    const phase=(clock*.008+seed*g.length)%g.length;
    for(let i=0;i<(g.length>190?2:1);i++){
      const d=i?g.length-phase:phase,p=pointAtDistance(g,d);
      if(!inView(p,width,height,10))continue;
      const tail=pointAtDistance(g,clamp(d+(i?9:-9),0,g.length));
      c.beginPath();c.moveTo(tail.x,tail.y);c.lineTo(p.x,p.y);c.strokeStyle=style.color;c.globalAlpha=.38;c.lineWidth=1.9+(1.15-1.9)*finish;c.stroke();
      c.beginPath();c.arc(p.x,p.y,1.35+(.85-1.35)*finish,0,TAU);c.fillStyle=palette.ivory;c.globalAlpha=.72;c.fill();
      if(style.water){c.globalAlpha=.23;c.lineWidth=.7;c.beginPath();c.arc(p.x,p.y,3.6,p.angle+.8,p.angle+2.4);c.strokeStyle=style.color;c.stroke()}
    }
    c.restore();routeHits(item,segments,hits);
  }
  function drawCityGlyph(c,kind,r,ink){
    c.strokeStyle=ink;c.fillStyle=ink;c.lineWidth=.85;c.lineJoin='round';c.lineCap='round';
    const s=r/9;c.save();c.scale(s,s);
    if(/port|harbo[u]?r|coast|maritime/i.test(String(kind||''))){
      // A vessel emblem denotes a port-related evidence note, not a vessel count
      // or a reconstructed ancient harbour plan.
      c.beginPath();c.moveTo(-5.5,1.7);c.lineTo(-3.8,4.2);c.quadraticCurveTo(.2,5.5,4.1,3.5);c.lineTo(5.5,1.7);c.closePath();c.fill();
      c.beginPath();c.moveTo(-.6,1.6);c.lineTo(-.6,-5.5);c.stroke();
      c.beginPath();c.moveTo(.4,-4.9);c.quadraticCurveTo(2.8,-3.2,4.2,.4);c.lineTo(.4,.4);c.closePath();c.fill();
      c.globalAlpha=.65;c.beginPath();c.moveTo(-5.2,6.1);c.quadraticCurveTo(-2.5,5.1,0,6.1);c.quadraticCurveTo(2.4,7,5.2,6);c.stroke();
    }else if(/royal|capital|court/i.test(String(kind||''))){
      // Stepped civic architecture and a diamond are symbolic royal-context
      // marks. No architectural plan or precise capital extent is implied.
      c.fillRect(-5.7,1.2,11.4,3.6);c.fillRect(-3.9,-1.1,7.8,2.6);c.fillRect(-2.1,-3.3,4.2,2.7);
      c.beginPath();c.moveTo(0,-7);c.lineTo(1.4,-5.3);c.lineTo(0,-3.9);c.lineTo(-1.4,-5.3);c.closePath();c.fill();
      c.fillStyle=palette.ink;c.fillRect(-.75,2.1,1.5,2.7);
      c.strokeStyle=ink;c.beginPath();c.moveTo(-6.1,5.8);c.lineTo(6.1,5.8);c.stroke();
    }else{
      // A clustered civic emblem, rather than a recovered skyline or footprint.
      c.fillRect(-5.8,-.8,3.2,5.5);c.fillRect(-1.9,-4,3.8,8.7);c.fillRect(2.6,-2,3.2,6.7);
      c.beginPath();c.moveTo(-6.2,-1.4);c.lineTo(-2.2,-1.4);c.moveTo(-2.3,-4.6);c.lineTo(2.3,-4.6);c.moveTo(2.2,-2.6);c.lineTo(6.2,-2.6);c.stroke();
      c.fillStyle=palette.ink;c.fillRect(-.75,2,1.5,2.7);c.fillRect(-4.9,.6,1,1.1);c.fillRect(3.6,-.5,1,1.1);
      c.strokeStyle=ink;c.beginPath();c.moveTo(-6.3,5.6);c.lineTo(6.3,5.6);c.stroke();
    }
    c.restore();
  }
  function drawEngravedCity(c,item,r,status,finish){
    const dated=status==='dated',rim=dated?'#ddc18a':'#9bbec0',ink=dated?'#243638':'#d8dfd1';
    c.beginPath();c.ellipse(.6,r*.7,r*.91,r*.31,0,0,TAU);c.fillStyle='rgba(3,12,15,.32)';c.fill();
    c.beginPath();c.arc(0,0,r+.8,0,TAU);c.fillStyle='#102328';c.fill();c.lineWidth=.75;c.strokeStyle=dated?'rgba(242,220,168,.7)':'rgba(164,200,200,.4)';c.stroke();
    c.beginPath();c.arc(0,0,r-.1,0,TAU);c.fillStyle=material(c,r,dated,finish);c.fill();c.strokeStyle=rim;c.lineWidth=1.1;
    if(!dated)c.setLineDash(status==='window'?[1.3,2.8]:[3.3,2.3]);c.stroke();c.setLineDash([]);
    c.beginPath();c.arc(0,-.2,r-1.25,Math.PI+.16,TAU-.15);c.strokeStyle=dated?'rgba(255,245,209,.88)':'rgba(208,231,225,.65)';c.lineWidth=.6;c.stroke();
    c.beginPath();c.arc(.1,.15,r-1.05,.12,Math.PI-.1);c.strokeStyle=dated?'rgba(76,56,31,.75)':'rgba(2,13,19,.72)';c.lineWidth=.85;c.stroke();
    c.beginPath();c.arc(0,0,r-2.15,0,TAU);c.strokeStyle=dated?'rgba(82,64,40,.3)':'rgba(168,204,198,.2)';c.lineWidth=.45;c.stroke();
    if(r>=9.3){c.beginPath();for(let i=0;i<12;i++){const angle=i*TAU/12,x=Math.cos(angle)*(r-1.55),y=Math.sin(angle)*(r-1.55);c.moveTo(x+.24,y);c.arc(x,y,.24,0,TAU)}c.fillStyle=dated?'rgba(255,239,193,.72)':'rgba(189,221,214,.48)';c.globalAlpha=finish;c.fill();c.globalAlpha=1}
    c.save();c.shadowColor=dated?'rgba(255,239,196,.6)':'rgba(0,9,14,.8)';c.shadowOffsetX=.25;c.shadowOffsetY=.55;c.shadowBlur=0;drawCityGlyph(c,item.kind,r*.9,ink);c.restore();
    // These cuts ornament the existing symbolic emblem. They add no mapped
    // buildings, harbour geometry, feature counts or archaeological footprint.
    if(r>=9.3){c.save();c.scale(r*.9/9,r*.9/9);c.strokeStyle=dated?'rgba(240,215,164,.65)':'rgba(12,35,40,.75)';c.lineWidth=.5;c.globalAlpha=finish;c.beginPath();
      if(/port|harbo[u]?r|coast|maritime/i.test(String(item.kind||''))){c.moveTo(.7,-3.9);c.lineTo(3.3,-.3);c.moveTo(-4,2.7);c.lineTo(3.7,2.7);c.moveTo(-2.8,3.1);c.lineTo(-2.5,4);c.moveTo(.2,3.2);c.lineTo(.2,4.3);c.moveTo(2.5,3);c.lineTo(2.3,3.8)}
      else if(/royal|capital|court/i.test(String(item.kind||''))){c.moveTo(-4.9,2);c.lineTo(4.9,2);c.moveTo(-3.2,-.3);c.lineTo(3.2,-.3);c.moveTo(-1.5,-2.5);c.lineTo(1.5,-2.5)}
      else {c.moveTo(-5,.2);c.lineTo(-3.3,.2);c.moveTo(-1.2,-2.9);c.lineTo(1.2,-2.9);c.moveTo(3.3,-.9);c.lineTo(5,-.9);c.moveTo(-5.1,3.6);c.lineTo(-3.1,3.6);c.moveTo(3.2,3.6);c.lineTo(5.1,3.6)}
      c.stroke();c.restore()}
  }
  function drawCity(c,entry,finish=0){
    const {item,p,r,compact}=entry,status=classifyStatus(item.status);
    c.save();c.translate(p.x,p.y);c.setLineDash([]);c.lineWidth=1;
    if(compact){
      c.beginPath();c.arc(0,0,3,0,TAU);c.fillStyle=palette.ink;c.fill();c.strokeStyle=status==='dated'?palette.gold:palette.teal;c.stroke();
      if(status==='dated'){c.beginPath();c.arc(0,0,1.25,0,TAU);c.fillStyle=palette.gold;c.fill()}
      c.restore();return;
    }
    if(finish){drawEngravedCity(c,item,r,status,finish);c.restore();return}
    c.beginPath();c.ellipse(1,r*.68,r*.95,r*.37,0,0,TAU);c.fillStyle='rgba(4,13,17,.23)';c.fill();
    c.beginPath();c.arc(0,0,r+2.5,0,TAU);c.strokeStyle=status==='dated'?'rgba(233,207,155,.25)':'rgba(142,175,177,.17)';c.lineWidth=.7;c.stroke();
    c.beginPath();c.arc(0,0,r,0,TAU);
    c.fillStyle=status==='dated'?'rgba(218,189,132,.96)':'rgba(16,34,40,.91)';c.fill();
    c.strokeStyle=status==='dated'?'#f5e1af':palette.teal;c.lineWidth=status==='dated'?.9:1;
    if(status!=='dated')c.setLineDash(status==='window'?[1.3,2.8]:[3.3,2.3]);c.stroke();c.setLineDash([]);
    drawCityGlyph(c,item.kind,r,status==='dated'?'#203034':'#c1d1c8');
    c.restore();
  }
  function ecologyKind(kind){
    const s=String(kind||'');
    if(/wet|reed|marsh|water|hydro|lake|river/i.test(s))return 'water';
    if(/field|crop|farm|agric|grain|land-use/i.test(s))return 'field';
    if(/animal|fauna|herd/i.test(s))return 'fauna';
    return 'leaf';
  }
  function drawEcology(c,entry){
    const {item,p,r}=entry,status=classifyStatus(item.status),kind=ecologyKind(item.kind);
    c.save();c.translate(p.x,p.y);c.lineCap='round';c.lineJoin='round';c.lineWidth=.9;
    c.beginPath();c.arc(0,0,r,0,TAU);c.fillStyle='rgba(17,36,34,.88)';c.fill();
    c.strokeStyle=status==='dated'?'#cfce9c':palette.sage;c.setLineDash(status==='dated'?[]:[1.25,2.6]);c.stroke();c.setLineDash([]);
    c.strokeStyle='#bfcca7';c.fillStyle='#b8c69f';
    if(kind==='water'){
      c.strokeStyle='#add1cf';c.fillStyle='rgba(153,195,198,.2)';
      c.beginPath();c.moveTo(0,-5.4);c.bezierCurveTo(-1.2,-3.3,-4.3,-.1,-3.9,2);c.bezierCurveTo(-3.6,5.4,3.8,5.4,3.9,2);c.bezierCurveTo(4.1,-.1,1.2,-3.3,0,-5.4);c.closePath();c.fill();c.stroke();
      c.globalAlpha=.72;c.beginPath();c.moveTo(-5.4,6.1);c.quadraticCurveTo(-2.6,5.1,0,6);c.quadraticCurveTo(2.6,6.9,5.4,6);c.stroke();
    }else if(kind==='field'){
      c.beginPath();c.moveTo(0,5);c.lineTo(0,-5);c.stroke();
      for(let i=0;i<3;i++){const y=-3+i*2;c.beginPath();c.moveTo(0,y+1);c.quadraticCurveTo(-4,y,-2.5,y-1.5);c.moveTo(0,y+1);c.quadraticCurveTo(4,y,2.5,y-1.5);c.stroke()}
    }else if(kind==='fauna'){
      c.beginPath();c.ellipse(0,0,3.8,2,0,0,TAU);c.fill();c.beginPath();c.arc(3.6,-2,1.5,0,TAU);c.fill();
      c.beginPath();c.moveTo(-2,1);c.lineTo(-2.5,4);c.moveTo(2,1);c.lineTo(2.5,4);c.stroke();
    }else{
      c.beginPath();c.moveTo(-3.6,3.6);c.quadraticCurveTo(-5,-3,4.3,-5);c.quadraticCurveTo(5,3.7,-3.6,3.6);c.stroke();
      c.beginPath();c.moveTo(-4.6,5);c.lineTo(2,-2.8);c.moveTo(-.9,.9);c.lineTo(1.9,1.1);c.moveTo(-1,1);c.lineTo(-2,-1.8);c.moveTo(.5,-.8);c.lineTo(2.6,-.6);c.stroke();
    }
    // The small static cue classifies the note; it does not show an amount,
    // geographic coverage or animated environmental change.
    const trend=String(item.trend||'');
    if(trend==='dry'){
      c.strokeStyle='#d9c19a';c.globalAlpha=.88;c.lineWidth=1.1;c.beginPath();c.moveTo(-3.5,4.4);c.lineTo(3.6,-3.5);c.stroke();
    }else if(trend==='pollen-increase'||trend==='pollen-decrease'){
      c.strokeStyle='#d8dfbf';c.lineWidth=.9;c.globalAlpha=.92;c.beginPath();c.moveTo(r-1,-r+2);c.lineTo(r+3,-r+2);if(trend==='pollen-increase'){c.moveTo(r+1,-r);c.lineTo(r+1,-r+4)}c.stroke();
    }else if(trend==='channel-change'){
      c.strokeStyle='#add1cf';c.lineWidth=.9;c.beginPath();c.moveTo(-r-1,2);c.quadraticCurveTo(-r-4,-1,-r-1,-3);c.stroke();
    }
    c.restore();
  }
  function fitText(c,text,maxWidth){
    let value=String(text||'');
    if(c.measureText(value).width<=maxWidth)return value;
    while(value.length>3&&c.measureText(value+'…').width>maxWidth)value=value.slice(0,-1);
    return value+'…';
  }
  function available(rect,occupied,width,height,pad=3){
    return rect.x>=7&&rect.y>=8&&rect.x+rect.w<=width-7&&rect.y+rect.h<=height-8&&!occupied.some(b=>boxesIntersect(rect,b,pad));
  }
  // A remembered candidate is recalculated at the current projected anchor;
  // no screen position, geographic coordinate or interaction radius is frozen.
  // Retain with zero collision padding; enter a new slot with extra clearance.
  // A brief conflict hides text before moving it, rather than oscillating sides.
  function createLabelLayout(options={}){
    const maximum=options.maxEntries===undefined?512:options.maxEntries;
    if(!Number.isInteger(maximum)||maximum<1||maximum>512)throw new RangeError('Label cache must hold between 1 and 512 entries.');
    const now=typeof options.now==='function'?options.now:()=>globalThis.performance?.now?.()??Date.now(),dwellMs=450;
    const entries=new Map();let frame=0,changes=0,epoch,semanticChange=false,nextSettle=Infinity;
    function entry(key){key=String(key);let e=entries.get(key);if(e)entries.delete(key);else e={id:key,placementId:null,blocked:0,lastSwitch:-1000,lastSwitchAt:-Infinity};e.seen=frame;entries.set(key,e);while(entries.size>maximum)entries.delete(entries.keys().next().value);return e}
    function choose(key,candidates,occupied,width,height,pad=3,anchor=null,subtitleBucket=null){
      const e=entry(key),clock=now(),allCandidates=candidates;
      // A title-only bilingual block must not repeatedly grow a subtitle and
      // collide again as zoom oscillates. Reset this choice only for a changed
      // semantic date/layer/setting or an actual hysteretic title-font bucket.
      if(subtitleBucket!==null){const token=String(epoch)+'|'+subtitleBucket;if(e.subtitleToken!==token){e.subtitleToken=token;e.subtitleMode=null}if(e.subtitleMode!==null)candidates=candidates.filter(c=>!!c.showSub===e.subtitleMode)}
      const previous=candidates.find(c=>c.placementId===e.placementId),others=occupied.filter(b=>b.labelOwner!==String(key));let chosen=null;
      const enters=(candidate,padding)=>available(candidate,occupied,width,height,0)&&available(candidate,others,width,height,padding);
      if(previous&&available(previous,occupied,width,height,0)){chosen=previous;e.blocked=0}
      else if(e.placementId!==null){
        e.blocked++;
        const clipped=previous?Math.max(7-previous.x,8-previous.y,previous.x+previous.w-width+7,previous.y+previous.h-height+8,0):0;
        const moved=anchor&&e.anchor?Math.hypot(anchor.x-e.anchor.x,anchor.y-e.anchor.y):0;
        let alternative=candidates.find(c=>enters(c,pad+5))||null;
        // A full block may downgrade once when only its optional subtitle is
        // obstructed. It cannot regrow that subtitle within the same bucket.
        if(!alternative&&subtitleBucket!==null&&e.subtitleMode===true)alternative=allCandidates.find(c=>!c.showSub&&enters(c,pad+5))||null;
        if(alternative){
          if(semanticChange||(clock-e.lastSwitchAt>=dwellMs&&(clipped>16||moved>48||e.blocked>=3)))chosen=alternative;
          else nextSettle=Math.min(nextSettle,Math.max(e.lastSwitchAt+dwellMs,clock+40));
        }
      }else chosen=candidates.find(c=>available(c,occupied,width,height,pad))||null;
      if(anchor)e.anchor={x:anchor.x,y:anchor.y};
      if(chosen){if(e.placementId!==chosen.placementId){if(e.placementId!==null)changes++;e.lastSwitch=frame;e.lastSwitchAt=clock}e.placementId=chosen.placementId;e.blocked=0;e.drawn=frame;e.rect={x:chosen.x,y:chosen.y,w:chosen.w,h:chosen.h};if(subtitleBucket!==null)e.subtitleMode=!!chosen.showSub}
      return chosen;
    }
    function font(key,span,kind){
      const e=entry(key);let value=e.font;
      if(kind==='context'){
        if(value===undefined)value=span>90?14:span<30?16:15;
        else if(span>92)value=14;else if(span<28)value=16;else if(value===14&&span<88||value===16&&span>32)value=15;
      }else {if(value===undefined)value=span>90?11:12;else if(span>92)value=11;else if(span<88)value=12}
      return e.font=value;
    }
    function compact(key,distance,threshold){const e=entry(key);if(e.compact===undefined)e.compact=distance<threshold;else if(e.compact&&distance>threshold+3)e.compact=false;else if(!e.compact&&distance<threshold-2)e.compact=true;return e.compact}
    return Object.freeze({beginFrame(token){frame++;semanticChange=epoch!==undefined&&token!==epoch;epoch=token;nextSettle=Infinity},choose,font,compact,stats(){return {size:entries.size,maxEntries:maximum,frame,placementChanges:changes,settleDelayMs:Number.isFinite(nextSettle)?Math.max(1,Math.ceil(nextSettle-now())):0,placements:[...entries.values()].filter(e=>e.placementId!==null&&e.seen===frame).map(e=>({id:e.id,placementId:e.placementId,visible:e.drawn===frame,rect:e.drawn===frame?{...e.rect}:null}))}}});
  }
  const labelLayouts=new WeakMap();
  function layoutFor(context){let layout=labelLayouts.get(context);if(!layout){layout=createLabelLayout();labelLayouts.set(context,layout)}return layout}
  function layoutStats(context){return labelLayouts.get(context)?.stats()||{size:0,maxEntries:512,frame:0,placementChanges:0,placements:[]}}
  // A complete attested string is measured in its loaded font. Never truncate
  // UTF-16: cuneiform and Egyptian signs live beyond the BMP.
  function nativeMetrics(c,row,names,maxWidth){
    if(!row||!names)return null;
    const text=String(row.text||'');if(!text)return null;
    c.save();let result=null;
    try{for(const size of [15,14,13,12,11]){const font=names.font(row,size);if(!font)break;c.font=font;const m=c.measureText(text);if(m.width<=maxWidth){result={text,font,width:m.width,height:Math.max(20,Math.ceil((m.actualBoundingBoxAscent||size)+(m.actualBoundingBoxDescent||3))+4),direction:row.direction==='rtl'?'rtl':'ltr'};break}}}finally{c.restore()}
    return result||{tooWide:true};
  }
  function nativeRow(o,type,id,year){return o.names25?.lookup(type,id,year)||null}
  function paintNative(c,native,left,right,y,color){
    if(!native||native.tooWide)return;c.save();c.font=native.font;c.direction=native.direction;c.textAlign=native.direction==='rtl'?'right':'left';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=2.3;c.strokeStyle='rgba(6,18,22,.86)';c.fillStyle=color||'#e8dcbf';const x=native.direction==='rtl'?right:left;c.strokeText(native.text,x,y);c.fillText(native.text,x,y);c.restore();
  }
  function placeLabel(c,text,p,r,settings,occupied,width,height){
    c.font=settings.font;const maxWidth=settings.maxWidth||180;
    // A stable two-line city name preserves words at close view. Geometry is
    // measured in CSS pixels and uses the same remembered four placement IDs.
    const lines=settings.maxLines>1?wrapWords(c,text,maxWidth,settings.maxLines):[];
    if(!lines.length){const fitted=fitText(c,text,maxWidth);if(!fitted)return null;lines.push(fitted)}
    const lineHeight=settings.lineHeight||14;
    const native=nativeMetrics(c,settings.nativeRow,settings.names25,maxWidth);if(native?.tooWide)return null;const englishHeight=lines.length>1?Math.max(settings.height||20,lines.length*lineHeight+6):(settings.height||20);const w=Math.ceil(Math.max(...lines.map(t=>c.measureText(t).width),native?.width||0))+12,h=englishHeight+(native?native.height+2:0),gap=r+5;
    const candidates=[{x:p.x+gap,y:p.y-h/2,w,h,placementId:'right'},{x:p.x-gap-w,y:p.y-h/2,w,h,placementId:'left'},{x:p.x-w/2,y:p.y-gap-h,w,h,placementId:'above'},{x:p.x-w/2,y:p.y+gap,w,h,placementId:'below'}];
    const rect=settings.layout.choose(settings.key,candidates,occupied,width,height,settings.pad||3,p);
    if(!rect)return null;occupied.push(rect);
    c.save();c.font=settings.font;c.textAlign='left';c.textBaseline='middle';
    if(settings.finish){if(settings.finish<1){roundRect(c,rect.x,rect.y,rect.w,rect.h,3);c.fillStyle='rgba(10,25,30,'+(.78*(1-settings.finish))+')';c.fill()}c.lineJoin='round';c.lineWidth=2.4;c.strokeStyle='rgba(6,18,22,'+(.84*settings.finish)+')';for(let i=0;i<lines.length;i++)c.strokeText(lines[i],rect.x+6,rect.y+englishHeight/2+(i-(lines.length-1)/2)*lineHeight+.2)}
    else {roundRect(c,rect.x,rect.y,rect.w,rect.h,3);c.fillStyle='rgba(10,25,30,.78)';c.fill()}
    c.fillStyle=settings.color||palette.ivory;for(let i=0;i<lines.length;i++)c.fillText(lines[i],rect.x+6,rect.y+englishHeight/2+(i-(lines.length-1)/2)*lineHeight+.2);if(native)paintNative(c,native,rect.x+6,rect.x+rect.w-6,rect.y+englishHeight+native.height/2,settings.color);c.restore();
    return rect;
  }
  function sorted(items){
    return (Array.isArray(items)?items:[]).filter(item=>item&&item.id!==undefined).slice().sort((a,b)=>Number(classifyStatus(b.status)==='dated')-Number(classifyStatus(a.status)==='dated')||String(a.id).localeCompare(String(b.id)));
  }
  function pointEntries(items,project,width,height,radius){
    return sorted(items).map(item=>({item,p:projectPoint(project,item),r:radius})).filter(e=>inView(e.p,width,height,0));
  }
  function existingLabelNear(p,boxes,r){
    // The original locator layer already names most cities. Keep that name rather
    // than adding a duplicate caption on another side of the same medallion.
    return boxes.some(b=>b.y<=p.y+5&&b.y+b.h>=p.y-5&&b.x<=p.x+r+13&&b.x+b.w>=p.x-r-4);
  }
  function contextOrder(items){
    const rank=kind=>/political/i.test(kind)?0:/mixed/i.test(kind)?1:/archaeo/i.test(kind)?2:3;
    // Higher explicit priority wins scarce caption space. It changes layout
    // preference only; historical status and supplied anchors remain untouched.
    const priority=item=>finite(item.priority)?item.priority:0;
    return sorted(items).sort((a,b)=>priority(b)-priority(a)||rank(a.kind||'')-rank(b.kind||'')||hashString(a.id)-hashString(b.id));
  }
  function wrapWords(c,text,maxWidth,maxLines=2){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),lines=[];
    let current='';
    for(const word of words){
      const candidate=current?current+' '+word:word;
      if(c.measureText(candidate).width<=maxWidth){current=candidate;continue}
      if(current)lines.push(current);
      if(c.measureText(word).width>maxWidth||lines.length>=maxLines)return [];
      current=word;
    }
    if(current)lines.push(current);
    return lines.length<=maxLines?lines:[];
  }
  function drawContext(c,item,p,occupied,width,height,span,finish=0,layout,o){
    const key='context/'+item.id,fontSize=layout.font(key,span,'context');
    const font='italic '+fontSize+'px Georgia, serif';c.font=font;
    const maxWidth=Math.min(230,Math.max(145,width*.35));
    let titles=wrapWords(c,labelOf(item),maxWidth,2);
    // Keeping a caption unplaced is preferable to displaying a chopped name.
    // Full names remain available in the accessible world journal.
    if(!titles.length)return null;
    const titleWidth=Math.max(...titles.map(t=>c.measureText(t).width));
    const sub=item.subLabel?String(item.subLabel):'';
    c.font='10.5px system-ui, sans-serif';const subtitle=fitText(c,sub,Math.min(210,maxWidth));
    const native=nativeMetrics(c,nativeRow(o,'period',item.periods?.[0]?.refId,o.model?.year),o.names25,maxWidth);if(native?.tooWide)return null;const nativeHeight=native?native.height+2:0;const w=Math.ceil(Math.max(titleWidth,c.measureText(subtitle).width,native?.width||0))+20;
    const lineHeight=Math.ceil(fontSize+1),titleHeight=titles.length*lineHeight;
    // Alternate placements are screen layout only, without historical extent.
    const offsets=[[0,-13],[0,-37],[0,12],[-22,-13],[22,-13],[-36,-37],[36,-37],[-36,12],[36,12],[0,-60],[0,36],[-55,-13],[55,-13]];
    const alternatives=offsets.map(([dx,dy])=>({x:p.x-w/2+dx,y:p.y+dy}));
    const candidates=[];
    for(const full of subtitle?[true,false]:[false]){const h=titleHeight+nativeHeight+9+(full?15:0);alternatives.forEach((a,i)=>candidates.push({...a,w,h,showSub:full,placementId:'offset-'+i+(full?'-full':'-title')}))}
    const rect=layout.choose(key,candidates,occupied,width,height,7,p,fontSize),showSub=!!rect?.showSub;
    if(!rect)return null;occupied.push(rect);
    const x=rect.x+rect.w/2,y=rect.y+6+lineHeight/2;
    c.save();
    if(finish<1){roundRect(c,rect.x+3,rect.y+1,rect.w-6,rect.h-2,4);c.fillStyle=finish?'rgba(10,24,29,'+(.39*(1-finish))+')':'rgba(10,24,29,.39)';c.fill()}
    c.textAlign='center';c.textBaseline='middle';c.font=font;c.lineJoin='round';c.lineWidth=2.4;c.strokeStyle='rgba(9,20,24,.84)';
    c.fillStyle=/research|gap/i.test(item.kind||'')?'#a3aaa0':finish?'#f0dfb9':'#e7d4aa';
    for(let i=0;i<titles.length;i++){c.strokeText(titles[i],x,y+i*lineHeight);c.fillText(titles[i],x,y+i*lineHeight)}
    if(native){c.save();c.translate(x,0);paintNative(c,native,-native.width/2,native.width/2,rect.y+titleHeight+native.height/2+5,'#e5d3ae');c.restore()}
    if(showSub){const sy=rect.y+titleHeight+nativeHeight+11;c.font='10.5px system-ui, sans-serif';c.lineWidth=2;c.strokeStyle='rgba(9,20,24,.82)';c.strokeText(subtitle,x,sy);c.fillStyle='#c3cec3';c.fillText(subtitle,x,sy)}
    c.restore();return rect;
  }
  function drawRouteLabel(c,item,geometries,occupied,width,height,finish=0,layout){
    let best=null,bestLength=0;
    for(const g of geometries)for(const [a,b] of visibleSegments(g,width,height)){
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      if(length>bestLength){bestLength=length;best={x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
    }
    if(!best||bestLength<130)return null;
    if(Array.isArray(item.interactionIds)&&item.interactionIds.length){
      c.font='11px Georgia, serif';if(!wrapWords(c,labelOf(item),190,2).length)return null;
      const rect=placeLabel(c,labelOf(item),best,5,{font:'11px Georgia, serif',maxWidth:190,maxLines:2,lineHeight:13,height:19,color:connectionStyle(item).color,pad:6,finish,layout,key:'connection/'+item.id},occupied,width,height);
      return rect?makeHit('connection',item,best,8,rect):null;
    }
    const rect=placeLabel(c,labelOf(item),best,5,{font:'italic 10px Georgia, serif',maxWidth:165,height:18,color:connectionStyle(item).color,pad:6,finish,layout,key:'connection/'+item.id},occupied,width,height);
    return rect?makeHit('connection',item,best,8,rect):null;
  }
  function draw(ctx,options){
    const o=options||{},width=o.width,height=o.height,project=o.project;
    if(!ctx||!finite(width)||!finite(height)||width<=0||height<=0||typeof project!=='function')return [];
    if(o.pass!=='underlay'&&o.pass!=='foreground')return [];
    const model=o.model||{},layers=o.layers||{},hits=[],span=finite(o.span)?o.span:52,finish=finite(o.finishStrength)?clamp(o.finishStrength,0,1):0;
    const clock=o.reducedMotion?0:finite(o.time)?Math.max(0,o.time):0;
    const routes=layers.connections===false?[]:sorted(model.connections).map(item=>{const routeProject=typeof o.projectRoute==='function'?o.projectRoute(item.points):project;return {item,project:routeProject,geometries:routeGeometry(item.points,routeProject)}});
    ctx.save();
    try{
      ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();ctx.globalAlpha=1;ctx.setLineDash([]);ctx.lineDashOffset=0;ctx.shadowBlur=0;ctx.shadowOffsetX=ctx.shadowOffsetY=0;
      if(o.pass==='underlay'){
        for(const route of routes){for(const geometry of route.geometries)drawConnection(ctx,route.item,geometry,clock,!!o.reducedMotion,width,height,hits,finish);if(route.geometries.length&&Array.isArray(route.item.interactionIds)&&route.item.interactionIds.length)drawRegionalAnchors(ctx,route.item,route.project,width,height)}
        return hits;
      }
      const layout=layoutFor(ctx),showLabels=o.showLabels!==false;layout.beginFrame([model.year??'',showLabels,layers.cities!==false,layers.connections!==false,layers.kingdoms!==false,layers.ecology!==false,o.names25?.revision??''].join('|'));
      const originals=(Array.isArray(o.existingLabelBoxes)?o.existingLabelBoxes:[]).map(normalizeBox).filter(Boolean),occupied=originals.slice();
      const radius=clamp(11.7-span*.028,7.5,12.3);
      const allCities=layers.cities===false?[]:pointEntries(model.cities,project,width,height,radius),cities=allCities.filter(e=>!e.item.supplemental),supplementalCities=allCities.filter(e=>e.item.supplemental);
      const ecology=layers.ecology===false?[]:pointEntries(model.ecology,project,width,height,7.8);
      const previous=[];
      for(const e of cities){
        const nearest=previous.length?Math.min(...previous.map(p=>Math.hypot(p.x-e.p.x,p.y-e.p.y))):Infinity;e.compact=layout.compact('city/'+e.item.id,nearest,radius*2+3);if(!e.compact)previous.push(e.p);
        if(e.compact)e.r=3;
        occupied.push({x:e.p.x-e.r-2,y:e.p.y-e.r-2,w:e.r*2+4,h:e.r*2+4,labelOwner:'city/'+e.item.id});drawCity(ctx,e,finish);
      }
      // Symbols are reserved before placing any captions, including ecological
      // notes. Collision decisions never mutate the caller's original rectangles.
      for(const e of ecology){occupied.push({x:e.p.x-e.r-2,y:e.p.y-e.r-2,w:e.r*2+4,h:e.r*2+4,labelOwner:'ecology/'+e.item.id});drawEcology(ctx,e)}
      let cityLabels=0;
      const maxCityLabels=finite(o.maxCityLabels)?Math.max(0,Math.floor(o.maxCityLabels)):Math.max(3,Math.floor(width/(span>85?140:span>45?100:72)));
      for(const e of cities){
        let rect=null;
        if(showLabels&&!e.compact&&cityLabels<maxCityLabels&&!existingLabelNear(e.p,originals,e.r)){
          rect=placeLabel(ctx,labelOf(e.item),e.p,e.r,{font:'500 '+layout.font('city/'+e.item.id,span,'city')+'px Georgia, serif',maxWidth:Math.min(210,Math.max(155,width*.27)),maxLines:2,lineHeight:14,height:20,color:classifyStatus(e.item.status)==='dated'?'#e8d7af':'#ccd6cb',finish,layout,key:'city/'+e.item.id,nativeRow:nativeRow(o,'place',e.item.placeId||e.item.id,model.year),names25:o.names25},occupied,width,height);
          if(rect)cityLabels++;
        }
        hits.push(makeHit('city',e.item,e.p,Math.max(7,e.r+2),rect));
      }
      if(showLabels&&layers.kingdoms!==false){
        const maximum=finite(o.maxContextLabels)?Math.max(0,Math.floor(o.maxContextLabels)):Math.min(5,Math.max(1,Math.floor(width/145)));
        let count=0;
        for(const item of contextOrder(model.contexts)){
          if(count>=maximum)break;const p=projectPoint(project,item);if(!inView(p,width,height,0))continue;
          const rect=drawContext(ctx,item,p,occupied,width,height,span,finish,layout,o);
          if(rect){hits.push(makeHit('context',item,p,6,rect));count++}
        }
      }
      let ecologyLabels=0;
      const maxEcologyLabels=finite(o.maxEcologyLabels)?Math.max(0,Math.floor(o.maxEcologyLabels)):Math.max(1,Math.floor(width/(span>80?260:190)));
      for(const e of ecology){
        let rect=null;
        if(showLabels&&ecologyLabels<maxEcologyLabels){
          rect=placeLabel(ctx,labelOf(e.item),e.p,e.r,{font:'10px Georgia, serif',maxWidth:150,height:18,color:'#c0cbae',pad:5,layout,key:'ecology/'+e.item.id},occupied,width,height);
          if(rect)ecologyLabels++;
        }
        hits.push(makeHit('ecology',e.item,e.p,e.r+3,rect));
      }
      if(showLabels&&span<85){
        let count=0;
        const labelRoutes=[...routes.filter(r=>!r.item.interactionIds?.length),...routes.filter(r=>r.item.interactionIds?.length)];
        for(const route of labelRoutes){
          if(count>=Math.max(1,Math.floor(width/330)))break;
          const hit=drawRouteLabel(ctx,route.item,route.geometries,occupied,width,height,finish,layout);if(hit){hits.push(hit);count++}
        }
      }
      // Additional site evidence cannot displace the retained cities or regional
      // captions. Its base geographic locator already exists below this pass.
      // Omit a duplicate foreground emblem when it would cover existing ink;
      // also omit its point hit so an earlier caption keeps its click target.
      for(const e of supplementalCities){
        const nearest=previous.length?Math.min(...previous.map(p=>Math.hypot(p.x-e.p.x,p.y-e.p.y))):Infinity;e.compact=layout.compact('city/'+e.item.id,nearest,radius*2+3);if(e.compact)e.r=3;
        const glyph={x:e.p.x-e.r-2,y:e.p.y-e.r-2,w:e.r*2+4,h:e.r*2+4,labelOwner:'city/'+e.item.id};
        if(occupied.some(b=>boxesIntersect(glyph,b,2)))continue;
        occupied.push(glyph);previous.push(e.p);drawCity(ctx,e,finish);let rect=null;
        if(showLabels&&!e.compact&&cityLabels<maxCityLabels){
          rect=placeLabel(ctx,labelOf(e.item),e.p,e.r,{font:'500 '+layout.font('city/'+e.item.id,span,'city')+'px Georgia, serif',maxWidth:Math.min(210,Math.max(155,width*.27)),maxLines:2,lineHeight:14,height:20,color:classifyStatus(e.item.status)==='dated'?'#e8d7af':'#ccd6cb',finish,layout,key:'city/'+e.item.id,nativeRow:nativeRow(o,'place',e.item.placeId||e.item.id,model.year),names25:o.names25},occupied,width,height);
          if(rect)cityLabels++;
        }
        hits.push(makeHit('city',e.item,e.p,Math.max(7,e.r+2),rect));
      }
      return hits;
    }finally{ctx.restore()}
  }
  return Object.freeze({draw,palette,hashString,classifyStatus,normalizeBox,boxesIntersect,projectPoint,routeGeometry,pointAtDistance,clipSegment,createLabelLayout,layoutStats});
});

/* Original locator labels reserve the whole bilingual block before foreground layout. */
(function(){
'use strict';
if(typeof drawMap!=='function'||window.languages25MapInstalled)return;
window.languages25MapInstalled=true;
const retained=drawMap;
function drawNames25Map(){if(cw<=1||ch<=1)return;drawMapReference();
 if($('rivers').checked&&current.span>=2){ctx.strokeStyle='#83bdcc9c';ctx.lineWidth=.9;for(const [riverIndex,river] of D.rivers.entries()){const points=window.awLandscapeRiver?window.awLandscapeRiver(riverIndex,river.points):river.points;drawMapPath(points)}}
 if(window.awWorldPass)window.awWorldPass('underlay');
 const named=$('labels').checked,dated=$('datedSites').checked;hits=[];const boxes=[];ctx.font='11px system-ui';const all=(window.worldController?.enabled===false?D.places:[...D.places,...(typeof INTERREGIONAL_PLACES==='undefined'?[]:INTERREGIONAL_PLACES)]).filter(p=>p.located&&(!dated||dateOnly(p))).sort((a,b)=>(b.id===selectedPlace)-(a.id===selectedPlace)||Number(dateOnly(b))-Number(dateOnly(a)));
 for(const place of all){const [x,y]=project(place.lon,place.lat);if(x<0||x>cw||y<0||y>ch-24)continue;const native=window.originalLanguages25?.lookup('place',place.id,year);let nativeFont=null,nativeWidth=0,nativeHeight=0;if(native){for(const size of [14,13,12,11]){const font=window.originalLanguages25.font(native,size);if(!font)break;ctx.font=font;const metric=ctx.measureText(native.text);if(metric.width<=Math.min(230,cw-30)){nativeFont=font;nativeWidth=metric.width;nativeHeight=Math.max(20,Math.ceil((metric.actualBoundingBoxAscent||size)+(metric.actualBoundingBoxDescent||3))+4);break}}}ctx.font='11px system-ui';const w=Math.max(ctx.measureText(place.name).width,nativeWidth);let show=named&&(window.worldController?.enabled===false||current.span<=100||place.id===selectedPlace)&&(!window.awWorldPlaceLabel||window.awWorldPlaceLabel(place));const rect={x:Math.min(x+9,cw-w-18),y:y-10,w:w+12,h:20+(nativeFont?nativeHeight+2:0)};if(native&&!nativeFont)show=false;if(rect.x<7||rect.y+rect.h>ch-8)show=false;if(place.id!==selectedPlace&&boxes.some(b=>rect.x<b.x+b.w&&rect.x+rect.w>b.x&&rect.y<b.y+b.h&&rect.y+rect.h>b.y))show=false;if(show)boxes.push(rect);const isSelected=place.id===selectedPlace,finish=window.centralFinish?.effectiveStrength||0,quiet=finish&&!dateOnly(place)&&!isSelected;ctx.globalAlpha=quiet?1-.28*finish:1;ctx.fillStyle=isSelected?'#f0d598':'#102129df';ctx.beginPath();ctx.arc(x,y,isSelected?5:quiet?3.5-1.35*finish:window.worldController?.enabled===false?3.5:current.span>160?1.8:current.span>90?2.5:3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=dateOnly(place)?'#dfc58d':'#d2e0dc';ctx.lineWidth=dateOnly(place)?2:quiet?.65:1;ctx.stroke();if(dateOnly(place)){ctx.fillStyle='#dfc58d';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill()}if(show){ctx.fillStyle=isSelected?'#e0c88b':'#102129df';ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.fillStyle=isSelected?'#142228':'#e1dfd1';ctx.fillText(place.name,rect.x+6,y+4);if(nativeFont){ctx.save();ctx.font=nativeFont;ctx.direction=native.direction==='rtl'?'rtl':'ltr';ctx.textAlign=native.direction==='rtl'?'right':'left';ctx.textBaseline='middle';ctx.fillText(native.text,native.direction==='rtl'?rect.x+rect.w-6:rect.x+6,rect.y+20+nativeHeight/2);ctx.restore()}}hits.push({x,y,p:place,rect:show?rect:null})}ctx.globalAlpha=1;
 const noRecord=window.worldController?.enabled!==false&&hits.length===0;const badge=$('medallion');if(badge&&typeof badge.classList?.toggle==='function')badge.classList.toggle('aw-physical-only',noRecord);const stage=$('stage');if(stage&&typeof stage.classList?.toggle==='function')stage.classList.toggle('aw-physical-context',noRecord);
 const vignette=ctx.createRadialGradient(cw*.48,ch*.42,ch*.22,cw*.5,ch*.5,Math.max(cw,ch)*.75);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,window.centralFinish?.effectiveStrength?'#14262d27':'#0712186b');ctx.fillStyle=vignette;ctx.fillRect(0,0,cw,ch);if(window.awWorldPass)window.awWorldPass('foreground',boxes);drawMapScale();terrainLayer.update(current,cw,ch);window.awWorldViewChanged?.();
}
drawMap=function(){if(!window.originalLanguages25?.enabled||window.worldController?.enabled===false)return retained.apply(this,arguments);return drawNames25Map.apply(this,arguments)};
})();

/* Independently saved historical-name display. No source records or old settings are changed. */
(function(){
'use strict';
if(window.originalLanguages25)return;
const config=typeof NAMES25_CONFIG==='object'?NAMES25_CONFIG:null,KEY='ancient-worlds.original-languages25.v1';
if(!config||config.schemaVersion!==1||typeof AncientWorldsNames25==='undefined')return;
let model=null,closed=false,suspended=false,wanted=false,ready=false,state='off',revision=0,generation=0,pending=null,error='',sourcePanel=null,attemptUsed=false;
const loaded=new Map(),families=new Map(),ownedFaces=[];
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.schemaVersion===1&&typeof saved.enabled==='boolean')wanted=saved.enabled}catch(_){}
const tools=$('stage')?.querySelector('.maptools');if(!tools)return;
const label=el('label'),input=el('input');input.type='checkbox';input.id='originalLanguages25';input.setAttribute('aria-label','Original languages');input.checked=wanted;label.append(input,document.createTextNode('Original languages'));tools.append(label);
const sourceButton=btn(tools,'Language sources',()=>openSources());sourceButton.id='languageSources25';sourceButton.setAttribute('aria-haspopup','dialog');
const style=el('style');style.textContent='.names25-native{font-style:normal;letter-spacing:0;line-height:1.7}.names25-card{padding:14px 16px;border-left:2px solid #9c9873;background:#22363299;margin:14px 0}.names25-card h3{font:21px Georgia,serif;margin:0 0 9px}.names25-card p{line-height:1.7;margin:7px 0}.names25-note{color:#c7c8b8;font-size:12px}.names25-status{min-height:2.5em;line-height:1.5;color:#dec795}.names25-card a{overflow-wrap:anywhere}.names25-script{font-size:24px;padding:7px 0;overflow-wrap:anywhere}';document.head.append(style);
const living=()=>window.worldController?.enabled!==false;
const active=()=>!closed&&!suspended&&wanted&&ready&&living();
function repaint(){curvaturePaintKey='';invalidate()}
function status(){return closed?'Original-language display is closed.':!wanted?'Original-language labels are off.':!living()?'Paused in Original map; your language preference is retained.':state==='loading'?'Loading verified historical-script fonts; English labels remain available.':state==='error'?'Original-language fonts could not be loaded or verified. English labels remain available. Use Retry.':ready?'Original-language labels appear where a dated, sourced form is available.':'Preparing historical names.'}
function sync(){input.checked=wanted;input.setAttribute('aria-busy',String(state==='loading'));label.title=status();sourceButton.title=status();if(sourcePanel?.isConnected&&!$('modalShade').classList.contains('hidden'))renderSources(sourcePanel)}
function cancel(){generation++;if(pending){pending.abort();pending=null}if(!ready)state=wanted?'idle':'off'}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({schemaVersion:1,enabled:wanted}))}catch(_){error='This device could not save the appearance preference.'}}
function setEnabled(value){if(typeof value!=='boolean')throw new TypeError('Original-language visibility must be boolean.');if(closed)return false;wanted=value;revision++;persist();if(!wanted){cancel();state=ready?'ready':'off'}else if(ready)state='ready';else{attemptUsed=false;void ensure()}repaint();sync();return true}
function aborted(signal){if(signal.aborted)throw Object.assign(new Error('Historical-font loading canceled.'),{name:'AbortError'})}
function waitWithAbort(promise,signal){aborted(signal);return new Promise((resolve,reject)=>{const stop=()=>{signal.removeEventListener('abort',stop);reject(Object.assign(new Error('Historical-font loading canceled.'),{name:'AbortError'}))};signal.addEventListener('abort',stop,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',stop);resolve(value)},reason=>{signal.removeEventListener('abort',stop);reject(reason)})})}
async function digest(raw){if(!globalThis.crypto?.subtle?.digest)throw new Error('Verified historical fonts require browser SHA-256 support.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(n=>n.toString(16).padStart(2,'0')).join('')}
function descriptors(){
 const rows=config.fonts;if(!Array.isArray(rows)||rows.length<1||rows.length>8)throw new Error('A bounded historical-font catalogue is required.');let total=0;const keys=new Set();
 for(const f of rows){if(!f||typeof f.key!=='string'||!/^[-a-zA-Z0-9_]{1,64}$/.test(f.key)||keys.has(f.key)||typeof f.family!=='string'||!/^[-a-zA-Z0-9_ ]{1,64}$/.test(f.family)||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>1024*1024||!/^[a-f0-9]{64}$/.test(f.sha256)||f.mimeType!=='font/woff2')throw new Error('Invalid historical-font descriptor.');keys.add(f.key);total+=f.bytes;families.set(f.key,f.family)}
 if(total>2*1024*1024)throw new Error('Historical-font total exceeds the byte budget.');
 for(const language of model.languages||config.data.languages||[])if(!keys.has(language.fontKey))throw new Error('A historical language has no packaged font.');return rows;
}
async function readVerified(f,signal){
 aborted(signal);let bytes;
 if(typeof f.base64==='string'){
  if(f.base64.length>Math.ceil(f.bytes/3)*4+4)throw new Error('Embedded historical font exceeds its declared size.');const text=atob(f.base64);bytes=Uint8Array.from(text,c=>c.charCodeAt(0)).buffer;
 }else{
  const base=new URL(config.assetBase||'./',location.href),url=new URL(f.url,base),match=/^\.\/?assets\/([a-f0-9]{64})\.woff2$/.exec(f.url||'');
  if(!match||match[1]!==f.sha256||!['https:','http:'].includes(url.protocol)||url.origin!==base.origin||url.search||url.hash||!url.href.startsWith(new URL('./assets/',base).href))throw new Error('An exact same-origin packaged font is required.');
  const response=await fetch(url.href,{signal,mode:'same-origin',credentials:'omit',cache:'force-cache',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('Historical font returned HTTP '+response.status);
  if(Number(response.headers?.get?.('Content-Length'))>f.bytes)throw new Error('Historical font exceeds its declared size.');
  if(response.body?.getReader){const reader=response.body.getReader(),parts=[];let size=0,finished=false;try{while(true){aborted(signal);const chunk=await waitWithAbort(reader.read(),signal);if(chunk.done){finished=true;break}size+=chunk.value.byteLength;if(size>f.bytes)throw new Error('Historical font exceeds its byte limit.');parts.push(chunk.value)}const all=new Uint8Array(size);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.byteLength}bytes=all.buffer}finally{if(!finished)reader.cancel().catch(()=>{});try{reader.releaseLock()}catch(_){}}}else bytes=await response.arrayBuffer();
 }
 aborted(signal);if(bytes.byteLength!==f.bytes||await digest(bytes)!==f.sha256)throw new Error('Historical-font byte identity differs.');aborted(signal);return bytes;
}
async function ensure(){
 if(closed||suspended||!wanted||ready||pending||attemptUsed)return false;attemptUsed=true;state='loading';error='';const controller=new AbortController(),ticket=++generation;pending=controller;sync();
 const timer=setTimeout(()=>controller.abort(),15000);let next=[];
 try{
  if(typeof FontFace!=='function'||!document.fonts?.add)throw new Error('This browser cannot load packaged historical fonts.');
  if(!model){const validation=AncientWorldsNames25.validate(config.data);if(!validation.valid)throw new Error('Historical name records failed validation.');model=AncientWorldsNames25.create(config.data)}
  const rows=descriptors();let cursor=0;const results=new Array(rows.length);
  async function worker(){while(cursor<rows.length){const i=cursor++,f=rows[i],raw=await readVerified(f,controller.signal);aborted(controller.signal);const face=new FontFace(f.family,raw,{style:'normal',weight:'400',display:'block'});await waitWithAbort(face.load(),controller.signal);aborted(controller.signal);results[i]={face,key:f.key}}}
  await Promise.all(Array.from({length:Math.min(2,rows.length)},worker));aborted(controller.signal);
  if(ticket!==generation||closed||suspended||!wanted)return false;
  next=results;for(const item of next){document.fonts.add(item.face);ownedFaces.push(item.face);loaded.set(item.key,item.face)}ready=true;state='ready';revision++;repaint();return true;
 }catch(e){controller.abort();if(ticket===generation&&!closed){state=wanted&&!suspended?'error':'off';error=e?.name==='AbortError'?'Font loading was canceled or timed out.':String(e?.message||e)}}finally{clearTimeout(timer);if(pending===controller)pending=null;if(ticket===generation)sync()}
 return false;
}
function retry(){if(closed||!wanted)return Promise.resolve(false);cancel();attemptUsed=false;error='';return ensure()}
function lookup(type,id,atYear){return active()?model.lookup(type,id,atYear):null}
function font(row,size=15){const family=families.get(row?.fontKey);return family&&loaded.has(row.fontKey)&&Number.isFinite(size)&&size>=10&&size<=30?size+'px "'+family+'"':null}
function paragraph(parent,text,cls=''){if(text)parent.append(el('p',cls,String(text)))}
function languageCaption(row,language){
 const label=row.languageLabel||language.label||row.languageId,script=row.script||language.script||'';
 const scripts={Cuneiform:'cuneiform',EgyptianHieroglyphs:'hieroglyphs',Phoenician:'alphabetic script',Ugaritic:'cuneiform alphabet',ImperialAramaic:'alphabetic script',OldPersian:'cuneiform',Hebrew:'alphabetic script',OldSouthArabian:'alphabetic script'};
 const readable=script==='Phoenician'&&/^Moabite\b/i.test(label)?'early alphabetic script':scripts[script]||script.replace(/([a-z])([A-Z])/g,'$1 $2');
 return readable&&readable.toLowerCase()!==label.toLowerCase()?label+' · '+readable:label;
}
function renderSources(box){
 box.replaceChildren(el('h3','','Historical names and scripts'),el('p','names25-status',status()));
 paragraph(box,'This optional line shows a sourced historical name in its associated language and script, below the English label. Forms are selected by place or historical period and date, rather than assigned from modern national languages.','names25-note');
 paragraph(box,'A blank second line means no suitable sourced form is entered. Historical polity terms and regional endonyms are distinguished; editorial dynasty numbers and modern archaeological labels are not translated into invented ancient titles. Script layout may be normalized Unicode transcription, as the individual notes explain.','names25-note');
 const fontNotices=el('details');fontNotices.append(el('summary','','Historical-script fonts and licence'));paragraph(fontNotices,'Historical scripts use bundled Noto fonts under the SIL Open Font License. These normalized glyphs are reading aids, not reproductions of individual inscriptions or period-specific handwriting.','names25-note');
 if(typeof config.fontLicenseText==='string'){const pre=el('pre','',config.fontLicenseText);pre.style.whiteSpace='pre-wrap';pre.style.font='11px/1.5 system-ui';fontNotices.append(pre)}else if(config.fontLicense){try{const f=config.fontLicense,base=new URL(config.assetBase||'./',location.href),u=new URL(f.url,base),match=/^\.\/assets\/([a-f0-9]{64})\.txt$/.exec(f.url||'');if(match&&match[1]===f.sha256&&u.origin===base.origin&&!u.search&&!u.hash){const a=el('a','','Read bundled font copyright and licence notices');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';fontNotices.append(a)}}catch(_){}}
 box.append(fontNotices);
 if(error)paragraph(box,error,'names25-note');if(wanted&&!ready)btn(box,'Retry original-language fonts',()=>void retry());
 const rows=model?.forms||config.data.forms||[],sources=new Map((model?.sources||config.data.sources||[]).map(s=>[s.id,s])),languages=new Map((model?.languages||config.data.languages||[]).map(l=>[l.id,l]));
 for(const row of rows){const language=languages.get(row.languageId)||{},card=el('section','names25-card');card.append(el('h3','',row.english||row.id||'Historical name'));paragraph(card,languageCaption(row,language)+' · '+row.dates.startBce+'–'+row.dates.endBce+' BCE','names25-note');
  const enriched={...row,fontKey:row.fontKey||language.fontKey,direction:row.direction||language.direction};const css=font(enriched,24);if(css){const native=el('div','names25-script names25-native',row.text);native.style.font=css;native.setAttribute('dir',enriched.direction==='rtl'?'rtl':'ltr');card.append(native)}else paragraph(card,'Enable original languages to load the packaged script font.','names25-note');
  paragraph(card,row.transliteration,'names25-native');paragraph(card,row.attestationNote);paragraph(card,row.displayNote,'names25-note');
  for(const ref of row.sourceRefs||[]){const source=sources.get(ref.sourceId);if(!source)continue;const a=el('a','',source.title);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);paragraph(card,ref.locator,'names25-note')}
  box.append(card);
 }
}
function openSources(){if(closed)return;const box=modal('Original languages');sourcePanel=el('div','names25-sources');box.append(sourcePanel);renderSources(sourcePanel)}
input.onchange=()=>setEnabled(input.checked);
let previousLiving=living();const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{const now=living();if(now!==previousLiving){previousLiving=now;revision++;repaint();sync()}}):null;observer?.observe(document.body,{attributes:true,attributeFilter:['class']});
function hide(event){suspended=true;cancel();revision++;if(!event.persisted)close()}
function show(){if(closed)return;suspended=false;attemptUsed=false;if(wanted&&!ready)void ensure();revision++;repaint();sync()}
function close(){if(closed)return;closed=true;cancel();observer?.disconnect();window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);for(const face of ownedFaces)document.fonts.delete?.(face);loaded.clear();label.remove();sourceButton.remove();style.remove();repaint()}
window.originalLanguages25=Object.freeze({get enabled(){return active()},get ready(){return ready&&!closed},get revision(){return revision},get state(){return state},get wanted(){return wanted},get error(){return error},lookup,font,setEnabled,retry,openSources,close});
window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);sync();if(wanted)void ensure();
})();
