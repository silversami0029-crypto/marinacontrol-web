// A compact dark calendar; selected values stay YYYY-MM-DD, independent of timezone.
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(offset).fill(null), ...Array.from({length:count}, (_,i)=>i+1)];
}
export function dateString(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function wireBookingDatePicker(input, {label, locale='en-GB', onChange=()=>{}}={}) {
  const trigger = document.createElement('button'); trigger.type='button';
  trigger.className='add-input';
  trigger.style.cssText='display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;border:1px solid var(--color-divider,#394450);border-radius:10px;background:var(--color-surface,#1C222A);color:var(--color-text-primary,#F5F7F9);padding:12px 14px;text-align:start;cursor:pointer;';
  input.type='hidden'; input.after(trigger);
  const refresh=()=>{trigger.textContent='';const text=document.createElement('span');text.textContent=input.value ? new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(input.value+'T12:00:00Z')) : label;trigger.append(text);const icon=document.createElement('span');icon.textContent='▦';icon.style.cssText='font-size:22px;color:#65BEFF;';trigger.append(icon);trigger.setAttribute('aria-label',label+': '+text.textContent);};
  refresh();
  let overlay=null;
  const close=()=>{if(!overlay)return;document.removeEventListener('keydown',keydown);overlay.remove();overlay=null;trigger.focus();};
  const keydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'&&overlay){const all=[...overlay.querySelectorAll('button,select')];const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  trigger.onclick=()=>{
    if(overlay)return;
    const selected=input.value;
    const start=selected?new Date(selected+'T12:00:00Z'):new Date();
    let year=selected?start.getUTCFullYear():start.getFullYear(),month=selected?start.getUTCMonth():start.getMonth();
    const baseYear=year;
    const previousFocus=document.activeElement;
    overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;display:grid;place-items:center;padding:16px;';
    const panel=document.createElement('div');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',label);
    panel.style.cssText='width:min(340px,100%);background:#1C222A;color:#F5F7F9;border:1px solid #394450;border-radius:16px;padding:16px;box-shadow:0 16px 48px #0008;';
    overlay.append(panel);document.body.append(overlay);overlay.onclick=e=>{if(e.target===overlay)close();};document.addEventListener('keydown',keydown);
    const styleButton=button=>{button.type='button';button.style.cssText='min-height:40px;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;font:inherit;';};
    const draw=()=>{
      panel.replaceChildren();
      const heading=document.createElement('div');heading.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';
      const title=document.createElement('strong');title.textContent=label;heading.append(title);
      const exit=document.createElement('button');styleButton(exit);exit.textContent='×';exit.style.fontSize='26px';exit.setAttribute('aria-label','Close calendar');exit.onclick=close;heading.append(exit);panel.append(heading);
      const navigation=document.createElement('div');navigation.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:12px;';
      const prev=document.createElement('button');styleButton(prev);prev.textContent='‹';prev.style.fontSize='24px';prev.setAttribute('aria-label','Previous month');prev.onclick=()=>{month--;if(month<0){month=11;year--;}draw();};
      const next=document.createElement('button');styleButton(next);next.textContent='›';next.style.fontSize='24px';next.setAttribute('aria-label','Next month');next.onclick=()=>{month++;if(month>11){month=0;year++;}draw();};
      const months=document.createElement('select');const years=document.createElement('select');
      for(let i=0;i<12;i++){const option=document.createElement('option');option.value=i;option.textContent=new Intl.DateTimeFormat(locale,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,1)));months.append(option);}
      for(let i=Math.min(baseYear-5,year-5);i<=Math.max(baseYear+15,year+5);i++){const option=document.createElement('option');option.value=i;option.textContent=i;years.append(option);}
      for(const select of [months,years])select.style.cssText='background:#263340;color:#F5F7F9;border:1px solid #394450;border-radius:8px;padding:8px;min-width:0;font:inherit;';
      months.style.flex='1';months.value=month;years.value=year;months.setAttribute('aria-label','Month');years.setAttribute('aria-label','Year');
      months.onchange=()=>{month=Number(months.value);draw();};years.onchange=()=>{year=Number(years.value);draw();};
      navigation.append(prev,months,years,next);panel.append(navigation);
      const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;text-align:center;';
      for(let i=0;i<7;i++){const day=document.createElement('span');day.style.cssText='font-size:12px;color:#AAB5C2;padding:6px 0;';day.textContent=new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,5+i)));grid.append(day);}
      for(const day of monthCells(year,month)){
        if(day===null){grid.append(document.createElement('span'));continue;}
        const value=dateString(year,month,day);const button=document.createElement('button');styleButton(button);button.textContent=day;button.setAttribute('aria-label',new Intl.DateTimeFormat(locale,{dateStyle:'full',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')));
        if(value===selected){button.style.background='#168EE5';button.setAttribute('aria-pressed','true');}
        button.onmouseenter=()=>{if(value!==selected)button.style.background='#304457';};button.onmouseleave=()=>{if(value!==selected)button.style.background='transparent';};
        button.onclick=()=>{input.value=value;refresh();input.dispatchEvent(new Event('change',{bubbles:true}));onChange(value);close();if(previousFocus?.isConnected)previousFocus.focus();};grid.append(button);
      }
      panel.append(grid);exit.focus();
    };draw();
  };
  return {refresh,close};
}
