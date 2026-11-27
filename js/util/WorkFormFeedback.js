import {t} from '../i18n.js';
let sequence=0;
function ensure(sheet){
  if(!document.getElementById('workFormFeedbackStyles')){
    const style=document.createElement('style');style.id='workFormFeedbackStyles';style.textContent=`
      .work-form-invalid{border:2px solid #FF7676!important;outline:1px solid #FF7676;outline-offset:1px;animation:work-form-attention .6s ease-in-out 2;}
      .work-form-error{display:block;color:#FFB4B4;font-size:14px;font-weight:400;line-height:1.4;margin:4px 0 8px;}
      [data-work-status][data-kind="error"],[data-ir-status][data-kind="error"]{color:#FFB4B4;font-size:14px;}
      @keyframes work-form-attention{50%{box-shadow:0 0 0 4px #FF767640;}}
      @media(prefers-reduced-motion:reduce){.work-form-invalid{animation:none;}}
    `;document.head.append(style);
  }
  if(!sheet.dataset.workFeedback){sheet.dataset.workFeedback='1';for(const event of ['input','change'])sheet.addEventListener(event,e=>{if(e.target.matches('input,textarea,select'))clearFieldError(e.target);});}
}
export function clearFieldError(field){
  if(!field)return;field.classList.remove('work-form-invalid');field.removeAttribute('aria-invalid');
  if(field.dataset.errorId){document.getElementById(field.dataset.errorId)?.remove();field.removeAttribute('aria-describedby');delete field.dataset.errorId;}
  const form=field.closest('.staff-work-sheet')||field.closest('#rpBody')||field.closest('.sheet'),message=form?.querySelector('[data-work-status],[data-ir-status],p[data-result]');if(form&&!form.querySelector('[aria-invalid="true"]')&&message?.textContent===t('Please complete the highlighted fields.')){message.textContent='';message.dataset.kind='';}
}
export function revealFieldErrors(sheet,errors){
  if(!errors.length)return false;ensure(sheet);
  for(const [field,message] of errors){if(!field)continue;clearFieldError(field);field.classList.add('work-form-invalid');field.setAttribute('aria-invalid','true');
    const error=document.createElement('span');error.id='work-field-error-'+(++sequence);error.className='work-form-error';error.textContent=t(message);field.dataset.errorId=error.id;field.setAttribute('aria-describedby',error.id);field.after(error);
  }
  const message=sheet.querySelector('[data-work-status],[data-ir-status],p[data-result]');if(message){message.textContent=t('Please complete the highlighted fields.');message.dataset.kind='error';}
  const first=errors.find(([field])=>field)?.[0];if(first){first.focus({preventScroll:true});first.scrollIntoView?.({block:'center',behavior:'auto'});}return true;
}
