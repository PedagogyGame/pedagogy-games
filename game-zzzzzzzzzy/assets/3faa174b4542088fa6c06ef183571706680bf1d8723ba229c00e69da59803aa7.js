/* One lazily admitted metadata registry, with the retained bounded terrain reader.
   Numeric pixels never use the Tilezen persistent namespace. No view-sized banks. */
(function(factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else window.AncientWorldsCorridorTerrain=api})(function(){
'use strict';
const PROVIDER='copernicus-glo30-corridor23',PILOT_PROVIDER='copernicus-glo30-study22',MiB=1024*1024;
const LIMITS=Object.freeze({catalogRecords:4096,registryRecords:4144,catalogBytes:2*MiB,declaredPngBytes:256*MiB,tileBytes:MiB,embeddedTiles:256,embeddedBytes:24*MiB,automaticRequests:512,automaticBytes:128*MiB,catalogAttempts:3});
const registrations=new WeakMap(),finite=Number.isFinite;
const abort=()=>Object.assign(new Error('Corridor terrain canceled'),{name:'AbortError'}),check=s=>{if(s?.aborted)throw abort()};
const latitude=(row,z)=>Math.atan(Math.sinh(Math.PI*(1-2*row/2**z)))*180/Math.PI;
function coverageOf(value){
 const rectangles=Array.isArray(value)?value:value?.rectangles;
 if(!Array.isArray(rectangles)||!rectangles.length||rectangles.length>16||rectangles.some(r=>!Array.isArray(r)||r.length!==4||!r.every(finite)||r[0]<-180||r[2]>180||r[1]<-80||r[3]>80||r[0]>=r[2]||r[1]>=r[3]))throw new TypeError('A bounded finite corridor coverage is required.');
 return rectangles.map(r=>Object.freeze([...r]));
}
function overlaps(a,b){const offset=360*Math.round(((a[0]+a[2])-(b[0]+b[2]))/720);return a[0]<=b[2]+offset&&a[2]>=b[0]+offset&&a[1]<=b[3]&&a[3]>=b[1]}
function sourcesOf(pack){
 const licence=pack.licence||pack.license;
 if(pack.schemaVersion!==1||pack.providerId!==PROVIDER||pack.encoding!=='terrarium'||pack.modernReference!==true||!Array.isArray(pack.sources)||!pack.sources.length||pack.sources.length>64||!licence||typeof licence!=='object'||Array.isArray(licence)||!Object.keys(licence).length)throw new TypeError('Typed modern corridor sources and licence metadata are required.');
 const ids=new Set();for(const s of pack.sources){if(!s||typeof s.id!=='string'||!s.id||s.id.length>160||ids.has(s.id))throw new TypeError('Unique identified corridor sources are required.');ids.add(s.id)}return ids;
}
function recordOf(tile,sourceIds,{embedded=false}={}){
 if(!tile||![10,11,12].includes(tile.z)||!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||tile.x<0||tile.y<0||tile.x>=2**tile.z||tile.y>=2**tile.z)throw new RangeError('Canonical z10–12 terrain coordinates are required.');
 const key=`${tile.z}/${tile.x}/${tile.y}`,n=2**tile.z,bounds=[tile.x/n*360-180,latitude(tile.y+1,tile.z),(tile.x+1)/n*360-180,latitude(tile.y,tile.z)];
 if(tile.key!==key||!Array.isArray(tile.bounds)||tile.bounds.length!==4||tile.bounds.some((v,i)=>!finite(v)||Math.abs(v-bounds[i])>1e-7))throw new RangeError('Terrain key and bounds must describe its canonical tile.');
 if(!Number.isSafeInteger(tile.bytes)||tile.bytes<1||tile.bytes>LIMITS.tileBytes||typeof tile.sha256!=='string'||!/^[a-f0-9]{64}$/.test(tile.sha256))throw new TypeError('Bounded exact terrain byte identity is required.');
 if(!Array.isArray(tile.sourceIds)||!tile.sourceIds.length||tile.sourceIds.length>16||new Set(tile.sourceIds).size!==tile.sourceIds.length||tile.sourceIds.some(id=>!sourceIds.has(id)))throw new TypeError('Terrain sources must resolve to the declared source catalogue.');
 if(embedded){
  if(tile.z!==10||typeof tile.pngBase64!=='string'||tile.url!==undefined)throw new TypeError('The embedded corridor pack contains z10 parents only.');
  const text=tile.pngBase64,padding=text.endsWith('==')?2:text.endsWith('=')?1:0;
  if(!text.length||text.length>Math.ceil(LIMITS.tileBytes*4/3)+8||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length*3/4-padding!==tile.bytes)throw new TypeError('Embedded terrain size is inconsistent.');
 }else if(tile.pngBase64!==undefined||typeof tile.url!=='string'||!new RegExp('^(?:\\./)?assets/'+tile.sha256+'\\.png$').test(tile.url))throw new TypeError('Streamed terrain needs an exact same-origin content-addressed PNG descriptor.');
 return Object.freeze({z:tile.z,x:tile.x,y:tile.y,key,bounds:Object.freeze(bounds),bytes:tile.bytes,sha256:tile.sha256,...(embedded?{pngBase64:tile.pngBase64}:{url:tile.url}),sourceIds:Object.freeze([...tile.sourceIds]),mimeType:'image/png',corridorProviderId:PROVIDER});
}
function embeddedOf(pack,coverage){
 if(pack==null)return new Map();const sourceIds=sourcesOf(pack);
 if(!Array.isArray(pack.tiles)||pack.tiles.length>LIMITS.embeddedTiles)throw new RangeError('Embedded corridor parent count exceeds its limit.');
 const records=new Map();let bytes=0;for(const tile of pack.tiles){const r=recordOf(tile,sourceIds,{embedded:true});if(records.has(r.key)||!coverage.some(b=>overlaps(r.bounds,b)))throw new Error('Duplicate or out-of-coverage embedded parent.');records.set(r.key,r);bytes+=r.bytes}
 if(bytes>LIMITS.embeddedBytes)throw new RangeError('Embedded parents exceed24MiB.');return records;
}
function descriptorOf(descriptor){
 if(!descriptor||typeof descriptor.url!=='string'||!Number.isSafeInteger(descriptor.bytes)||descriptor.bytes<1||descriptor.bytes>LIMITS.catalogBytes||typeof descriptor.sha256!=='string'||!new RegExp('^(?:\\./)?assets/'+descriptor.sha256+'\\.json$').test(descriptor.url))throw new TypeError('An exact bounded same-origin corridor JSON descriptor is required.');
 return Object.freeze({...descriptor,mimeType:'application/json'});
}
const defaultYield=()=>typeof globalThis.scheduler?.yield==='function'?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
async function normalizeCatalog(pack,coverage,{signal,yieldWork=defaultYield}={}){
 check(signal);const sourceIds=sourcesOf(pack),declaredCoverage=coverageOf(pack.coverage||coverage);
 if(JSON.stringify(declaredCoverage)!==JSON.stringify(coverage))throw new Error('Corridor catalogue coverage differs from its boot contract.');
 if(!Array.isArray(pack.tiles)||!pack.tiles.length||pack.tiles.length>LIMITS.catalogRecords)throw new RangeError('Corridor record count exceeds its bounded catalogue.');
 const records=new Map();let bytes=0;
 for(let i=0;i<pack.tiles.length;i++){
  check(signal);const r=recordOf(pack.tiles[i],sourceIds);if(records.has(r.key)||!coverage.some(b=>overlaps(r.bounds,b)))throw new Error('Duplicate or out-of-coverage corridor terrain.');records.set(r.key,r);bytes+=r.bytes;if(bytes>LIMITS.declaredPngBytes)throw new RangeError('Declared corridor PNGs exceed256MiB.');
  if((i+1)%64===0&&i+1<pack.tiles.length){await yieldWork();check(signal)}
 }
 return {records,bytes,sourceCount:sourceIds.size};
}
async function verifyBlob(blob,record,signal){
 check(signal);if(!blob||blob.size!==record.bytes||blob.size>LIMITS.tileBytes)throw new Error('Corridor PNG size differs.');
 if(!globalThis.crypto?.subtle?.digest)throw new Error('Terrain integrity unavailable; reference retained.');
 const bytes=await blob.arrayBuffer();check(signal);const hash=await crypto.subtle.digest('SHA-256',bytes);check(signal);
 if([...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')!==record.sha256)throw new Error('Corridor PNG hash differs.');
 const h=new Uint8Array(bytes,0,Math.min(26,bytes.byteLength));if(h.length!==26||![137,80,78,71,13,10,26,10].every((v,i)=>h[i]===v)||![73,72,68,82].every((v,i)=>h[i+12]===v)||new DataView(bytes).getUint32(16)!==256||new DataView(bytes).getUint32(20)!==256||h[24]!==8||![2,6].includes(h[25]))throw new Error('A256×256 eight-bit RGB/RGBA terrain PNG is required.');return blob;
}
function register(layer,options){
 if(!layer?.bundleIndex||!layer.cache||typeof layer.fetchTile!=='function'||typeof layer.bundleBlob!=='function'||typeof layer.retry!=='function')throw new TypeError('The retained bounded terrain reader is required.');
 if(!options||!['streamed','embedded'].includes(options.mode))throw new TypeError('An explicit streamed or embedded corridor mode is required.');
 if(registrations.has(layer))throw new Error('A corridor manager is already registered for this terrain reader.');
 const coverage=coverageOf(options.coverage),parents=embeddedOf(options.offlinePack,coverage),catalog=options.catalog?descriptorOf(options.catalog):null,threshold=options.autoloadBelowSpan??12;
 if(!finite(threshold)||threshold<=0||threshold>15)throw new RangeError('Corridor autoload scale must be within the retained terrain detail scale.');
 const legacy=options.retainedAPI||globalThis.AncientWorldsLandformTiles;if(!legacy?.normalize||!legacy?.register||!options.retainedManager)throw new TypeError('The retained pilot manager and API are required.');
 const pilot=legacy.normalize(options.retainedPack),assets=options.assets||globalThis.AncientWorldsAssets?.shared;
 if(catalog&&typeof assets?.json!=='function')throw new TypeError('A bounded verified asset reader is required for the corridor catalogue.');
 const canStream=options.canStream||(()=>{const loc=globalThis.location;if(!/^https?:$/.test(loc?.protocol||''))return false;return ['localhost','127.0.0.1','[::1]','::1'].includes(loc.hostname)||(typeof navigator==='undefined'||navigator.onLine!==false)});
 const preferenceOriginal=layer.setNetworkAllowed,eventTarget=options.eventTarget||globalThis.window;
 const listeners=new Set(),registry=new Map(),priorRecords=new Map(),failed=new Set(),offlineFailures=new Set(),pending=new Map(),attempted=new Set();
 let active=false,closed=false,original=null,restoredPilot=null,loadController=null,loadingPromise=null,catalogStatus=catalog?'idle':'unavailable',catalogError='',catalogAttempts=0,parsedRecords=0,declaredBytes=0;
 let attempts=0,attemptsSinceRetry=0,readBytes=0,readBytesSinceRetry=0,assetFailures=0,paused=false,lastView=null,lastBounds=null,emitTimer=null,lastEmit='',baseStatus='',lastDecorated='';
 const emit=()=>{if(emitTimer!==null||closed)return;emitTimer=setTimeout(()=>{emitTimer=null;const s=stats(),key=JSON.stringify(s);if(key===lastEmit)return;lastEmit=key;for(const f of listeners)try{f(s)}catch(e){}},0)};
 function stats(){
  let loadedCorridorTiles=0,loadedPilotTiles=0,drawableCorridorCells=0,drawablePilotCells=0,drawableBaseCells=0,minZoom=null,maxZoom=null;
  for(const tile of layer.cache.values())if(tile.terrainSourceId===PROVIDER)loadedCorridorTiles++;else if(tile.terrainSourceId===PILOT_PROVIDER)loadedPilotTiles++;
  const drawable=layer.active();if(drawable)for(const key of layer.wanted){const [z,x,y]=key.split('/').map(Number),tile=layer.bestTile({z,x,y});if(tile?.terrainSourceId===PROVIDER){drawableCorridorCells++;minZoom=minZoom===null?tile.z:Math.min(minZoom,tile.z);maxZoom=maxZoom===null?tile.z:Math.max(maxZoom,tile.z)}else if(tile?.terrainSourceId===PILOT_PROVIDER)drawablePilotCells++;else if(tile)drawableBaseCells++;}
  return {providerId:PROVIDER,active:active&&drawable&&!closed,registered:active,closed,catalogState:catalogStatus,catalogError,catalogAttempts,catalogRecordCount:parsedRecords,registeredTiles:registry.size,declaredPngBytes:declaredBytes,embeddedParents:parents.size,loadedCorridorTiles,loadedPilotTiles,loadedStudyTiles:loadedCorridorTiles+loadedPilotTiles,drawableCorridorCells,drawablePilotCells,drawableRetainedCells:drawablePilotCells,drawableStudyCells:drawableCorridorCells+drawablePilotCells,drawableBaseCells,minCorridorZoom:minZoom,maxCorridorZoom:maxZoom,activeStudyRequests:pending.size,failedStudyTiles:failed.size,attempts,automaticAttempts:attemptsSinceRetry,readBytes,automaticBytes:readBytesSinceRetry,assetFailures,paused,maxAutomaticAttempts:LIMITS.automaticRequests,maxAutomaticBytes:LIMITS.automaticBytes,maxCatalogRecords:LIMITS.catalogRecords,maxRegistryRecords:LIMITS.registryRecords,meaning:'Actual drawable modern surface-model sources;30m source posting is not source accuracy or ancient terrain reconstruction.'};
 }
 function invalidateKeys(keys){for(const key of keys){layer.pending.get(key)?.controller.abort();layer.pending.delete(key);layer.finePending.get(key)?.controller.abort();const tile=layer.cache.get(key);if(tile){if(tile.shade)tile.shade.width=tile.shade.height=0;layer.cache.delete(key)}const fine=layer.fineCache.get(key);if(fine)fine.canvas.width=fine.canvas.height=0;layer.fineCache.delete(key);layer.fineFailed.delete(key);layer.failed.delete(key)}layer.fineShader?.clear?.();layer.lastSignature='';layer.statusStamp='';layer.paintRevision++;}
 function addRecords(records){
  const changed=[];for(const [key,incoming]of records){let next=incoming;const before=registry.get(key);if(before?.pngBase64&&before.sha256===incoming.sha256){next={...incoming,pngBase64:before.pngBase64};delete next.url;next=Object.freeze(next)}
   if(before?.sha256===next.sha256&&before.corridorProviderId===next.corridorProviderId)continue;
   if(!priorRecords.has(key))priorRecords.set(key,layer.bundleIndex.has(key)?layer.bundleIndex.get(key):null);registry.set(key,next);layer.bundleIndex.set(key,next);changed.push(key);
  }
  if(registry.size>LIMITS.registryRecords)throw new RangeError('Combined terrain descriptor registry exceeds its ceiling.');if(changed.length)invalidateKeys(changed);layer.notify(true);emit();
 }
 function activate(){
  if(active)return;options.retainedManager.close();original={bundleBlob:layer.bundleBlob,fetchTile:layer.fetchTile,status:layer.status,retry:layer.retry};active=true;
  layer.bundleBlob=async function(record,signal){
   if(closed||registry.get(record.key)!==record)return original.bundleBlob.call(this,record,signal);check(signal);const request={};attempted.add(record.key);pending.set(record.key,request);
   try{let blob;if(typeof record.pngBase64==='string')blob=await original.bundleBlob.call(this,record,signal);else{
    if(!this.networkAllowed||!canStream()){offlineFailures.add(record.key);throw new Error('Corridor detail offline; embedded and retained reference kept.');}
    if(attemptsSinceRetry>=LIMITS.automaticRequests||readBytesSinceRetry+record.bytes>LIMITS.automaticBytes){paused=true;throw new Error('Corridor detail paused; Retry in details.');}
    attempts++;attemptsSinceRetry++;blob=await assets.blob(record,{signal,maxBytes:LIMITS.tileBytes,priority:20});readBytes+=blob.size;readBytesSinceRetry+=blob.size;
   }return await verifyBlob(blob,record,signal)}catch(error){if(error?.name!=='AbortError'&&!signal?.aborted){failed.add(record.key);assetFailures++}throw error}finally{if(pending.get(record.key)===request)pending.delete(record.key);emit()}
  };
  layer.fetchTile=async function(task){
   const record=task.skipBundled?null:registry.get(task.key),work=original.fetchTile.call(this,task),controller=this.pending.get(task.key)?.controller;await work;if(closed||!record||!attempted.has(task.key))return;const tile=this.cache.get(task.key);
   if(tile?.source==='bundled'&&!controller?.signal.aborted){tile.source='corridor-study';tile.terrainSourceId=record.corridorProviderId||PILOT_PROVIDER;tile.corridorSha256=record.sha256;tile.upstream=tile.terrainSourceId===PROVIDER?'Copernicus GLO30 corridor23 modern DSM ·1arcsecond, EGM2008':'Retained Copernicus GLO30 pilot22 modern DSM ·1arcsecond, EGM2008';tile.sourceIds=[...record.sourceIds];failed.delete(task.key);this.status();emit()}
   else if(!controller?.signal.aborted&&this.requested.has(task.key)&&!tile?.terrainSourceId){failed.add(task.key);if(this.active()&&!tile&&!this.pending.has(task.key)&&!this.queue.some(t=>t.key===task.key))await original.fetchTile.call(this,{...task,skipBundled:true});emit()}
  };
  layer.status=function(...args){
   const stamp=this.statusStamp;original.status.apply(this,args);if(this.statusStamp!==stamp||this.statusText!==lastDecorated)baseStatus=this.statusText||'';const s=stats(),cop=s.drawableCorridorCells+s.drawablePilotCells;
   const source=cop?(s.drawableBaseCells?'Copernicus GLO30 / Mapzen / Tilezen':s.drawableCorridorCells?'Copernicus GLO30 corridor':'Copernicus GLO30 retained pilots'):'Mapzen / Tilezen';let text=baseStatus.replace(/Mapzen \/ Tilezen$/,source);if(paused&&s.active)text+=' · study detail paused; Retry';if(text!==this.statusText)this.statusText=text;lastDecorated=text;
   if(typeof document!=='undefined'){const hud=document.getElementById('terrainStatus');if(hud&&hud.textContent!==text)hud.textContent=text;}emit();
  };
  layer.retry=function(){attemptsSinceRetry=readBytesSinceRetry=0;paused=false;if(failed.size)invalidateKeys([...failed]);failed.clear();original.retry.call(this);this.notify(true);if(catalogStatus==='error'){catalogStatus='idle';catalogError='';void startCatalog()}emit()};
  addRecords(new Map([...pilot.records].map(([key,r])=>[key,Object.freeze({...r,corridorProviderId:PILOT_PROVIDER})])));addRecords(parents);layer.status();
 }
 function eligible(view,bounds){return !closed&&layer.active()&&view&&finite(view.span)&&view.span>0&&view.span<threshold&&Array.isArray(bounds)&&bounds.length===4&&bounds.every(finite)&&coverage.some(r=>overlaps(bounds,r))}
 function streamAllowed(){return layer.networkAllowed&&canStream()}
 async function startCatalog(){
  if(closed||!catalog||catalogStatus==='ready'||catalogStatus==='error'||loadingPromise||!eligible(lastView,lastBounds)||!streamAllowed())return loadingPromise;
  loadController=new AbortController();const controller=loadController;catalogStatus='loading';catalogError='';emit();
  loadingPromise=(async()=>{try{let value;for(let attempt=0;attempt<LIMITS.catalogAttempts;attempt++){
   check(controller.signal);catalogAttempts++;try{value=await assets.json(catalog,{signal:controller.signal,maxBytes:LIMITS.catalogBytes,priority:-10});break}catch(error){const retryable=/timed out|network|failed to fetch|fetch failed|HTTP\s*(?:408|429|5\d\d)/i.test(error?.message||'');if(error?.name==='AbortError'||!retryable||attempt===LIMITS.catalogAttempts-1)throw error;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}
  }
  catalogStatus='validating';emit();const result=await normalizeCatalog(value,coverage,{signal:controller.signal,yieldWork:options.yieldWork||defaultYield});check(controller.signal);if(!eligible(lastView,lastBounds)||!streamAllowed())throw abort();activate();addRecords(result.records);parsedRecords=result.records.size;declaredBytes=result.bytes;catalogStatus='ready';catalogError='';layer.status();emit();
  }catch(error){if(!closed){catalogStatus=error?.name==='AbortError'?'idle':'error';catalogError=error?.name==='AbortError'?'':String(error.message||error);emit()}}
  finally{if(loadController===controller)loadController=null;loadingPromise=null;if(controller.signal.aborted&&!closed&&eligible(lastView,lastBounds)&&streamAllowed())void startCatalog();}})();return loadingPromise;
 }
 const onlineHandler=()=>{if(!closed&&layer.networkAllowed)void manager.prepare(lastView,lastBounds)};
 layer.setNetworkAllowed=function(...args){const result=preferenceOriginal.apply(this,args);if(!this.networkAllowed)loadController?.abort();else{if(active&&offlineFailures.size){invalidateKeys([...offlineFailures]);for(const key of offlineFailures)failed.delete(key);offlineFailures.clear();this.notify(true)}void startCatalog()}emit();return result};
 eventTarget?.addEventListener?.('online',onlineHandler);
 const manager={get stats(){return stats()},get state(){return paused?'paused':catalogStatus},prepare(view,bounds){
  lastView=view?{...view}:null;lastBounds=Array.isArray(bounds)?[...bounds]:null;if(!eligible(lastView,lastBounds)||!streamAllowed()){loadController?.abort();return Promise.resolve()}return startCatalog();
 },retry(){if(closed)return Promise.resolve();if(active)layer.retry();else{catalogStatus='idle';catalogError='';}return startCatalog()},subscribe(listener){if(typeof listener!=='function'||listeners.size>=16)throw new TypeError('A bounded corridor listener is required.');listeners.add(listener);return ()=>listeners.delete(listener)},close(){
  if(closed)return;closed=true;loadController?.abort();layer.setNetworkAllowed=preferenceOriginal;eventTarget?.removeEventListener?.('online',onlineHandler);if(emitTimer!==null)clearTimeout(emitTimer);emitTimer=null;listeners.clear();if(active){invalidateKeys([...registry.keys()]);for(const [key,r]of registry)if(layer.bundleIndex.get(key)===r){const before=priorRecords.get(key);if(before)layer.bundleIndex.set(key,before);else layer.bundleIndex.delete(key)}for(const name of Object.keys(original))layer[name]=original[name];if(!layer.disposed)restoredPilot=legacy.register(layer,options.retainedPack);}registry.clear();failed.clear();offlineFailures.clear();pending.clear();attempted.clear();registrations.delete(layer);catalogStatus='closed';
 },get restoredPilot(){return restoredPilot}};
 registrations.set(layer,manager);if(parents.size)activate();return manager;
}
return {register,normalizeCatalog,verifyBlob,coverageOf,overlaps,limits:LIMITS};
});

const CORRIDOR23_CONFIG={"schemaVersion":1,"mode":"streamed","catalog":{"url":"./assets/3a4b52f693c2aab10e266fab1ab8cc226091aa28c329c5a7701bbfc2add8dc19.json","bytes":812899,"sha256":"3a4b52f693c2aab10e266fab1ab8cc226091aa28c329c5a7701bbfc2add8dc19","mimeType":"application/json"},"coverage":{"rectangles":[[34.9,30.8,36.1,32.2],[34.8,32.05,36.2,33.55],[35.05,33.4,36.65,34.8],[35.35,34.65,36.65,35.9]],"highestZoom":12,"fineTileCount":1173,"totalTileCount":1590,"meaning":"Connected editorial physical-detail coverage; not political, historical or research-importance boundaries"},"autoloadBelowSpan":12,"assetBase":"./","offlinePack":null};
/* Continuous physical detail, preserving the atlas date and prior controls. */
(function(){
'use strict';
if(window.corridor23)return;
if(typeof LANDFORMS22_TERRAIN==='undefined'||!window.landformTerrain22||typeof AncientWorldsLandformTiles==='undefined'){document.querySelector('.detail-hud')?.append(' · Corridor detail unavailable; reference retained');return}
const config=CORRIDOR23_CONFIG,reader=AncientWorldsAssets.create({baseURL:new URL(config.assetBase,location.href).href,maxActive:4,maxQueued:24});
const manager=AncientWorldsCorridorTerrain.register(terrainLayer,{...config,retainedPack:LANDFORMS22_TERRAIN,retainedManager:window.landformTerrain22,retainedRegister:AncientWorldsLandformTiles.register,assets:reader});
const cameras=[
 {id:'C23-DEADSEA',name:'Dead Sea and Jordan Valley',lon:35.48,lat:31.65,span:.42},
 {id:'C23-GALILEE',name:'Galilee and upper Jordan',lon:35.55,lat:32.93,span:.48},
 {id:'C23-LEBANON',name:'Lebanon ranges and the Beqaa',lon:35.96,lat:33.97,span:.58},
 {id:'C23-NORTH',name:'Northern Levantine coast',lon:35.83,lat:35.56,span:.58}
];
let root=null,status=null,observer=null;
const style=el('style');style.textContent=`.c23{padding:20px;border:1px solid #8b986d;border-radius:9px;margin:18px 0;background:linear-gradient(130deg,#2c4739,#1c353a)}.c23 h3{font:26px/1.25 Georgia,serif;color:#e9d7ab;margin:8px 0 13px}.c23 p{font-size:12px;line-height:1.75}.c23 .c23-kicker{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#b6cbb7}.c23-actions{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}.c23-status{color:#dfcf9e;font-size:12px;line-height:1.65}.c23 details{border-top:1px solid #58735b;padding-top:12px;margin-top:15px}.c23 summary{font-size:12px;cursor:pointer;color:#c6d4bd}.c23-source-note{border-left:1px solid #819677;padding:0 0 0 13px;margin:18px 0}.c23-source-note p{font-size:12px;line-height:1.7}@media(max-width:620px){.c23{padding:16px}.c23 h3{font-size:23px}}`;document.head.append(style);
function sourceText(){
 const s=manager.stats||{},state=manager.state;
 if(state==='loading'||state==='validating')return 'Preparing continuous terrain detail · the reference remains visible.';
 if(state==='error'||state==='unavailable')return 'Continuous detail is unavailable here · the preserved terrain remains visible. Retry when the connection is available.';
 if(state==='paused'||s.paused)return 'Automatic detail loading paused · Retry to continue exploring.';
 if(s.drawableCorridorCells>0)return 'This view includes Copernicus GLO30 corridor detail. Surrounding and pending areas keep their available reference.';
 if(config.mode==='embedded'&&location.protocol==='file:')return 'Embedded regional detail and the earlier study patches are available. Use the local browser launcher or online game for full close-up corridor detail.';
 return 'Closer views load the finer terrain they need. The current map and historical date stay available throughout.';
}
function refresh(){
 if(status?.isConnected&&status.textContent!==sourceText())status.textContent=sourceText();
 const old=document.getElementById('landforms22-source-note');
 if(old&&old.parentNode){const s=manager.stats||{};old.replaceChildren(el('h3','','Continuous physical terrain'));p(old,`${s.drawableCorridorCells||0} visible cells use corridor terrain; ${s.drawableRetainedCells||0} use earlier study detail; ${s.drawableBaseCells||0} use broader reference. Source coverage is a physical-data distinction, independent of this project’s historical research focus.`,'small muted');p(old,'Counts describe this view at the time of the last terrain update. Source posting, surface objects and vertical-datum limits remain explicit in Landforms.','small muted')}
}
function prepare(){const view=window.mapView?.current||current,bounds=typeof mapViewBounds==='function'?mapViewBounds(view):undefined;manager.prepare(view,bounds);refresh()}
function closeDetails(){if($('modalShade'))$('modalShade').classList.add('hidden')}
function viewCamera(id){const camera=cameras.find(c=>c.id===id);if(!camera)throw new RangeError('Unknown corridor view.');window.worldController?.pauseJourney?.();if(window.worldController?.enabled===false)window.worldController.setEnabled(true);selectedPlace=null;closeDetails();window.mapView.set({lon:camera.lon,lat:camera.lat,span:camera.span});prepare()}
function viewWhole(){
 const rs=config.coverage.rectangles||config.coverage,west=Math.min(...rs.map(r=>r[0])),south=Math.min(...rs.map(r=>r[1])),east=Math.max(...rs.map(r=>r[2])),north=Math.max(...rs.map(r=>r[3])),lat=(south+north)/2;
 window.worldController?.pauseJourney?.();if(window.worldController?.enabled===false)window.worldController.setEnabled(true);selectedPlace=null;closeDetails();window.mapView.set({lon:(west+east)/2,lat,span:Math.max(east-west,(north-south)*cw/Math.max(1,ch)/Math.cos(lat*Math.PI/180))*1.15});prepare();
}
function supplement(){
 const box=$('modal');if(!box)return;
 const shell=box.querySelector('.lf22');
 if(shell&&!shell.querySelector('#corridor23-panel')){
  const hero=shell.querySelector('.lf22-hero');if(hero){for(const line of [...hero.querySelectorAll('p')])if(line.textContent.startsWith('Two higher-detail pilots'))line.textContent='Continuous high-detail terrain now connects the Jordan Valley, Galilee, Lebanon and the northern Levantine coast. The earlier Zagros study patch remains available.'}
  root=el('section','c23');root.id='corridor23-panel';root.append(el('div','c23-kicker','Continuous detail · one connected landscape'),el('h3','','The Levant–Jordan corridor'));
  p(root,'Explore a connected band of modern Copernicus GLO30 terrain, from the Dead Sea and Jordan Valley through Galilee and Lebanon to the northern Levantine coast. This is physical reference coverage; it adds no historical borders, channels or occupation claims.');
  const actions=el('div','c23-actions');btn(actions,'View the whole corridor',viewWhole);for(const c of cameras)btn(actions,'Explore '+c.name,()=>viewCamera(c.id));root.append(actions);status=el('p','c23-status');status.setAttribute('role','status');root.append(status);
  const details=el('details');details.append(el('summary','','Coverage, sources and offline detail'));p(details,'The corridor uses the same modern30-metre source product as the earlier detail pilots. Output sampling changes with zoom. Posting size is separate from positional or height accuracy; vegetation and structures can remain in this surface model.');p(details,'Sampled southern and central areas previously used90-metre SRTM. The sampled northern coastal area already used30-metre EUDEM; the improvement there is source consistency, with no universal threefold resolution claim.');p(details,'The dataset uses EGM2008 heights. Surrounding older sources have different datums and levels of detail; source joins are tested without claiming uniformly surveyed heights. Existing coastline and water geometry remain independent.');p(details,'The online game and the locally served Browser edition contain the complete close-up corridor tiles. The single-file embedded game retains all earlier content, the two earlier study patches and continuous broader corridor terrain. It can load full detail when served with the project’s Online assets; raw-file viewing retains its embedded fallback.');const a=el('a','','Copernicus terrain source and licence');a.href='https://registry.opendata.aws/copernicus-dem/';a.target='_blank';a.rel='noopener noreferrer';details.append(a);btn(details,'Retry corridor detail',()=>{manager.retry();prepare()});root.append(details);hero?.after(root);if(!hero)shell.prepend(root);
 }
 refresh();
}
observer=new MutationObserver(supplement);observer.observe($('modal'),{childList:true});
const offMap=window.mapView?.subscribe(prepare),offManager=manager.subscribe?.(refresh);
function release(event){if(event?.persisted)return;observer.disconnect();offMap?.();offManager?.();window.removeEventListener('pageshow',prepare);window.removeEventListener('pagehide',release);manager.close()}
window.addEventListener('pageshow',prepare);window.addEventListener('pagehide',release);
window.corridor23={manager,prepare,viewCamera,viewWhole,cameras:cameras.map(c=>({...c})),get state(){return manager.state},get stats(){return manager.stats}};
prepare();
})();
