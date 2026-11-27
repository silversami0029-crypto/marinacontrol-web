import {t} from '../i18n.js';
let closeCurrent=null;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=value=>esc(t(value));
const step=(number,title,body)=>`<div class="help-step"><div class="help-step-num">${number}</div><div class="help-step-text"><b>${L(title)}</b> — ${L(body)}</div></div>`;

export function showStaffWorkHelp(manage=false){
  closeCurrent?.(true);
  const previousFocus=document.activeElement;
  const backdrop=document.createElement('div');backdrop.className='help-backdrop';
  const dialog=document.createElement('div');dialog.className='help-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','staffWorkHelpTitle');
  const steps=manage?[
    ['Create a Staff sign-in','An administrator adds the person in User Management with the Staff role. A crew record alone does not create a login.'],
    ['Link the crew account','Open Crew account links. Choose the crew record and the Staff sign-in account, then tap Save link. Their names and email addresses do not need to match.'],
    ['Assign work','Tap Assign work, select an existing task and the linked crew member, then save. After changing an account link, assign or reassign the task so it reaches the correct login.'],
    ['Review completed work','Open Awaiting review and select a task. Check the notes and photos, then approve completion or return it with feedback. Staff cannot approve their own work.'],
    ['Follow progress','Use Open, Awaiting review, Completed or All to find work. The bell shows unread alerts; reading an alert does not complete a task.']
  ]:[
    ['Open your task','Select an assigned task to see its location, due date and instructions. If work is missing, ask your manager to check your crew account link and assignment.'],
    ['Start work','Tap Start / resume work when you begin. Follow the task instructions and keep your manager informed of progress.'],
    ['Record progress or a blocker','Add a note or photo as evidence. If you cannot continue, use Report a blocker and explain why. Use Start / resume work when you can continue.'],
    ['Submit for review','When the work is done, enter a completion note and tap Submit for manager review. It stays Awaiting review until a manager checks it.'],
    ['Check feedback','If a manager returns the task, read the feedback, do the follow-up work and submit it again. Approved work appears under Completed.']
  ];
  dialog.innerHTML=`<div class="help-scroll"><div class="help-pill" id="staffWorkHelpTitle">${L(manage?'Staff Work':'My Work')}</div>
    <p class="help-desc">${L(manage?'Link Staff sign-in accounts to crew records, assign work and review completion.':'See your assigned work, record progress and submit completed work for manager approval.')}</p>
    <div class="help-section-title">${L(manage?'How to manage staff work':'How to complete your work')}</div>
    ${steps.map(([title,body],i)=>step(i+1,title,body)).join('')}
    <div class="help-divider"></div><div class="help-section-title">${L('Important')}</div>
    <div class="help-tips">${L(manage?'Without a linked Staff sign-in account, assigning a crew member records responsibility but sends no in-app work alert. Managers and administrators approve completion.':'You only see work assigned to your linked account. Your manager handles assignments, priorities and completion approval.')}</div>
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
