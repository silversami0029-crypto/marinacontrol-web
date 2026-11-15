// js/util/BerthFitChecker.js

const WARNING_THRESHOLD = 0.90;

export function checkFit(boat, berth) {
  const failures = [];
  const warnings = [];

  if (!boat || !berth) {
    failures.push('Boat or berth information is missing');
    return { failures, warnings };
  }

  const boatLength = Number(boat.length || 0);
  const boatBeam   = Number(boat.beam || 0);
  const boatDraft  = Number(boat.draft || 0);
  const boatAir    = Number(boat.airDraft || 0);

  const berthLength = Number(berth.length || 0);
  const berthWidth  = Number(berth.width || 0);
  const berthDepth  = Number(berth.depth || 0);
  const berthAir    = Number(berth.maxAirDraft || 0);

  if (boatLength > 0 && berthLength > 0) {
    if (boatLength > berthLength) {
      failures.push(`Boat length ${boatLength}m exceeds berth length ${berthLength}m`);
    } else if (boatLength >= berthLength * WARNING_THRESHOLD) {
      warnings.push('Boat length is close to berth limit');
    }
  }

  if (boatBeam > 0 && berthWidth > 0) {
    if (boatBeam > berthWidth) {
      failures.push(`Boat beam ${boatBeam}m exceeds berth width ${berthWidth}m`);
    } else if (boatBeam >= berthWidth * WARNING_THRESHOLD) {
      warnings.push('Boat beam is close to berth width limit');
    }
  }

  if (boatDraft > 0 && berthDepth > 0) {
    if (boatDraft > berthDepth) {
      failures.push(`Boat draft ${boatDraft}m exceeds berth depth ${berthDepth}m`);
    } else if (boatDraft >= berthDepth * WARNING_THRESHOLD) {
      warnings.push('Boat draft is close to berth depth limit');
    }
  }

  if (boatAir > 0 && berthAir > 0) {
    if (boatAir > berthAir) {
      failures.push(`Boat air draft ${boatAir}m exceeds berth air draft limit ${berthAir}m`);
    } else if (boatAir >= berthAir * WARNING_THRESHOLD) {
      warnings.push('Boat air draft is close to berth clearance limit');
    }
  }

  return { failures, warnings };
}