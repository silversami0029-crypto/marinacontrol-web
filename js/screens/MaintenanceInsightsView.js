import {calculateMaintenanceInsights,assetKey,isCompleted} from '../analytics/maintenanceInsights.js';
import {toMs} from '../analytics/operationsTrends.js';
import {showMaintenanceDetail} from './MaintenanceDetailSheet.js';
import {getLocale} from '../i18n.js';
import {mt} from './maintenanceInsightsText.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=v=>String(v??'').trim()||mt('Not recorded');
export function maintenanceHelpSteps(){return [
 ['Selected records','Source breakdowns and repeated records use tasks scheduled inside the selected period and current status filter. Source is reporting origin, not proven root cause.'],
 ['Attention and backlog','Attention, overdue age and blockers include earlier unfinished work before the selected end date, plus tasks without valid dates. They use the current status filter. Completed work never enters the attention queue.'],
 ['Review order','Escalations first, then recorded high or critical priority or risk, reviews due, overdue tasks and missing ownership. These are review prompts, not automated safety decisions.'],
 ['Repeated records','Matching task wording on the same linked asset, berth or boat can indicate separate occurrences or duplicate reporting. Investigate before calling them recurring faults.'],
 ['Deferral timing','Days overdue measure time since the scheduled date. Days since recorded deferral are elapsed calendar days, not labour hours or the full delay history.'],
 ['Reporting limits','Counts show current status, even for past periods. No repair cost, root cause, revenue loss or savings are inferred. Percentages include missing sources or reasons. UTC dates; reopen to refresh.']
].map(([title,body])=>[mt(title),mt(body)]);}
export function renderMaintenanceInsights(container,{clientId,from,end,now,tasks,berths,status}){
 const css=new URL('../../css/maintenance-insights.css',import.meta.url).href;
 if(![...document.querySelectorAll('link[rel="stylesheet"]')].some(x=>x.href===css)){const link=document.createElement('link');link.rel='stylesheet';link.href=css;document.head.append(link);}
 const r=calculateMaintenanceInsights(clientId,from,end,now,tasks,status),buttons=[];
 const number=n=>new Intl.NumberFormat(getLocale(),{maximumFractionDigits:0}).format(n);
 const percent=n=>new Intl.NumberFormat(getLocale(),{style:'percent',maximumFractionDigits:1}).format(n);
 const date=ms=>new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium',timeZone:'UTC'}).format(ms);
 const location=t=>{const b=berths.find(b=>Number(b.clientId)===Number(clientId)&&Number(b.id)===Number(t.berthId));return b?[b.dockName,b.berthNumber,Number(t.assetId)>0?'Asset #'+t.assetId:''].filter(Boolean).join(' · '):assetKey(t);};
 const card=(t,action,facts)=>{const id=buttons.push(t)-1;return `<button type="button" class="ot-insight" data-insight="${id}"><strong>${esc(label(t.type))}</strong><span class="ot-insight-facts">${esc(facts)}</span><span class="ot-insight-action">${esc(mt(action))}</span></button>`;};
 const taskCard=t=>card(t,'View task details',[location(t),mt('Owner')+': '+label(t.assignedTo),mt('Scheduled date')+': '+label(t.date),mt('Source')+': '+label(t.source)].filter(Boolean).join('\n'));
 const heading=title=>`<h3>${esc(mt(title))}</h3>`;
 const group=(title,items,share)=>`<details class="ot-insight-group"><summary>${esc(title)} · <b>${number(items.length)}${share==null?'':' · '+percent(share)}</b></summary>${items.map(taskCard).join('')}</details>${share==null?'':`<div class="ot-insight-bar" aria-hidden="true"><span style="width:${share*100}%"></span></div>`}`;
 let html=`<div class="ot-total"><strong>${esc(mt('Maintenance insights'))}</strong></div><p class="ot-caption">${esc(date(from))} – ${esc(date(end-86400000))}</p>`;
 if(status==='COMPLETED'){
  html+=heading('Completed tasks');
  html+=r.selected.length?r.selected.map(taskCard).join(''):`<p class="ot-caption">${esc(mt('No completed tasks scheduled in this period. Try Past 12 months to include earlier scheduled work.'))}</p>`;
 }else{
  html+=heading('Work needing attention')+`<p class="ot-caption">${esc(mt('Includes earlier unfinished work'))} · ${number(r.attention.length)}</p>`;
  if(!r.attention.length)html+=`<p class="ot-caption">${esc(mt('No flagged work in the current records.'))}</p>`;
  for(const i of r.attention){
   const facts=[location(i.task),mt('Owner')+': '+label(i.task.assignedTo),mt('Source')+': '+label(i.task.source)];
   if(i.escalated)facts.unshift(mt('Escalated'));
   if(i.urgent)facts.push(mt('Priority')+': '+label(i.task.priority),mt('Risk level')+': '+label(i.task.riskLevel));
   if(i.overdueDays)facts.push(number(i.overdueDays)+' '+mt('Days overdue'));
   if(i.reviewDue)facts.push(mt('Review due'));
   if(i.scheduled<=0)facts.push(mt('Scheduled date missing or invalid'));
   if(i.deferredDays!=null)facts.push(mt('Days since recorded deferral')+': '+number(i.deferredDays));
   const action=i.escalated?'Review the escalation and mitigation':i.urgent?'Review the recorded priority or risk':i.reviewDue?'Review the deferral decision':i.overdueDays?'Confirm what is blocking completion':i.unassigned?'Assign an owner':i.scheduled<=0?'Set a valid scheduled date':'Confirm the blocker and next review';
   html+=card(i.task,action,facts.filter(Boolean).join('\n'));
  }
  html+=heading('What is holding work up');
  const blockers=[...r.blockers].sort((a,b)=>b[1].length-a[1].length),denominator=blockers.reduce((n,[,list])=>n+list.length,0);
  html+=blockers.length?blockers.map(([reason,list])=>group(label(reason),list,list.length/denominator)).join(''):`<p class="ot-caption">${esc(mt('No unfinished deferred work recorded.'))}</p>`;
  html+=heading('How long work is overdue');
  const bands=['1–7','8–30','31–90','90+'];
  html+=r.overdueBands.some(n=>n)?r.overdueBands.map((n,i)=>`<div class="ot-insight-age"><span>${bands[i]} ${esc(mt('days'))}</span><b>${number(n)}</b></div>`).join(''):`<p class="ot-caption">${esc(mt('No overdue work recorded.'))}</p>`;
 }
 html+=heading('Repeated records on the same asset');
 const repeats=[...r.repeats.values()].filter(list=>list.length>1).sort((a,b)=>b.length-a.length);
 html+=repeats.length?repeats.map(list=>group(label(list[0].type)+' · '+location(list[0]),list)).join(''):`<p class="ot-caption">${esc(mt('No matching repeated records in the selected period.'))}</p>`;
 html+=heading('Where the work comes from')+`<p class="ot-caption">${esc(mt('Tasks scheduled in selected period'))}: ${number(r.selected.length)}</p>`;
 html+=[...r.sources].sort((a,b)=>b[1].length-a[1].length).map(([source,list])=>group(label(source),list,list.length/r.selected.length)).join('');
 if(r.missingDates)html+=`<p class="ot-caption">${esc(mt('Scheduled date missing or invalid'))}: ${number(r.missingDates)}</p>`;
 container.innerHTML=html;
 container.querySelectorAll('[data-insight]').forEach(button=>button.onclick=()=>{
  const t={...buttons[Number(button.dataset.insight)]};
  for(const field of ['assignedAt','deferredAt'])if(t[field]!=null)t[field]=toMs(t[field]);
  showMaintenanceDetail(t);
 });
}
