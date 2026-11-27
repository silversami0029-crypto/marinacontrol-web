import {t} from '../i18n.js';
let closeCurrent=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=value=>esc(t(value));
const step=(number,title,body)=>`<div class="help-step"><div class="help-step-num">${number}</div><div class="help-step-text"><b>${L(title)}</b> — ${L(body)}</div></div>`;

export function showInspectionHelp(manage=false){
  closeCurrent?.(true);
  const previousFocus=document.activeElement;
  const backdrop=document.createElement('div');backdrop.className='help-backdrop';
  const dialog=document.createElement('div');dialog.className='help-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','inspectionHelpTitle');
  const steps=manage?[
    ['Prepare a Safety checklist','Create a Safety checklist or safety equipment record using the existing management screens.'],
    ['Choose an Inspector','Tap Assign inspection and select an active Inspector sign-in account. A crew link is not required.'],
    ['Review findings','Open Awaiting review. Check every Pass/Fail result, finding note and evidence photo.'],
    ['Approve or return','Approve the inspection record or return it with feedback. Approval records the inspection; failed equipment still needs a manager decision on repairs.'],
    ['Follow progress','Use the blue status filter and bell alerts to follow assignments and review requests.']
  ]:[
    ['Open an assigned inspection','You only see inspections assigned to your sign-in account in this marina.'],
    ['Start the inspection','Tap Start / resume work before recording findings. Procedures are available as read-only reference.'],
    ['Record each finding','Choose Pass or Fail and save each finding. Explain every failure and attach evidence photos where needed.'],
    ['Submit for review','Record every mandatory result, add a completion note and tap Submit for review. Your manager approves or returns the inspection.'],
    ['Follow feedback','Use Awaiting review or Completed. If returned, read the feedback, update findings and submit again.']
  ];
  dialog.innerHTML=`<div class="help-scroll"><div class="help-pill" id="inspectionHelpTitle">${L(manage?'Inspection Review':'My Inspections')}</div>
    <p class="help-desc">${L(manage?'Assign safety inspections to Inspector sign-in accounts and review their findings.':'Record your assigned safety inspections and submit findings for manager approval.')}</p>
    <div class="help-section-title">${L(manage?'How to manage inspections':'How to complete an inspection')}</div>
    ${steps.map(([title,body],i)=>step(i+1,title,body)).join('')}
    <div class="help-divider"></div><div class="help-section-title">${L('Important')}</div>
    <div class="help-tips">${L(manage?'Only managers and administrators assign or approve inspections. A failed check is retained as a finding; approval does not mark equipment repaired.':'You cannot edit equipment inventory, change templates, assign work or approve your own inspections.')}</div>
    <div class="help-note">${L('Work updates and photo uploads need an internet connection. Wait for confirmation that your change was saved.')}</div>
    <div class="help-footer">${L('Need help? support@marinacontrol.co.uk')}</div></div>
    <div class="help-actions"><button type="button" class="help-gotit" data-work-help-done>${L('Got it')}</button></div>`;
  document.getElementById('modalRoot').append(backdrop,dialog);
  let closed=false,timer;
  const frame=requestAnimationFrame(()=>{if(!closed){backdrop.classList.add('is-open');dialog.classList.add('is-open');dialog.querySelector('[data-work-help-done]').focus();}});
  const remove=()=>{backdrop.remove();dialog.remove();};
  const close=(immediate=false)=>{
    if(closed){if(immediate){clearTimeout(timer);remove();}return;}
    closed=true;cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey);
    backdrop.classList.remove('is-open');dialog.classList.remove('is-open');
    if(immediate)remove();else timer=setTimeout(remove,220);
    if(closeCurrent===close)closeCurrent=null;if(previousFocus?.isConnected)previousFocus.focus();
  };
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'){event.preventDefault();dialog.querySelector('[data-work-help-done]').focus();}};
  document.addEventListener('keydown',onKey);backdrop.onclick=()=>close();dialog.querySelector('[data-work-help-done]').onclick=()=>close();closeCurrent=close;
  return close;
}
