import './contact.js';
import {STORAGE_KEY,MILESTONES,blankRecord,emptyCollection,parseBackup,validateCollection,setTasted,setSaved,deriveProgress,filteredRoasters,pickRoaster,exportCollection,importPreview,snapshot,catalogChanges,validDate} from './state.js';
import {readCollection,writeCollection} from './storage.js';
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const externalUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?escape(u.href):'';}catch{return '';}};
let catalog,collection=emptyCollection(),progress,saveFailed=false,storageBlocked=false,detailId=null,discovery=false,previousPick=null,undoAction=null;
let filters={tab:'all',search:'',region:'',notTasted:false,sort:'alpha',view:'cards'};
let toastTimer;
const dialogFocus = new WeakMap();
const regionName=id=>catalog.regions.find(r=>r.id===id)?.name||'';
const bookmarkIcon=filled=>`<svg viewBox="0 0 20 22" aria-hidden="true" fill="${filled?'currentColor':'none'}" stroke="currentColor" stroke-width="1.5"><path d="M4 2h12v18l-6-4-6 4z"/></svg>`;
const track=(count,total,className='')=>`<div class="progress-track ${className}" role="progressbar" aria-label="${escape(className?'Regions completed':'Collection progress')}" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${total||1}" aria-valuetext="${count} of ${total}"><span style="width:${total?Math.min(count/total*100,100):0}%"></span></div>`;
function photo(roaster){
  if(roaster.image?.src) return `<img class="roaster-photo" src="${escape(roaster.image.src)}" alt="${escape(roaster.image.alt)}" loading="lazy" decoding="async" width="640" height="480" style="object-fit:${roaster.image.fit==='cover'?'cover':'contain'};object-position:${escape(roaster.image.focalPoint||'50% 50%')}">`;
  return `<div class="photo-fallback" aria-label="${escape(roaster.name)} — photograph not available"><strong>${escape(roaster.name)}</strong><small>${escape(roaster.town)}</small></div>`;
}
function actionButtons(r,detail=false){
  const state=collection.records[r.id]||blankRecord();
  return `<button class="taste-button" data-action="taste" data-id="${r.id}" aria-pressed="${state.tasted}" aria-label="${state.tasted?'Remove tasting for':'Mark as tasted:'} ${escape(r.name)}">${state.tasted?'✓ Tasted':'＋ Mark as tasted'}</button><button class="bookmark" data-action="save" data-id="${r.id}" aria-pressed="${state.wantToTry}" ${state.tasted?'disabled':''} aria-label="${state.wantToTry?'Remove from want to try:':'Want to try:'} ${escape(r.name)}" title="${state.tasted?'Already tasted':state.wantToTry?'Saved to Want to try':'Want to try'}">${bookmarkIcon(state.wantToTry)}${detail?' '+(state.wantToTry?'Saved':'Want to try'):''}</button>`;
}
function card(r){
  const tasted=collection.records[r.id]?.tasted;
  return `<article class="roaster-card ${tasted?'is-tasted':''}" data-roaster="${r.id}"><button class="photo-button" data-action="detail" data-id="${r.id}" aria-label="View ${escape(r.name)}">${photo(r)}${tasted?'<span class="tasted-overlay">✓ Tasted</span>':''}</button><div class="card-body"><a href="#roaster-${r.id}" class="card-title" data-action="detail" data-id="${r.id}">${escape(r.name)}</a><p class="card-town">${escape(r.town)} <span aria-hidden="true">·</span> ${escape(regionName(r.regionId))}</p><div class="card-actions">${actionButtons(r)}</div></div></article>`;
}
function persist(){
  if(storageBlocked){saveFailed=true;renderSave();return false;}
  saveFailed=!writeCollection(()=>localStorage,collection);
  renderSave();return !saveFailed;
}
function renderSave(){
  $('#save-status').textContent=saveFailed?'Changes could not be saved':'Saved in this browser';
  const warning=$('#storage-warning');warning.hidden=!saveFailed;
  if(saveFailed) warning.innerHTML=`${storageBlocked?'The saved collection could not be read. It has been left untouched. Your current session is temporary.':'Changes could not be saved. Your current collection is still available in this session.'} <button class="text-button" data-action="export">Export a backup</button> <button class="text-button" data-action="manage">Manage collection</button>`;
}
function renderOverview(){
  const p=progress;
  $('#overview-progress').innerHTML=`<div class="progress-top"><div><div class="big-count">${p.tasted}<span>/ ${p.total}</span></div><p class="progress-caption">roasters tasted</p></div><span class="percentage">${p.percent}% of the collection</span></div>${track(p.tasted,p.total)}<div class="next-copy">${p.complete?`<strong>✓ Collection complete · All regions complete</strong>`:p.nextMilestone?`<strong>Next milestone: ${p.nextMilestone}</strong><span>${p.nextMilestone-p.lifetime} more roasters to go</span>`:`<strong>Complete the collection</strong><span>${p.total-p.tasted} roasters to go</span>`}</div>${p.retiredTasted?`<p class="subtle">${p.retiredTasted} retired roasters also tasted · ${p.lifetime} lifetime tastings</p>`:''}${!p.lifetime?'<p class="subtle">Already tried a few? Mark them as tasted to start your collection.</p>':''}${p.complete?`<p class="subtle">${reviewText()}</p>`:''}`;
  $('#milestone-badges').innerHTML=MILESTONES.map(n=>`<div class="milestone ${p.lifetime>=n?'earned':p.nextMilestone===n?'next':''}" data-milestone="${n}"><div class="emblem" aria-hidden="true"><img src="./assets/wreath.webp" alt=""><b>${n}</b></div><div class="milestone-text"><h3>${n} roasters tasted</h3><p>${p.lifetime>=n?'✓ Earned':`${p.lifetime} of ${n}${p.nextMilestone===n?' · Up next':''}`}</p></div></div>`).join('');
  $('#regional-total').innerHTML=`<span class="region-symbol" aria-hidden="true">${p.complete?'✦':'◇'}</span><div class="region-total-copy"><strong>${p.completedRegions} / ${p.represented}</strong><span>${p.complete?'All regions complete':'Regions completed'}</span></div>${track(p.completedRegions,p.represented,'mini-track')}`;
  $('#regional-badges').innerHTML=p.regions.filter(r=>r.total).sort((a,b)=>a.name.localeCompare(b.name,'sv')).map(r=>`<button class="region-badge ${r.complete?'complete':''}" data-action="region" data-id="${r.id}" aria-label="${escape(r.name)}: ${r.tasted} of ${r.total} roasters tasted. ${r.complete?'Complete':r.tasted?'In progress':'Not started'}. Filter collection."><span class="region-seal" aria-hidden="true">${r.complete?'✓':r.tasted?'◐':'○'}</span><span><strong>${escape(r.name)}</strong><small>${r.tasted} of ${r.total} roasters tasted${r.complete?' · Complete':''}</small></span></button>`).join('');
  $('#catalog-count').textContent=`${p.total} roasters`;
  $('#collection-tabs').innerHTML=[['all','All',p.total],['tasted','Tasted',p.tasted],['saved','Want to try',p.saved]].map(([id,label,count])=>`<button data-action="tab" data-value="${id}" class="${filters.tab===id?'active':''}" aria-pressed="${filters.tab===id}">${label}<span class="count-pill">${count}</span></button>`).join('');
}
function reviewText(){return catalog.reviewedAt?`Roaster catalogue updated ${new Date(catalog.reviewedAt+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`:'Baseline prepared 11 Sep 2026 · Review pending';}
function renderCollection(){
  const matching=filteredRoasters(catalog,collection,filters);
  $('#results-count').textContent=`${matching.length} matching ${matching.length===1?'roaster':'roasters'}${filters.region?' in '+regionName(filters.region):''}`;
  $('#clear-filters').hidden=!(filters.search||filters.region||filters.notTasted||filters.tab!=='all');
  $('#sort-label').hidden=filters.tab!=='tasted';
  document.querySelectorAll('[data-action="view"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===filters.view)));
  const region=progress.regions.find(r=>r.id===filters.region);
  let regionalInfo=region?`<div class="notice">${escape(region.name)} · ${region.total?`${region.tasted} of ${region.total} roasters tasted${region.complete?' · Region complete — you’ve tasted every listed roaster here':''}`:'No roasters listed'}</div>`:'';
  let content;
  if(filters.view==='map') content=renderMap(matching);
  else if(matching.length) content=`<div class="cards">${matching.map(card).join('')}</div>`;
  else{
    const title=filters.tab==='tasted'&&!progress.tasted?'Your collection starts with your first roaster.':filters.tab==='saved'&&!progress.saved?'Save roasters you want to try next.':region?.complete&&filters.notTasted?'Region complete.':'No roasters match your filters.';
    content=`<div class="empty"><h3>${title}</h3><p>${region?.total===0?'No roasters are currently listed in this county.':'Explore the collection to find your next tasting.'}</p><button data-action="clear-filters">Explore all roasters</button></div>`;
  }
  $('#collection-content').innerHTML=regionalInfo+content;
  const retired=catalog.roasters.filter(r=>!r.active&&collection.records[r.id]);
  $('#retired-content').innerHTML=retired.length?`<details class="retired"><summary>Retired roasters · ${retired.length} recorded</summary><p class="subtle">Tastings still count toward your lifetime milestones.</p><div class="cards">${retired.map(card).join('')}</div></details>`:'';
}
function renderAll(){progress=deriveProgress(catalog,collection);renderOverview();renderCollection();
  for(const button of document.querySelectorAll('#utility-content .map-list-row [data-action="taste"]')){
    const r=catalog.roasters.find(r=>r.id===button.dataset.id);const tasted=!!collection.records[r.id]?.tasted;
    button.textContent=tasted?'✓ Tasted':'＋ Taste';button.setAttribute('aria-pressed',String(tasted));button.setAttribute('aria-label',`${tasted?'Remove tasting for':'Mark as tasted:'} ${r.name}`);
  }
}
function notify(message,undo=null){
  clearTimeout(toastTimer);undoAction=undo;
  // Keep Undo operable inside the modal top layer instead of in the inert page.
  (document.querySelector('dialog[open]')||document.body).append($('#toast'));
  $('#toast').innerHTML=`<span>${escape(message)}</span>${undo?'<button data-action="undo">Undo</button>':''}<button data-action="dismiss-toast" aria-label="Dismiss notification">×</button>`;
  $('#toast').hidden=false;
  // Undo stays available until dismissed or replaced; it never vanishes on a timer.
  if(!undo) toastTimer=setTimeout(()=>{$('#toast').hidden=true;},10000);
}
function captureFocus(){const el=document.activeElement;return el?.dataset.action?{action:el.dataset.action,id:el.dataset.id,value:el.dataset.value}:null;}
function restoreFocus(focus){if(!focus)return;const scope=document.querySelector('dialog[open]')||document;const matches=[...scope.querySelectorAll('[data-action]')];const target=matches.find(el=>el.dataset.action===focus.action&&el.dataset.id===focus.id&&el.dataset.value===focus.value&&el.getClientRects().length&&!el.disabled);if(target)target.focus({preventScroll:true});else if(scope!==document)scope.querySelector('.close-button')?.focus({preventScroll:true});else $('#collection-title').focus({preventScroll:true});}
function updateTasting(id,desired){
  const r=catalog.roasters.find(r=>r.id===id);if(!r)return;
  const before=collection.records[id]?{...collection.records[id]}:null;
  const oldProgress=progress;const focus=captureFocus();
  collection=setTasted(collection,id,desired??!before?.tasted);persist();renderAll();
  if(detailId===id) renderDetail();
  restoreFocus(focus);
  const tasted=collection.records[id].tasted;
  const earned=MILESTONES.filter(n=>oldProgress.lifetime<n&&progress.lifetime>=n);
  const region=progress.regions.find(region=>region.id===r.regionId);
  const regionEarned=region?.complete&&!oldProgress.regions.find(region=>region.id===r.regionId)?.complete;
  let message=tasted?'Added to your collection':'Tasting removed';
  if(progress.complete&&!oldProgress.complete) message+=' · Collection complete · All regions complete';
  else{if(earned.length) message+=` · Milestone reached: ${earned.at(-1)} roasters tasted`;if(regionEarned)message+=` · Region complete: ${region.name}`;}
  if(!filteredRoasters(catalog,collection,filters).some(x=>x.id===id))message+=' · Hidden by your current filters';
  notify(message,()=>{const records={...collection.records};const current=records[id];if(before)records[id]={...current,tasted:before.tasted,wantToTry:before.wantToTry,addedAt:before.addedAt};else if(current?.note||current?.firstTasted)records[id]={...current,tasted:false,wantToTry:false,addedAt:null};else delete records[id];collection={...collection,records};persist();renderAll();if(detailId===id)renderDetail();notify('Change undone');});
  earned.forEach(n=>document.querySelector(`[data-milestone="${n}"]`)?.classList.add('celebrate'));
}
function toggleSaved(id){const r=catalog.roasters.find(r=>r.id===id);if(!r||collection.records[id]?.tasted)return;const focus=captureFocus();collection=setSaved(collection,id,!collection.records[id]?.wantToTry);persist();renderAll();if(detailId===id)renderDetail();restoreFocus(focus);notify(collection.records[id].wantToTry?'Saved to Want to try':'Removed from Want to try');}
function applyFilters(){renderOverview();renderCollection();}
function clearFilters(){filters={...filters,search:'',region:'',tab:'all',notTasted:false,sort:'alpha'};$('#search').value='';$('#region').value='';$('#not-tasted').checked=false;$('#sort').value='alpha';applyFilters();}
function renderMap(matching){
  const groups=[];
  for(const roaster of matching){
    let group=groups.find(g=>Math.hypot(g.x-roaster.x,g.y-roaster.y)<48);
    if(!group){group={x:roaster.x,y:roaster.y,roasters:[]};groups.push(group);}
    group.roasters.push(roaster);
  }
  const shapes=progress.regions.map(r=>`<path class="county ${r.complete?'complete':''} ${filters.region===r.id?'selected':''}" d="${r.path}" role="button" tabindex="0" data-action="region" data-id="${r.id}" aria-label="${escape(r.name)}: ${r.total?`${r.tasted} of ${r.total} tasted${r.complete?', complete':''}`:'No roasters listed'}. Filter to this county."><title>${escape(r.name)} · ${r.total?`${r.tasted} / ${r.total}`:'No roasters listed'}</title></path>`).join('');
  const markers=groups.map(g=>{
    const multiple=g.roasters.length>1;const r=g.roasters[0];const allTasted=g.roasters.every(r=>collection.records[r.id]?.tasted);
    return `<g role="button" tabindex="0" data-action="${multiple?'cluster':'detail'}" data-id="${g.roasters.map(r=>r.id).join(',')}" aria-label="${multiple?`${g.roasters.length} roasters near ${escape(r.town)}. Show list.`:`View ${escape(r.name)}`}" class="map-marker"><circle class="marker ${allTasted?'tasted':''}" cx="${g.x}" cy="${g.y}" r="${multiple?23:14}"/>${multiple?`<text x="${g.x}" y="${g.y+8}" text-anchor="middle" font-size="24" font-weight="600" fill="white" pointer-events="none">${g.roasters.length}</text>`:''}<title>${g.roasters.map(r=>escape(r.name)).join(', ')}</title></g>`;
  }).join('');
  return `<div class="map-layout"><div class="map-surface"><svg class="sweden-map" viewBox="-45 -30 ${catalog.viewBox[2]+90} ${catalog.viewBox[3]+60}" aria-label="Map of Sweden. Select a county or roaster. An equivalent list follows.">${shapes}${markers}</svg><div class="map-legend"><span>● Not tasted</span><span style="color:var(--green)">● Tasted</span><span>Numbered markers group nearby roasters</span></div><p class="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · <a href="https://github.com/okfse/sweden-geojson" target="_blank" rel="noopener noreferrer">County shapes</a></p></div><div class="map-list"><p class="map-heading">${matching.length} matching roasters<br><span class="subtle">The same collection, with a different view.</span></p>${matching.length?matching.map(mapRow).join(''):'<div class="empty"><h3>No matching roasters</h3><button data-action="clear-filters">Explore all regions</button></div>'}</div></div>`;
}
function mapRow(r){return `<div class="map-list-row"><div><a class="card-title" href="#roaster-${r.id}" data-action="detail" data-id="${r.id}">${escape(r.name)}</a><p class="card-town">${escape(r.town)}</p></div><button class="taste-button" data-action="taste" data-id="${r.id}" aria-label="${collection.records[r.id]?.tasted?'Remove tasting for':'Mark as tasted:'} ${escape(r.name)}" aria-pressed="${!!collection.records[r.id]?.tasted}">${collection.records[r.id]?.tasted?'✓ Tasted':'＋ Taste'}</button></div>`;}
function renderDetail(){
  const r=catalog.roasters.find(r=>r.id===detailId);if(!r)return;
  const record=collection.records[r.id]||blankRecord();
  $('#detail-content').innerHTML=`<div class="detail-photo">${photo(r)}</div><div class="detail-inner">${discovery?'<p class="discovery-label">YOUR RANDOM PICK</p>':''}<h2 id="detail-title">${escape(r.name)}</h2><p class="detail-location">${escape(r.town)} · ${escape(regionName(r.regionId))}${!r.active?' · Retired from the active catalogue':''}</p>${discovery?'<div class="discovery-action"><button data-action="discover">Pick another ⤨</button></div>':''}<p class="detail-description">${escape(r.description)}</p><div class="detail-links">${r.active&&externalUrl(r.webshop)?`<a class="shop-link" href="${externalUrl(r.webshop)}" target="_blank" rel="noopener noreferrer">${r.linkKind==='homepage'?'Visit website':'Visit webshop'} ↗</a>`:''}${r.active&&externalUrl(r.instagram)?`<a href="${externalUrl(r.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>`:''}</div><div class="detail-actions">${actionButtons(r,true)}</div><div class="tasting-fields"><label><span class="field-label">First tasted <span>· optional</span></span><input id="first-tasted" type="date" value="${escape(record.firstTasted||'')}" aria-describedby="date-help"></label><p id="date-help" class="subtle">Past tastings count. Leave this blank if you don’t remember.</p><label><span class="field-label">Your note <span>· optional, private to your browser</span></span><textarea id="tasting-note" maxlength="5000" placeholder="A coffee you loved, or something to remember…">${escape(record.note)}</textarea></label><p id="note-status" class="subtle" aria-live="polite">${record.note.length} / 5,000 characters · Changes save as you type</p><button class="text-button" data-action="delete-details">Delete note and date</button></div>${r.image&&r.image.origin!=='project-supplied'?`<p class="subtle photo-credit">Photo: ${escape(r.image.attribution)}${r.image.sourcePage?` · <a href="${externalUrl(r.image.sourcePage)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}${r.image.termsUrl?` · <a href="${externalUrl(r.image.termsUrl)}" target="_blank" rel="noopener noreferrer">Licence ↗</a>`:''}. ${escape(r.image.caption||'')}</p>`:''}${r.active?`<p class="subtle"><a href="${externalUrl(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">About this roaster · source ↗</a></p>`:''}${catalog.issueUrl?`<a class="subtle" href="${externalUrl(catalog.issueUrl)}" target="_blank" rel="noopener noreferrer">Report an outdated link ↗</a>`:''}</div>`;
  $('#tasting-note').addEventListener('input',e=>saveDetails('note',e.target.value));
  $('#first-tasted').addEventListener('change',e=>{
    if(e.target.value&&!validDate(e.target.value)){e.target.setCustomValidity('Choose a valid date, or leave it blank.');e.target.reportValidity();return;}
    e.target.setCustomValidity('');saveDetails('firstTasted',e.target.value||null);
  });
}
function saveDetails(field,value){
  if(!detailId)return;
  const record=collection.records[detailId]||blankRecord();
  collection={...collection,records:{...collection.records,[detailId]:{...record,[field]:value,updatedAt:new Date().toISOString()}}};
  persist();$('#note-status').textContent=`${collection.records[detailId].note.length} / 5,000 characters · ${saveFailed?'Changes could not be saved':'Saved in this browser'}`;
}
function openDetail(id,isDiscovery=false){
  if(!catalog.roasters.some(r=>r.id===id))return;
  if($('#utility-dialog').open)closeDialog($('#utility-dialog'));
  detailId=id;discovery=isDiscovery;renderDetail();showDialog($('#detail-dialog'));$('#detail-dialog').scrollTop=0;
}
function openUtility(title,content){$('#utility-content').innerHTML=`<h2 id="utility-title">${escape(title)}</h2>${content}`;showDialog($('#utility-dialog'));}
function showDialog(dialog){if(!dialog.open){dialogFocus.set(dialog,document.activeElement);dialog.showModal();}}
function closeDialog(dialog){dialog.close();if(dialog.id==='detail-dialog')detailId=null;}
function returnFocus(dialog){const focusReturn=dialogFocus.get(dialog);if(focusReturn?.isConnected&&focusReturn.getClientRects().length)focusReturn.focus({preventScroll:true});else if(focusReturn?.dataset.action)restoreFocus({action:focusReturn.dataset.action,id:focusReturn.dataset.id,value:focusReturn.dataset.value});else $('#collection-title').focus({preventScroll:true});}
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('cancel',()=>{if(dialog.id==='detail-dialog')detailId=null;});
  dialog.addEventListener('close',()=>{document.body.append($('#toast'));returnFocus(dialog);});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});
}
function discover(){
  const r=pickRoaster(catalog,collection,filters.region,previousPick);
  if(r){previousPick=r.id;openDetail(r.id,true);return;}
  const region=progress.regions.find(r=>r.id===filters.region);
  if($('#detail-dialog').open)closeDialog($('#detail-dialog'));
  openUtility(progress.complete?'Collection complete':region?.total===0?'No roasters listed':'Region complete',`<p>${progress.complete?'You’ve tasted every current roaster. All regions complete.':region?.total===0?'No roasters are currently listed in this county.':`You’ve tasted every listed roaster in ${escape(region?.name||'the collection')}.`}</p><p>${reviewText()}</p><button data-action="explore-all">Explore all regions</button>`);
}
function manageCollection(){
  const unmatched=importPreview(catalog,collection).unmatched;
  openUtility('Your collection',`<p>Your collection is saved in this browser, on this website address. It does not sync across browsers or devices. Clearing site data or using private browsing can remove it.</p><p>A JSON backup includes your <strong>private notes and tasting dates</strong>. Keep it somewhere safe.</p>${unmatched?`<p>${unmatched} unmatched records are preserved in your backup. They do not count toward milestones until matched to the catalogue.</p>`:''}<div class="utility-actions"><button class="primary" data-action="export">Export collection</button></div>${storageBlocked?'<p class="notice warning">The existing saved data could not be read. Export your current session before clearing the saved collection.</p><button data-action="export-raw">Download unreadable saved data</button>':''}<div class="management-danger"><h3>Start again</h3><p>Clear all tasting states, saved roasters, notes, dates, and unmatched records in this browser.</p><button class="danger" data-action="confirm-clear">Clear collection…</button></div>`);
}
function about(){openUtility('Made for the love of coffee.',`<p>Kaffeklassikern is a small, independent hobby project, brewed out of curiosity and a love for coffee. It helps people discover Sweden’s roasteries, remember the coffees they’ve tried, and find their next favourite.</p><p>We put this collection together in good faith, to celebrate the people behind the coffee. Names, logos and photographs belong to their respective owners. If you spot a mistake, recognise something you’d prefer us not to use, or simply have a better idea, please tell us. We’ll review it and work to put it right.</p><p><strong>Not affiliated with or endorsed by the roasteries listed.</strong></p><div class="utility-actions"><button class="primary" data-action="contact">Get in touch</button></div><h3>A collection at your pace</h3><p>Past tastings count, including coffees enjoyed in cafés. There’s no proof to upload and no purchase required. Earn milestones at 10, 20 and 50 roasters, or complete a region by tasting every listed roaster there.</p><p>${catalog.roasters.filter(r=>r.active).length} roasters · ${progress.represented} represented regions. The catalogue is a work in progress; listings and links can change.</p><h3>A little privacy, too</h3><p>No accounts, analytics or advertising trackers. Your collection and notes stay in this browser. Contact messages are sent only when you choose to send them.</p><button class="text-button" data-action="privacy">Read the privacy note</button><h3>Thanks to the map makers</h3><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. Roastery coordinates were obtained through Nominatim and use OpenStreetMap data under the <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. County shapes come from <a href="https://github.com/okfse/sweden-geojson" target="_blank" rel="noopener noreferrer">okfse/sweden-geojson</a>. <a href="./data/map-attribution.json" target="_blank">Map source details</a>.</p>${catalog.githubUrl?`<p><a href="${externalUrl(catalog.githubUrl)}" target="_blank" rel="noopener noreferrer">View the project on GitHub ↗</a></p>`:''}`);}
function privacy(){openUtility('Your coffee, your collection.',`<p>We do not use analytics, advertising trackers or accounts. Tastings, saved roasters, dates and notes are stored in this browser on this website address. They are not sent to us. Clearing browser storage removes them; exporting creates a file on your device.</p><p>If you use Contact, your reply email and note are sent through Formspree for delivery and spam filtering, then kept in the project inbox to handle your request. No collection data is attached. Contact drafts stay in this page’s memory until you reload or close the browser tab.</p><p>The website host and contact provider may process connection details such as IP addresses in their operational or security logs. We do not use those to analyse your coffee activity.</p><p>Roastery and source links take you to external websites with their own privacy practices. To ask about a message you’ve sent or request its deletion, use the contact form.</p><button class="primary" data-action="contact">Contact us</button>`);}
function exportBackup(){const blob=new Blob([JSON.stringify(exportCollection(catalog,collection),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`kaffeklassikern-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup exported, including your private notes and dates.');}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||!catalog)return;
  const {action,id,value}=button.dataset;
  if(action==='detail'){event.preventDefault();openDetail(id);}
  else if(action==='taste')updateTasting(id);
  else if(action==='save')toggleSaved(id);
  else if(action==='tab'){filters.tab=value;if(value==='tasted'){filters.notTasted=false;$('#not-tasted').checked=false;}applyFilters();}
  else if(action==='view'){filters.view=value;renderCollection();}
  else if(action==='regions'){const hidden=$('#regional-badges').hidden;$('#regional-badges').hidden=!hidden;button.setAttribute('aria-expanded',String(hidden));button.innerHTML=hidden?'Hide regions <span aria-hidden="true">−</span>':'View all regions <span aria-hidden="true">↗</span>';}
  else if(action==='region'){filters.region=id;filters.tab='all';filters.search='';$('#region').value=id;$('#search').value='';applyFilters();$('#collection').scrollIntoView();}
  else if(action==='cluster'){const ids=id.split(',');const items=catalog.roasters.filter(r=>ids.includes(r.id));openUtility(`${items.length} nearby roasters`,items.map(mapRow).join(''));}
  else if(action==='clear-filters')clearFilters();
  else if(action==='export')exportBackup();
  else if(action==='undo'){const undo=undoAction;undoAction=null;undo?.();}
  else if(action==='dismiss-toast'){$('#toast').hidden=true;undoAction=null;}
  else if(action==='close')closeDialog(button.closest('dialog'));
  else if(action==='discover')discover();
  else if(action==='explore-all'){closeDialog(button.closest('dialog'));clearFilters();$('#collection').scrollIntoView();}
  else if(action==='about')about();
  else if(action==='privacy')privacy();
  else if(action==='contact')showDialog($('#contact-dialog'));
  else if(action==='manage')manageCollection();
  else if(action==='delete-details'){const id=detailId;const before={...(collection.records[id]||blankRecord())};saveDetails('note','');saveDetails('firstTasted',null);renderDetail();notify('Note and date deleted.',()=>{collection.records[id]={...(collection.records[id]||blankRecord()),note:before.note,firstTasted:before.firstTasted};persist();if(detailId===id)renderDetail();notify('Note and date restored');});}
  else if(action==='confirm-clear')openUtility('Clear your collection?',`<p>All tastings, saved roasters, notes, dates, and unmatched records will be removed from this browser. Export a backup first if you want to keep them.</p><div class="utility-actions"><button data-action="export">Export a backup</button><button class="danger" data-action="clear-collection">Yes, clear my collection</button><button data-action="close">Cancel</button></div>`);
  else if(action==='clear-collection'){
    const prior=collection;collection=emptyCollection();collection.catalogSnapshot=snapshot(catalog);storageBlocked=false;persist();renderAll();closeDialog($('#utility-dialog'));notify('Collection cleared.',()=>{collection=prior;persist();renderAll();notify('Collection restored');});
  }
  else if(action==='export-raw'){
    try{const raw=localStorage.getItem(STORAGE_KEY)||'';const blob=new Blob([raw],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kaffeklassikern-storage-recovery.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{notify('Browser storage could not be read. Export the current session instead.');}
  }
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('svg [role="button"]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
$('#search').addEventListener('input',e=>{filters.search=e.target.value;renderCollection();});
$('#region').addEventListener('change',e=>{filters.region=e.target.value;applyFilters();});
$('#not-tasted').addEventListener('change',e=>{filters.notTasted=e.target.checked;applyFilters();});
$('#sort').addEventListener('change',e=>{filters.sort=e.target.value;renderCollection();});
document.addEventListener('error',e=>{if(e.target.classList?.contains('roaster-photo')){const fallback=document.createElement('div');fallback.className='photo-fallback';fallback.textContent='Photograph unavailable';e.target.replaceWith(fallback);}},true);
async function init(){
  try{
    const response=await fetch(new URL('./data/catalog.json',import.meta.url));if(!response.ok)throw Error('Catalogue unavailable');catalog=await response.json();
    const loaded=readCollection(()=>localStorage,catalog.legacyIds);collection=loaded.collection;saveFailed=loaded.failed;storageBlocked=loaded.blocked;
    const changes=catalogChanges(catalog,collection);if(changes.length){$('#catalog-notice').hidden=false;$('#catalog-notice').textContent=`A new roaster to discover in ${changes.join(', ')}. Regional progress reflects the current catalogue; your tasting history is preserved.`;}
    collection.catalogSnapshot=snapshot(catalog);persist();
    $('#region').innerHTML='<option value="">All regions</option>'+catalog.regions.toSorted((a,b)=>a.name.localeCompare(b.name,'sv')).map(r=>`<option value="${r.id}">${escape(r.name)}</option>`).join('');
    $('#review-date').textContent=reviewText();$('#collection-title').tabIndex=-1;
    renderAll();registerAgentTools();
  }catch(error){$('#collection-content').innerHTML='<div class="empty"><h3>The collection could not load.</h3><p>Please refresh the page. Existing saved tastings have not been changed.</p><button onclick="location.reload()">Try again</button></div>';$('#save-status').textContent='Collection unavailable';console.error(error);}
}
window.addEventListener('storage',e=>{
  if(e.key!==STORAGE_KEY||!catalog)return;
  if(saveFailed){notify('Another tab changed the collection. Export this unsaved session before reloading.');return;}
  try{collection=e.newValue?parseBackup(e.newValue,catalog.legacyIds):emptyCollection();collection.catalogSnapshot=snapshot(catalog);renderAll();if(detailId)renderDetail();notify('Collection updated from another tab.');}catch{notify('Another tab saved an unreadable collection. This session has been preserved.');}
});
init();
function registerAgentTools(){
  const context=document.modelContext;if(!context?.registerTool)return;
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const definitions=[{
    name:'read_roaster_collection',title:'Read roaster collection',description:'Read catalogue IDs, roaster names, tasting and saved states, and derived progress. Personal notes are not returned.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},
    execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Provide an empty object.');return {tasted:progress.tasted,total:progress.total,completedRegions:progress.completedRegions,representedRegions:progress.represented,roasters:catalog.roasters.map(r=>({id:r.id,name:r.name,region:regionName(r.regionId),active:r.active,tasted:!!collection.records[r.id]?.tasted,wantToTry:!!collection.records[r.id]?.wantToTry}))};}
  },{
    name:'set_roaster_tasted',title:'Set a roaster as tasted',description:'Record or remove a tasting in this browser. Updates the visible collection, milestones and region badges, with Undo. Use only for a tasting the visitor asks to record or remove.',inputSchema:{type:'object',properties:{roasterId:{type:'string'},tasted:{type:'boolean'}},required:['roasterId','tasted'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){if(!input||Object.keys(input).some(k=>!['roasterId','tasted'].includes(k))||typeof input.tasted!=='boolean'||!catalog.roasters.some(r=>r.id===input.roasterId))throw Error('Provide a known roasterId and boolean tasted.');if(!!collection.records[input.roasterId]?.tasted!==input.tasted)updateTasting(input.roasterId,input.tasted);return {roasterId:input.roasterId,tasted:!!collection.records[input.roasterId]?.tasted,saved:!saveFailed,totalTasted:progress.tasted};}
  }];
  for(const definition of definitions){try{Promise.resolve(context.registerTool(definition,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
}
