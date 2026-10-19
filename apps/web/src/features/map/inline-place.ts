import { validCoordinates } from './viewport';

export function inlinePlacePayload(title:string,position:[number,number]){
 if(!title.trim()||title.length>200)throw new Error('Введи название до 200 символов.');
 if(!validCoordinates(position[0],position[1]))throw new Error('Выбери точку на карте ещё раз.');
 return {place:{title:title.trim().replace(/\s+/g,' '),longitude:position[0],latitude:position[1]}};
}

export function createInlinePlaceEditor(save:(title:string)=>Promise<void>,onResize:()=>void){
 const form=document.createElement('form');form.className='inline-place-form';
 const label=document.createElement('label');label.textContent='Название места';
 const input=document.createElement('textarea');input.rows=1;input.maxLength=200;input.placeholder='Например, любимая кофейня';input.enterKeyHint='done';input.setAttribute('aria-label','Название места');
 label.append(input);
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Добавить точку';submit.disabled=true;
 const error=document.createElement('p');error.className='inline-place-error';error.setAttribute('role','alert');error.hidden=true;
 form.append(label,error,submit);
 let busy=false,disposed=false;
 const resize=()=>{input.style.height='0px';input.style.height=`${Math.min(180,input.scrollHeight)}px`;onResize();};
 input.oninput=()=>{submit.disabled=busy||!input.value.trim();error.hidden=true;resize();};
 input.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!busy&&input.value.trim())form.requestSubmit();}};
 form.onsubmit=event=>{event.preventDefault();if(busy||!input.value.trim())return;busy=true;submit.disabled=true;input.disabled=true;submit.textContent='Сохраняем…';error.hidden=true;
  void save(input.value).then(()=>{if(disposed)return;const done=document.createElement('p');done.className='inline-place-success';done.setAttribute('role','status');done.textContent='✓ Место добавлено';form.replaceChildren(done);onResize();}).catch(failure=>{if(disposed)return;busy=false;input.disabled=false;submit.disabled=!input.value.trim();submit.textContent='Добавить точку';error.textContent=failure instanceof Error?failure.message:'Не удалось сохранить. Попробуй ещё раз.';error.hidden=false;onResize();input.focus({preventScroll:true});});
 };
 return {element:form,focus:()=>{input.focus({preventScroll:true});resize();},dispose:()=>{disposed=true;}};
}
