export const reportStage=value=>({COMPLETED:'Approved',AWAITING_REVIEW:'Awaiting review',IN_PROGRESS:'In progress',ASSIGNED:'Assigned',BLOCKED:'Blocked',WITHDRAWN:'Withdrawn'}[value]||String(value||'Unknown'));
export const reportDay=ms=>Number.isFinite(Number(ms))&&Number(ms)>0&&Number.isFinite(new Date(Number(ms)).getTime())?new Date(Number(ms)).toISOString().slice(0,10):'';
export function reportOverdue(row,today=reportDay(Date.now())){
  return ['ASSIGNED','IN_PROGRESS','BLOCKED','AWAITING_REVIEW'].includes(row.stage)&&/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate||'')&&Number.isFinite(Date.parse(row.dueDate))&&new Date(row.dueDate).toISOString().slice(0,10)===row.dueDate&&row.dueDate<today;
}
export function filterInspectionReport(rows,filter={}){
  return rows.filter(row=>{
    const day=reportDay(row[filter.basis||'createdAt']);
    return (!filter.from||day&&day>=filter.from)&&(!filter.to||day&&day<=filter.to)&&(!filter.status||filter.status==='ALL'||row.stage===filter.status)
      &&(!filter.inspector||row.assigneeUid===filter.inspector)&&(!filter.location||row.location===filter.location)&&(!filter.failed||Number(row.failedChecks)>0);
  });
}
export function inspectionSummary(rows,today){
  const count=stage=>rows.filter(row=>row.stage===stage).length;
  return {total:rows.length,assigned:count('ASSIGNED'),inProgress:count('IN_PROGRESS'),blocked:count('BLOCKED'),awaitingReview:count('AWAITING_REVIEW'),approved:count('COMPLETED'),overdue:rows.filter(row=>reportOverdue(row,today)).length,failedChecks:rows.reduce((n,row)=>n+Number(row.failedChecks||0),0)};
}
export const reportColumns=['Inspection','Vessel / location','Inspector','Status','Due date','Created (UTC)','Submitted (UTC)','Reviewed (UTC)','Reviewer','Pass checks','Fail checks','Not recorded','Failed checks as recorded','Manager feedback','Record reference'];
export function reportValues(row){
  const stamp=value=>Number(value)>0?new Date(Number(value)).toISOString():'';
  return [row.title,row.location,row.assigneeName,reportStage(row.stage),row.dueDate,stamp(row.createdAt),stamp(row.submittedAt),stamp(row.reviewedAt),row.reviewerName||'',row.passedChecks,row.failedChecks,row.notRecorded,(row.findings||[]).filter(f=>f.result==='FAIL').map(f=>f.text).join('; '),row.managerNote||'',row.docId];
}
export const csvCell=value=>'"'+(/^[\s]*[=+@-]/.test(String(value??''))?"'":'')+String(value??'').replaceAll('"','""')+'"';
export const inspectionCsv=(rows,metadata={})=>'\uFEFF'+[[...reportColumns,...Object.keys(metadata)],...rows.map(row=>[...reportValues(row),...Object.values(metadata)])].map(row=>row.map(csvCell).join(',')).join('\r\n');
