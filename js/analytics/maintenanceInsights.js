import {toMs} from './operationsTrends.js';
const DAY=86400000, clean=v=>String(v??'').trim(), upper=v=>clean(v).toUpperCase();
const day=ms=>{const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
export const isCompleted=t=>t.completed===true||upper(t.status)==='COMPLETED';
export const currentState=t=>isCompleted(t)?'COMPLETED':upper(t.status)==='DEFERRED'?'DEFERRED':'OPEN';
export function assetKey(t){
  if(Number(t.assetId)>0)return 'Asset #'+t.assetId;
  if(Number(t.berthId)>0)return 'Berth #'+t.berthId;
  if(Number(t.boatId)>0)return 'Boat #'+t.boatId;
  return '';
}
export function calculateMaintenanceInsights(clientId,from,end,now,tasks,status='ALL'){
  if(!Number.isFinite(from)||from<=0||end<=from)throw Error('Invalid date range');
  const r={selected:[],attention:[],sources:new Map(),repeats:new Map(),blockers:new Map(),overdueBands:[0,0,0,0],missingDates:0};
  const today=day(now),seen=new Set();
  for(const t of tasks||[]){
    if(Number(t.clientId)!==Number(clientId))continue;
    const key=clean(t.cloudId)||clean(t._docId)||(t.id!=null?'local:'+t.id:'');
    if(key&&seen.has(key))continue;if(key)seen.add(key);
    if(status!=='ALL'&&currentState(t)!==status)continue;
    const scheduled=typeof t.date==='string'?toMs(t.date):0;
    if(scheduled<=0)r.missingDates++;
    if(scheduled>=from&&scheduled<end){
      r.selected.push(t);const source=clean(t.source);
      if(!r.sources.has(source))r.sources.set(source,[]);r.sources.get(source).push(t);
      const place=assetKey(t),type=clean(t.type).toLowerCase();
      if(place&&type){const group=type+'\n'+place;if(!r.repeats.has(group))r.repeats.set(group,[]);r.repeats.get(group).push(t);}
    }
    if(isCompleted(t)||scheduled>=end)continue;
    const overdueDays=scheduled>0&&scheduled<today?Math.floor((today-scheduled)/DAY):0;
    const escalated=upper(t.status)==='ESCALATED'||upper(t.reviewStatus)==='ESCALATED';
    const urgent=['HIGH','CRITICAL'].includes(upper(t.priority))||['HIGH','CRITICAL'].includes(upper(t.riskLevel));
    const unassigned=!clean(t.assignedTo),deferredAt=toMs(t.deferredAt);
    const deferred=upper(t.status)==='DEFERRED'||escalated&&deferredAt>0;
    const review=typeof t.reviewDate==='string'?toMs(t.reviewDate):0,reviewDue=deferred&&review>0&&review<=today;
    const deferredDays=deferred&&deferredAt>0&&deferredAt<=now?Math.floor((today-day(deferredAt))/DAY):null;
    if(overdueDays)r.overdueBands[overdueDays<=7?0:overdueDays<=30?1:overdueDays<=90?2:3]++;
    if(deferred){const reason=clean(t.deferReason);if(!r.blockers.has(reason))r.blockers.set(reason,[]);r.blockers.get(reason).push(t);}
    if(escalated||urgent||reviewDue||overdueDays||unassigned||scheduled<=0||deferred){
      r.attention.push({task:t,overdueDays,escalated,urgent,unassigned,reviewDue,deferredDays,scheduled,rank:escalated?0:urgent?1:reviewDue?2:overdueDays?3:unassigned?4:5});
    }
  }
  r.attention.sort((a,b)=>a.rank-b.rank||b.overdueDays-a.overdueDays||Number(a.task.id||0)-Number(b.task.id||0));
  return r;
}
