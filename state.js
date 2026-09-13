// Keep these legacy identifiers so existing collections and backups remain compatible.
export const STORAGE_KEY = 'rosteriklassikern.collection.v1';
export const FORMAT = 'rosteriklassikern-collection';
export const MILESTONES = [10,20,50];
export const blankRecord = () => ({tasted:false,wantToTry:false,firstTasted:null,note:'',addedAt:null,updatedAt:null});
export const emptyCollection = () => ({format:FORMAT,version:1,records:{},catalogSnapshot:null});
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(id) && !['__proto__','constructor','prototype'].includes(id);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validDate(value) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === value;
}
function timestamp(value) {
  if(value==null) return null;
  if(typeof value!=='string' || value.length>40 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('A record contains an invalid timestamp.');
  return value;
}
export function validateCollection(input,legacyIds={}) {
  if(!plainObject(input) || input.format!==FORMAT || input.version!==1 || !plainObject(input.records)) throw Error('Choose a Kaffeklassikern collection backup (format version 1).');
  const entries = Object.entries(input.records);
  if(entries.length>10000) throw Error('This backup contains too many records (maximum 10,000).');
  const records = {};
  for(const [oldId,r] of entries) {
    const id = Object.hasOwn(legacyIds,oldId) ? legacyIds[oldId] : oldId;
    if(!safeId(id) || !plainObject(r) || typeof r.tasted!=='boolean' || typeof r.wantToTry!=='boolean' || typeof r.note!=='string' || r.note.length>5000) throw Error('A collection record has invalid fields. Your existing collection has not changed.');
    if(r.firstTasted!=null && !validDate(r.firstTasted)) throw Error('A first-tasted date is invalid. Use YYYY-MM-DD.');
    if(r.name!=null && (typeof r.name!=='string' || r.name.length>250)) throw Error('A roaster name is invalid.');
    const clean = {tasted:r.tasted,wantToTry:r.tasted?false:r.wantToTry,firstTasted:r.firstTasted||null,note:r.note,addedAt:timestamp(r.addedAt),updatedAt:timestamp(r.updatedAt),...(r.name?{name:r.name}:{})};
    records[id] = records[id] ? mergeRecord(records[id],clean) : clean;
  }
  let catalogSnapshot=null;
  if(plainObject(input.catalogSnapshot)) {
    catalogSnapshot={};
    for(const [id,region] of Object.entries(input.catalogSnapshot)) {
      if(!safeId(id) || !safeId(region)) throw Error('Invalid catalogue snapshot.');
      catalogSnapshot[id]=region;
    }
  }
  return {format:FORMAT,version:1,records,catalogSnapshot};
}
export function parseBackup(text,legacyIds={}) {
  if(text.length>5_000_000) throw Error('The backup is too large. Choose a JSON file smaller than 5 MB.');
  let input;
  try {input=JSON.parse(text.replace(/^\uFEFF/,''));} catch {throw Error('This file is not valid JSON. Choose an exported collection backup.');}
  return validateCollection(input,legacyIds);
}
export function mergeRecord(existing,incoming) {
  const tasted=existing.tasted || incoming.tasted;
  const added = [existing.addedAt,incoming.addedAt].filter(Boolean).sort();
  const updated = [existing.updatedAt,incoming.updatedAt].filter(Boolean).sort();
  return {...incoming,...existing,tasted,wantToTry:!tasted&&(existing.wantToTry||incoming.wantToTry),note:existing.note||incoming.note,firstTasted:existing.firstTasted||incoming.firstTasted,addedAt:added[0]||null,updatedAt:updated.at(-1)||null};
}
export function mergeCollections(existing,incoming) {
  const records={...existing.records};
  for(const [id,record] of Object.entries(incoming.records)) records[id]=records[id]?mergeRecord(records[id],record):{...record};
  return {...existing,records};
}
export function setTasted(collection,id,tasted,now=new Date().toISOString()) {
  const previous=collection.records[id]||blankRecord();
  return {...collection,records:{...collection.records,[id]:{...previous,tasted,wantToTry:tasted?false:previous.wantToTry,addedAt:tasted&&!previous.tasted?now:previous.addedAt,updatedAt:now}}};
}
export function setSaved(collection,id,saved,now=new Date().toISOString()) {
  const previous=collection.records[id]||blankRecord();
  return {...collection,records:{...collection.records,[id]:{...previous,wantToTry:!previous.tasted&&saved,updatedAt:now}}};
}
export function deriveProgress(catalog,collection) {
  const active=catalog.roasters.filter(r=>r.active);
  const tasted=active.filter(r=>collection.records[r.id]?.tasted).length;
  const retiredTasted=catalog.roasters.filter(r=>!r.active&&collection.records[r.id]?.tasted).length;
  const lifetime=tasted+retiredTasted;
  const regions=catalog.regions.map(region=>{
    const roasters=active.filter(r=>r.regionId===region.id);
    const count=roasters.filter(r=>collection.records[r.id]?.tasted).length;
    return {...region,total:roasters.length,tasted:count,complete:roasters.length>0&&count===roasters.length};
  });
  const represented=regions.filter(r=>r.total>0);
  return {total:active.length,tasted,retiredTasted,lifetime,saved:active.filter(r=>collection.records[r.id]?.wantToTry&&!collection.records[r.id]?.tasted).length,percent:active.length?Math.round(tasted/active.length*100):0,regions,represented:represented.length,completedRegions:represented.filter(r=>r.complete).length,complete:active.length>0&&tasted===active.length,nextMilestone:MILESTONES.find(n=>lifetime<n)||null};
}
export function filteredRoasters(catalog,collection,filters) {
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const query=normalize((filters.search||'').trim());
  return catalog.roasters.filter(r=>r.active && (!filters.region||r.regionId===filters.region) && (!query||normalize(r.name+' '+r.town).includes(query)) && (filters.tab!=='tasted'||collection.records[r.id]?.tasted) && (filters.tab!=='saved'||collection.records[r.id]?.wantToTry) && (!filters.notTasted||!collection.records[r.id]?.tasted)).sort((a,b)=>{
    if(filters.sort==='recent'&&filters.tab==='tasted') {
      const diff=(collection.records[b.id]?.addedAt?Date.parse(collection.records[b.id].addedAt):0)-(collection.records[a.id]?.addedAt?Date.parse(collection.records[a.id].addedAt):0);
      if(diff) return diff;
    }
    return a.name.localeCompare(b.name,'sv');
  });
}
export function pickRoaster(catalog,collection,region='',previousId=null,random=Math.random) {
  let candidates=catalog.roasters.filter(r=>r.active&&!collection.records[r.id]?.tasted&&(!region||r.regionId===region));
  if(candidates.length>1) candidates=candidates.filter(r=>r.id!==previousId);
  return candidates.length?candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]:null;
}
export function exportCollection(catalog,collection,now=new Date().toISOString()) {
  const names=new Map(catalog.roasters.map(r=>[r.id,r.name]));
  return {...collection,exportedAt:now,description:'Your private Kaffeklassikern collection. Includes personal notes and optional tasting dates.',records:Object.fromEntries(Object.entries(collection.records).map(([id,r])=>[id,{...r,name:names.get(id)||r.name||id}]))};
}
export function importPreview(catalog,collection) {
  const known=new Set(catalog.roasters.map(r=>r.id));
  const entries=Object.entries(collection.records);
  return {records:entries.length,tasted:entries.filter(([,r])=>r.tasted).length,saved:entries.filter(([,r])=>r.wantToTry).length,unmatched:entries.filter(([id])=>!known.has(id)).length};
}
export function snapshot(catalog) {return Object.fromEntries(catalog.roasters.filter(r=>r.active).map(r=>[r.id,r.regionId]));}
export function catalogChanges(catalog,collection) {
  if(!collection.catalogSnapshot) return [];
  const changed = catalog.roasters.filter(r=>r.active && collection.catalogSnapshot[r.id]!==r.regionId && !collection.records[r.id]?.tasted);
  return [...new Set(changed.map(r=>r.regionId))].map(id=>catalog.regions.find(r=>r.id===id)?.name).filter(Boolean);
}
