import { toMs, monthStart } from './operationsTrends.js';
export const DECLINE_REASONS = {"NO_AVAILABILITY": "No availability for requested dates", "VESSEL_SIZE": "Vessel exceeds berth dimensions or depth", "FACILITIES": "Required facilities unavailable", "MAINTENANCE": "Berth unavailable due to maintenance", "DUPLICATE": "Duplicate request", "OTHER": "Other"};
export const SIZE_BANDS = ['Under 10 m','10–under 15 m','15–under 25 m','25 m and above','Unknown length'];
export function calculateBookingDemand(clientId, from, end, requests) {
  const months = [];
  for(let m=monthStart(from);m<end;m=monthStart(m,1)) months.push(m);
  const result={months,monthly:months.map(()=>0),reasons:{},sizes:{},matrix:{},total:0,
    requestedDays:0,uniqueVessels:0,unidentifiedRequests:0,excluded:0,simulated:0,missingReason:0};
  const seen=new Set(),vessels=new Set();
  for(const r of requests || []) {
    if(Number(r.clientId)!==Number(clientId) || String(r.status).toUpperCase()!=='DECLINED') continue;
    const key=r.requestUuid || r._docId;
    if(key && seen.has(key)) continue;
    if(key) seen.add(key);
    const arrival=toMs(r.arrivalDate), departure=toMs(r.departureDate);
    if(arrival<=0) {result.excluded++;continue;}
    if(arrival<from || arrival>=end) continue;
    const index=months.indexOf(monthStart(arrival));
    const reason=Object.hasOwn(DECLINE_REASONS,r.declineReasonCode)?r.declineReasonCode:'UNSPECIFIED';
    const len=Number(r.vesselLength);
    const band=!Number.isFinite(len)||len<=0?SIZE_BANDS[4]:len<10?SIZE_BANDS[0]:len<15?SIZE_BANDS[1]:len<25?SIZE_BANDS[2]:SIZE_BANDS[3];
    result.total++; result.monthly[index]++;
    result.reasons[reason]=(result.reasons[reason]||0)+1;
    result.sizes[band]=(result.sizes[band]||0)+1;
    result.matrix[reason] ||= {};
    result.matrix[reason][band]=(result.matrix[reason][band]||0)+1;
    if(reason==='UNSPECIFIED')result.missingReason++;
    if(r.isSimulation===true || r.source==='SIMULATION')result.simulated++;
    if(departure>arrival) {
      const utcDay=ms=>{const d=new Date(ms);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());};
      result.requestedDays+=Math.max(0,(utcDay(departure)-utcDay(arrival))/86400000);
    }
    // MMSI/HIN if supplied; otherwise name + sender. This is only an estimate.
    const name=String(r.vesselName||'').trim().toLowerCase();
    const sender=String(r.senderPhone||'').replace(/\D/g,'');
    const identity=r.simulationVesselId || r.vesselMmsi || r.vesselHin || (name&&sender?name+':'+sender:'');
    if(identity)vessels.add(String(identity));else result.unidentifiedRequests++;
  }
  result.uniqueVessels=vessels.size;
  return result;
}
