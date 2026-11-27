export function sessionTimeout(promise,ms=20000,message='The request timed out. Check your connection and try again.'){
 let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Error(message);error.code='auth/session-timeout';reject(error);},ms);});
 return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
