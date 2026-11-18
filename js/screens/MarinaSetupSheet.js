import { t } from '../i18n.js';
import { store } from '../store.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { setupSteps, canUseMarinaSetup, setupContext, setupContextCurrent, setupRequest, setupCompletedCount, setupSupportUrl } from '../util/MarinaSetup.js';

const buttonStyle='padding:9px 14px;border:1px solid var(--color-water-blue,#2196F3);border-radius:20px;background:transparent;color:var(--color-water-blue,#2196F3);font:inherit;cursor:pointer';
const statusLabels={PENDING:'Not started',COMPLETE:'Complete',NOT_NEEDED:'Not needed'};

export function showMarinaSetup(anchor=null,onUpdated=()=>{}) {
  const root=document.getElementById('modalRoot');
  if(!root||!canUseMarinaSetup()||root.querySelector('[data-marina-setup]'))return()=>{};
  const context=setupContext(),backdrop=document.createElement('div'),sheet=document.createElement('div');
  backdrop.className='sheet-backdrop';sheet.className='sheet';sheet.dataset.marinaSetup='1';
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',t('Marina setup'));
  sheet.innerHTML=`${sheetCloseButton()}<div class="sheet-title"></div><div class="add-scroll" style="padding:16px;overflow:auto;min-height:0">
    <h3 data-marina style="overflow-wrap:anywhere"></h3><p data-intro></p><p role="status" data-status></p>
    <p role="alert" data-error style="color:#ff9999"></p><button type="button" data-refresh style="${buttonStyle}"></button>
    <div data-steps></div><section data-support style="margin-top:24px"></section></div>
    <button type="button" class="md-close-btn" data-close></button>`;
  const $=s=>sheet.querySelector(s);let closed=false,busy=false,data=null;
  $('.sheet-title').textContent=t('Marina setup');$('[data-marina]').textContent=store.activeMarina?.name||`Marina ${context.clientId}`;
  $('[data-intro]').textContent=t('A shared setup checklist for this marina. Completion is confirmed by your team; opening a screen does not mark a step complete. You can reopen completed steps.');
  $('[data-close]').textContent=t('Close');$('[data-refresh]').textContent=t('Refresh progress');
  root.append(backdrop,sheet);requestAnimationFrame(()=>{if(!closed){backdrop.classList.add('is-open');sheet.classList.add('is-open');}});
  const current=()=>!closed&&sheet.isConnected&&setupContextCurrent(context)&&(!anchor||anchor.isConnected);
  let stopStore=()=>{};
  const observer=new MutationObserver(()=>{if(!current())close();});
  function close(){if(closed)return;closed=true;stopStore();observer.disconnect();sheet.remove();backdrop.remove();}
  stopStore=store.subscribe(()=>{if(!current())close();});observer.observe(root,{childList:true});if(anchor?.parentElement)observer.observe(anchor.parentElement,{childList:true});
  backdrop.onclick=close;$('[data-close]').onclick=close;$('[data-sheet-close]').onclick=close;
  function error(err){if(current())$('[data-error]').textContent=err.code==='functions/not-found'?t('Marina setup is not available yet. Please contact MarinaControl; no progress has been changed.'):err.message||t('Could not load or save marina setup.');}
  function setBusy(value){busy=value;for(const button of sheet.querySelectorAll('[data-steps] button,[data-refresh]'))button.disabled=value;}
  function link(label,href,container){const a=document.createElement('a');a.textContent=t(label);a.href=href;a.style.cssText=buttonStyle+';display:inline-block;text-decoration:none';if(href.startsWith('#/'))a.onclick=close;container.append(a);}
  function render(){
    if(!current()){close();return;}if(!data)return;
    const name=data.marina.name||`Marina ${context.clientId}`;
    $('[data-marina]').textContent=name;$('[data-status]').textContent=`${setupCompletedCount(data)} / ${setupSteps.length} ${t('steps complete')}${data.complete?' · '+t('Setup complete'):''}`;
    const list=$('[data-steps]');list.replaceChildren();
    for(const [index,step] of setupSteps.entries()){
      const saved=data.steps[step.id],section=document.createElement('section');section.style.cssText='padding:16px 0;border-bottom:1px solid #48515d;overflow-wrap:anywhere';
      const heading=document.createElement('h3');heading.textContent=`${index+1}. ${t(step.title)}`;section.append(heading);
      const description=document.createElement('p');description.textContent=t(step.description);section.append(description);
      const status=document.createElement('p');status.textContent=t(statusLabels[saved.status]||'Not started')+(saved.updatedAt?` · ${new Date(saved.updatedAt).toLocaleString()}`:'');section.append(status);
      const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px';section.append(actions);
      if(step.id==='details'){
        const details=document.createElement('div');details.hidden=true;
        for(const [key,label] of [['name','Name'],['countryCode','Country'],['email','Email'],['phone','Phone']]){const p=document.createElement('p');p.textContent=`${t(label)}: ${data.marina[key]||t('Not set')}`;details.append(p);}
        const open=document.createElement('button');open.type='button';open.textContent=t('Open');open.style.cssText=buttonStyle;open.onclick=()=>{details.hidden=!details.hidden;};actions.append(open);section.append(details);
      }else if(step.id==='records'){
        for(const [label,route] of [['Customers','#/customer-directory'],['Boats','#/boats'],['Berths','#/berths']])link(label,route,actions);
      }else if(step.id==='team'){
        if(store.activeRole==='admin')link('Open user management','#/user-management',actions);
        else{const p=document.createElement('p');p.textContent=t('A marina administrator must add users or change roles.');section.append(p);}
      }else if(step.id==='workflow'){
        link('Open Dock Walk','#/dock-walk',actions);link('Open maintenance','#/maintenance',actions);
      }else link('Arrange a review',setupSupportUrl(context,name,true),actions);
      for(const [status,label] of saved.status==='PENDING'?[['COMPLETE','Mark complete'],...(step.skippable?[['NOT_NEEDED','Not needed']]:[])]:[['PENDING','Reopen step']]){
        const button=document.createElement('button');button.type='button';button.style.cssText=buttonStyle;button.textContent=t(label);
        button.onclick=async()=>{
          if(busy||!current())return;setBusy(true);$('[data-error]').textContent='';
          try{const next=await setupRequest('setMarinaSetupStep',context,{step:step.id,status,expectedRevision:data.revision});if(current()){data=next;render();onUpdated(data);}}
          catch(err){error(err);}finally{if(current())setBusy(false);}
        };actions.append(button);
      }
      list.append(section);
    }
    const support=$('[data-support]');support.replaceChildren();const title=document.createElement('h3');title.textContent=t('Need help getting started?');support.append(title);
    link('support@marinacontrol.co.uk','mailto:support@marinacontrol.co.uk',support);
    const p=document.createElement('p');p.textContent=t('Arrange remote setup, a small checked import, staff training and a pilot review. Any remote PC access is agreed separately.');support.append(p);
    link('Request a remote setup session',setupSupportUrl(context,name),support);
    const hint=document.createElement('p');hint.textContent=t('This opens an email draft. Send it to request a session; it does not book an appointment.');support.append(hint);
  }
  async function load(){
    if(busy||!current())return;setBusy(true);$('[data-error]').textContent='';$('[data-status]').textContent=t('Loading…');
    try{const next=await setupRequest('getMarinaSetup',context);if(current()){data=next;render();onUpdated(data);}}
    catch(err){error(err);if(current())$('[data-status]').textContent=t('Progress unavailable.');}
    finally{if(current())setBusy(false);}
  }
  $('[data-refresh]').onclick=load;load();return close;
}

export function mountMarinaSetupPrompt(host){
  if(!canUseMarinaSetup()||!host?.isConnected)return()=>{};
  const context=setupContext(),card=document.createElement('section');card.hidden=true;card.style.cssText='margin:16px 0;padding:16px;border:1px solid var(--color-water-blue,#2196F3);border-radius:12px';
  const heading=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');button.type='button';button.textContent=t('Open Marina setup');button.style.cssText=buttonStyle;card.append(heading,info,button);host.querySelector('.mc-home-heading').after(card);
  let closed=false,closeSheet=()=>{};
  const update=data=>{if(closed||!host.isConnected||!setupContextCurrent(context))return;card.hidden=data.complete;heading.textContent=t('Finish setting up')+' '+(data.marina.name||store.activeMarina?.name||'');info.textContent=`${setupCompletedCount(data)} / 5 ${t('steps complete')}`;};
  button.onclick=()=>{if(!closed&&setupContextCurrent(context))closeSheet=showMarinaSetup(host,update);};
  setupRequest('getMarinaSetup',context).then(update).catch(()=>{card.hidden=true;});
  return()=>{closed=true;closeSheet();card.remove();};
}
