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

/** Consistent editable controls on the work/inspection forms; read-only content is not styled as input. */
export function ensureWorkInputStyles(){
  if(document.getElementById('workInputStyles'))return;
  const style=document.createElement('style');style.id='workInputStyles';style.textContent=`
    .sheet.staff-work-sheet textarea,.sheet.staff-work-sheet select,.sheet.staff-work-sheet input:not([type="checkbox"]):not([type="radio"]),
    .sheet.work-input-sheet textarea,.sheet.work-input-sheet select,.sheet.work-input-sheet input:not([type="checkbox"]):not([type="radio"]){
      background:#2D3E46!important;color:#F5F7F9!important;border:1px solid #8198A6!important;box-sizing:border-box;border-radius:10px;font:inherit;
    }
    .sheet.staff-work-sheet textarea::placeholder,.sheet.staff-work-sheet input::placeholder,.sheet.work-input-sheet textarea::placeholder,.sheet.work-input-sheet input::placeholder{color:#C0CFD8;opacity:1;}
    .sheet.staff-work-sheet :is(textarea,select,input):focus,.sheet.work-input-sheet :is(textarea,select,input):focus{background:#324852!important;border-color:#2196F3!important;outline:2px solid #2196F3;outline-offset:1px;}
    .sheet.staff-work-sheet :is(textarea,select,input).work-form-invalid[aria-invalid="true"],.sheet.work-input-sheet :is(textarea,select,input).work-form-invalid[aria-invalid="true"]{border:2px solid #FF7676!important;outline:1px solid #FF7676;}
    .sheet.staff-work-sheet :is(textarea,select,input):disabled,.sheet.work-input-sheet :is(textarea,select,input):disabled{background:#25333B!important;color:#AEBCC5!important;}
    .sheet.dw-sheet :is(textarea,select,input):not([type="checkbox"]):not([type="radio"]){background:#2D3E46!important;color:#F5F7F9!important;border-color:#8198A6;}
    .sheet.dw-sheet :is(textarea,select,input):focus{outline:2px solid #2196F3;border-color:#2196F3;}
    .sheet.work-input-sheet{display:flex;flex-direction:column;overflow:hidden;max-height:88vh;max-height:88dvh;box-sizing:border-box;padding:0;}
    .work-input-header{display:flex;align-items:center;gap:16px;padding:16px;flex:0 0 auto;}.work-input-header h3{margin:0;flex:1;font-size:20px;}
    .work-input-body{padding:16px;overflow:auto;min-height:0;flex:1 1 auto;}.work-input-body label{display:block;font-weight:600;margin:12px 0;}
    .work-input-body input,.work-input-body textarea,.work-input-body select{width:100%;padding:12px;margin-top:7px;min-height:46px;}
    .work-input-hint{font-size:14px;line-height:1.5;color:#BECBD4;font-weight:400;}.work-input-actions{display:flex;gap:8px;flex-wrap:wrap;padding:16px;flex:0 0 auto;}
    .work-primary{background:#2196F3!important;color:#071924!important;border-color:#2196F3!important;font-weight:700;}
  `;document.head.append(style);
}
