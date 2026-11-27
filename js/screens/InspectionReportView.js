import {revealFieldErrors} from '../util/WorkFormFeedback.js';
import {store} from '../store.js';
import {t} from '../i18n.js';
import {inspectionWork,workEscape as esc} from '../util/InspectionWorkApi.js';
import {openInspectionWorkDetail,unmountInspectionWorkScreen} from './InspectionWorkScreen.js';
import {reportStage,reportDay,reportOverdue,filterInspectionReport,inspectionSummary,inspectionCsv,csvCell} from '../util/InspectionReportModel.js';
const L=value=>esc(t(value));
let stop=()=>{};
export function unmountInspectionReport(){stop();stop=()=>{};unmountInspectionWorkScreen();}
export function mountInspectionReport(body){
  unmountInspectionReport();
  if(!['admin','manager'].includes(store.activeRole)){body.textContent=t('Manager or administrator access required.');return;}
  const clientId=Number(store.activeClientId),uid=store.authUser?.uid;let alive=true,rows=[],cursor=null,loading=false,loaded=false,loadedAt=0;
  const filter={basis:'createdAt',from:'',to:'',status:'ALL',inspector:'',location:'',failed:false};
  const current=()=>alive&&body.isConnected&&uid===store.authUser?.uid&&clientId===Number(store.activeClientId)&&!store.marinaSwitching&&['admin','manager'].includes(store.activeRole);
  const footer=document.getElementById('rpExport');if(footer)footer.hidden=true;
  if(!document.getElementById('inspectionReportStyles')){const style=document.createElement('style');style.id='inspectionReportStyles';style.textContent=`
    .ir-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0;}
    .ir-filters label{font-size:14px;color:#BEC8D2;display:flex;flex-direction:column;gap:6px;min-width:0;}
    .ir-filters input,.ir-filters select{box-sizing:border-box;max-width:100%;padding:10px;min-height:44px;background:#151A20;color:#F5F7F9;border:1px solid #737D89;border-radius:8px;font:inherit;}
    .ir-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:16px 0;}
    .ir-kpi{border:1px solid #39434D;border-radius:10px;padding:12px;background:#1C232B;font-size:14px;}.ir-kpi strong{display:block;font-size:24px;margin-top:5px;}
    .ir-card{border:1px solid #737D89;border-radius:10px;margin:12px 0;padding:16px;}.ir-card h3{font-size:18px;margin:0 0 10px;}.ir-card p{margin:7px 0;line-height:1.5;}.ir-meta{color:#B9C4CF;font-size:14px;}.ir-fail{border-left:4px solid #FF7676;}.ir-warning{color:#FFC2B8;}.ir-actions{display:flex;gap:8px;flex-wrap:wrap;}.ir-help{font-size:14px;color:#B9C4CF;line-height:1.5;} .ir-partial{color:#FFD08A;}
  `;document.head.append(style);}
  body.innerHTML=`<h2>${L('Inspection report')}</h2><p class="ir-help">${L('Current inspection records for this marina. Approved findings can still include failures; approval does not confirm repairs.')}</p>
    <div class="ir-filters"><label>${L('Date field')}<select data-ir="basis"><option value="createdAt">${L('Record created')}</option><option value="submittedAt">${L('Submitted')}</option><option value="reviewedAt">${L('Reviewed')}</option></select></label>
    <label>${L('From (UTC)')}<input type="date" data-ir="from"></label><label>${L('To (UTC)')}<input type="date" data-ir="to"></label>
    <label>${L('Status')}<select data-ir="status">${['ALL','ASSIGNED','IN_PROGRESS','BLOCKED','AWAITING_REVIEW','COMPLETED','WITHDRAWN'].map(s=>`<option value="${s}">${L(s==='ALL'?'All':reportStage(s))}</option>`).join('')}</select></label>
    <label>${L('Inspector')}<select data-ir="inspector"><option value="">${L('All Inspectors')}</option></select></label>
    <label>${L('Vessel / location')}<select data-ir="location"><option value="">${L('All locations')}</option></select></label></div>
    <label><input type="checkbox" data-ir="failed"> ${L('Only inspections with failed checks')}</label>
    <p class="ir-help">${L('Dates use UTC. Records with no date in the selected date field are excluded when a date range is set. Overdue means past due and not yet approved. Counts show current status, not status as it was in the past.')}</p>
    <div class="ir-actions"><button type="button" class="dash-filter" data-ir-refresh>${L('Refresh')}</button><button type="button" class="dash-filter" data-ir-csv disabled>${L('Export CSV')}</button><button type="button" class="dash-filter" data-ir-pdf disabled>${L('Export PDF')}</button></div>
    <p data-ir-status role="status" aria-live="polite"></p><div data-ir-summary class="ir-summary"></div><div data-ir-list></div><button type="button" class="dash-filter" data-ir-more hidden>${L('Load remaining records')}</button>`;
  const $=selector=>body.querySelector(selector),status=(message,partial=false)=>{if(current()){ $('[data-ir-status]').textContent=t(message);$('[data-ir-status]').classList.toggle('ir-partial',partial);}};
  function filterDescription(){return [body.querySelector('[data-ir="basis"]').selectedOptions[0].textContent+': '+(filter.from||'Any')+' to '+(filter.to||'Any'),t('Status')+': '+(filter.status==='ALL'?t('All'):t(reportStage(filter.status))),t('Inspector')+': '+body.querySelector('[data-ir="inspector"]').selectedOptions[0].textContent,t('Vessel / location')+': '+(filter.location||t('All')),t('Failed checks only')+': '+t(filter.failed?'Yes':'No')].join(' | ');}
  function selected(){return filterInspectionReport(rows,filter);}
  function render(){
    if(!current())return;
    const visible=selected(),summary=inspectionSummary(visible);
    $('[data-ir-summary]').innerHTML=Object.entries({Total:summary.total,Assigned:summary.assigned,'In progress':summary.inProgress,Blocked:summary.blocked,'Awaiting review':summary.awaitingReview,Approved:summary.approved,Overdue:summary.overdue,'Failed checks':summary.failedChecks}).map(([label,value])=>`<div class="ir-kpi">${L(label)}<strong>${value}</strong></div>`).join('');
    $('[data-ir-list]').innerHTML=visible.map(row=>`<article class="ir-card ${row.failedChecks?'ir-fail':''}"><h3>${esc(row.title)}</h3><p><strong>${L(reportStage(row.stage))}</strong>${reportOverdue(row)?' · '+L('Overdue'):''}</p><p>${esc(row.location||t('Location not recorded'))}</p><p class="ir-meta">${L('Inspector')}: ${esc(row.assigneeName||t('Not recorded'))}${row.dueDate?' · '+L('Due')+': '+esc(row.dueDate):''}</p><p>${L('Pass')}: ${Number(row.passedChecks||0)} · <span class="${row.failedChecks?'ir-warning':''}">${L('Fail')}: ${Number(row.failedChecks||0)}</span> · ${L('Not recorded')}: ${Number(row.notRecorded||0)}</p>
      ${row.failedChecks?`<p class="ir-warning">${L('Failed checks as recorded')}: ${esc(row.findings.filter(f=>f.result==='FAIL').map(f=>f.text).join('; '))}</p>`:''}<p class="ir-meta">${L('Created')}: ${esc(reportDay(row.createdAt)||t('Not recorded'))} · ${L('Submitted')}: ${esc(reportDay(row.submittedAt)||t('Not recorded'))}<br>${L('Reviewed')}: ${esc(reportDay(row.reviewedAt)||t('Not recorded'))}${row.reviewerName?' · '+esc(row.reviewerName):''}</p>
      <button type="button" class="dash-filter" data-ir-open="${esc(row.docId)}">${L('View findings, notes and photos')}</button></article>`).join('')||`<p>${L('No inspections match these filters.')}</p>`;
    body.querySelectorAll('[data-ir-open]').forEach(button=>button.onclick=()=>openInspectionWorkDetail(button.dataset.irOpen,()=>load(true)));
    $('[data-ir-more]').hidden=!cursor;$('[data-ir-more]').disabled=loading;
    for(const key of ['csv','pdf'])$(`[data-ir-${key}]`).disabled=loading||!loaded||!!cursor||!visible.length||!!(filter.from&&filter.to&&filter.from>filter.to);
  }
  function options(){
    const inspectors=[...new Map(rows.filter(r=>r.assigneeUid).map(r=>[r.assigneeUid,r.assigneeName||r.assigneeUid])).entries()];
    $('[data-ir="inspector"]').innerHTML=`<option value="">${L('All Inspectors')}</option>`+inspectors.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');$('[data-ir="inspector"]').value=filter.inspector;
    $('[data-ir="location"]').innerHTML=`<option value="">${L('All locations')}</option>`+[...new Set(rows.map(r=>r.location).filter(Boolean))].sort().map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');$('[data-ir="location"]').value=filter.location;
  }
  async function load(reset=false){
    if(!current()||loading)return;loading=true;if(reset){rows=[];cursor=null;loaded=false;}render();status('Loading inspections…');
    try{for(let page=0;page<20;page++){
      const result=await inspectionWork('REPORT',cursor?{cursor}:{});if(!current())return;
      rows=[...new Map([...rows,...result.items].map(row=>[row.docId,row])).values()];cursor=result.nextCursor||null;loaded=true;loadedAt=result.generatedAt||Date.now();if(!cursor)break;
    }if(current()){options();status(cursor?'Partial report — load the remaining records before exporting.':`${rows.length} inspection records loaded. ${new Date(loadedAt).toISOString()} — refresh for latest status.`,!!cursor);}}
    catch(error){status(error.message||'Could not load the report. Refresh to retry.');loaded=false;}
    finally{loading=false;render();}
  }
  body.querySelectorAll('[data-ir]').forEach(input=>input.onchange=()=>{
    filter[input.dataset.ir]=input.type==='checkbox'?input.checked:input.value;
    if(filter.from&&filter.to&&filter.from>filter.to){revealFieldErrors(body,[[$('[data-ir=\"from\"]'),'From date must be on or before To date.'],[$('[data-ir=\"to\"]'),'To date must be on or after From date.']]);for(const key of ['csv','pdf'])$(`[data-ir-${key}]`).disabled=true;return;}status(cursor?'Partial report — load the remaining records before exporting.':'',!!cursor);render();
  });
  $('[data-ir-refresh]').onclick=()=>load(true);$('[data-ir-more]').onclick=()=>load(false);
  $('[data-ir-csv]').onclick=()=>{if(!current()||!loaded||cursor)return;const metadata={'Marina':store.activeMarina?.name||String(clientId),'Generated (UTC)':new Date().toISOString(),'Records loaded (UTC)':new Date(loadedAt).toISOString(),'Filters':filterDescription(),'Meaning':'Approval records findings; it does not confirm repairs.'};download(new Blob([inspectionCsv(selected(),metadata)],{type:'text/csv;charset=utf-8'}),'inspection-report.csv');};
  $('[data-ir-pdf]').onclick=async()=>{
    if(!current()||!loaded||cursor)return;const selectedRows=selected();$('[data-ir-pdf]').disabled=true;
    try{if(!window.jspdf?.jsPDF)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';script.onload=resolve;script.onerror=()=>reject(Error(t('Could not load PDF export. Try again.')));document.head.append(script);});if(!current())return;
      const pdf=new window.jspdf.jsPDF();let y=18;
      const line=(value,size=10)=>{pdf.setFontSize(size);for(const text of pdf.splitTextToSize(String(value),180)){if(y>278){pdf.addPage();y=18;}pdf.text(text,14,y);y+=size*.5;}y+=3;};
      line('Inspection report',18);line(store.activeMarina?.name||'Marina '+clientId);line('Generated (UTC): '+new Date().toISOString());line('Records loaded (UTC): '+new Date(loadedAt).toISOString());line('Filters: '+filterDescription());line('Approval records findings; it does not confirm repairs.');line('Current status; date fields use UTC.');line('Summary: '+Object.entries(inspectionSummary(selectedRows)).map(([key,value])=>({total:'Total',assigned:'Assigned',inProgress:'In progress',blocked:'Blocked',awaitingReview:'Awaiting review',approved:'Approved',overdue:'Overdue',failedChecks:'Failed checks'}[key])+': '+value).join(' | '));
      for(const row of selectedRows){line(row.title,13);line(reportStage(row.stage)+' | '+row.location+' | Inspector: '+row.assigneeName);line('Pass: '+row.passedChecks+' | Fail: '+row.failedChecks+' | Not recorded: '+row.notRecorded);line('Due: '+(row.dueDate||'Not recorded')+' | Created: '+(reportDay(row.createdAt)||'Not recorded'));line('Submitted: '+(reportDay(row.submittedAt)||'Not recorded')+' | Reviewed: '+(reportDay(row.reviewedAt)||'Not recorded')+' | Reviewer: '+(row.reviewerName||'Not recorded'));for(const finding of row.findings)line(finding.result+': '+finding.text);if(row.managerNote)line('Manager feedback: '+row.managerNote);line('Reference: '+row.docId+' — open Inspection Review for full notes/photos.');}
      pdf.save('inspection-report.pdf');status('Report exported.');
    }catch(error){status(error.message);}finally{if(current())render();}
  };
  function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  stop=()=>{alive=false;rows=[];if(footer)footer.hidden=false;};load(true);
}
