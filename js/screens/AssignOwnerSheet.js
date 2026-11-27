import { openStaffWorkAssign } from './StaffWorkScreen.js';
export async function showAssignOwnerSheet(item, {onChanged} = {}) {
  return openStaffWorkAssign({kind:'maintenance', sourceDocId:item._docId, title:item.type || item.title}, onChanged);
}
