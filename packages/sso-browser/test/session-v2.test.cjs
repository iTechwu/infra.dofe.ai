const {test}=require('node:test');const assert=require('node:assert/strict');
const {BrowserSessionV2}=require('../dist/session-v2');
function setup(options={}){
 const calls=[];const fetch=async(input,init={})=>{
  const path=new URL(input).pathname;calls.push(path);const body=init.body?JSON.parse(init.body):{};
  if(path.endsWith('/logout-complete')){if(options.logoutFailure){options.logoutFailure=false;return Response.json({error:'temporarily_unavailable'},{status:503});}return Response.json({logged_out:true});}
  if(path.endsWith('/logout-cookie-confirm'))return Response.json({confirmed:!options.logoutCookieRejected});
  if(path.endsWith('/logout-confirm'))return Response.json({logged_out:true});
  if(path.endsWith('/logout'))return Response.json({logout_ticket:'logout-ticket',session_context:options.context??'browser'});
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+10000});
  if(path.endsWith('/prepare'))return Response.json({ticket:'ticket',session_context:options.context??'browser'});
  if(path.endsWith('/renew-cookie'))return Response.json({challenge:'challenge'});
  if(path.endsWith('/confirm-cookie'))return Response.json({confirmed:!options.reject,operation_id:options.operation});
  if(path.endsWith('/dispatch'))return Response.json({ok:true});
  throw new Error('Unexpected route');
 };
 const transport=async(input,init)=>{
  if(String(input).endsWith('/prepare'))options.operation=JSON.parse(init.body).operation_id;
  return fetch(input,init);
 };
 return {calls,client:new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport})};
}
test('mounted transport preserves business bytes while signing canonical resource paths',async()=>{
 for(const [mount,canonical] of [['/hz/ai/api','/api'],['/hz/plugins/api','/plugins/api']]){
  const calls=[];let operation;let envelope;
  const client=new BrowserSessionV2({apiBaseUrl:`https://ixicai.example${mount}`,ssoBaseUrl:'https://ixicai.example/hz/user/api',canonicalApiPath:canonical,fetch:async(url,init={})=>{
   calls.push(String(url));const path=new URL(url).pathname;const body=init.body?JSON.parse(init.body):{};
   if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+100000});
   if(path.endsWith('/prepare')){operation=body.operation_id;envelope=body.request;return Response.json({session_context:'browser',ticket:'ticket'});}
   if(path.endsWith('/renew-cookie'))return Response.json({challenge:'challenge'});
   if(path.endsWith('/confirm-cookie'))return Response.json({confirmed:true,operation_id:operation});
   if(path.endsWith('/dispatch')){assert.deepEqual(body.request,envelope);return Response.json({ok:true});}
   throw new Error('unexpected transport');
  }});
  await client.fetch(`https://ixicai.example${mount}/items?filter=a%2Fb&x=1&x=2`,{method:'POST',body:'exact bytes',headers:{'idempotency-key':'fixed-business'}});
  assert.equal(envelope.path,`${canonical}/items?filter=a%2Fb&x=1&x=2`);assert.equal(atob(envelope.body),'exact bytes');assert.equal(envelope.headers['idempotency-key'],'fixed-business');
  assert(calls.every(url=>url.startsWith(`https://ixicai.example${mount}/auth/`)||url.startsWith('https://ixicai.example/hz/user/api/auth/')));
 }
});
test('alias mount and upload exceptions never admit another origin or a neighbouring mount',async()=>{
 let calls=0;const client=new BrowserSessionV2({apiBaseUrl:'https://ixicai.example/hz/ai/api',ssoBaseUrl:'https://ixicai.example/hz/user/api',canonicalApiPath:'/api',uploadProxyPath:'/hz/ai/sso-upload',fetch:async()=>{calls++;throw new Error('must not authenticate');}});
 for(const target of ['https://evil.example/hz/ai/sso-upload/api/uploader/token/private','https://ixicai.example/hz/ai/api-extra/items','https://ixicai.example/hz/ds/api/items','https://ixicai.example/api/items','https://ixicai.example/hz/ai/api/../../ds/api/items'])
  await assert.rejects(client.fetch(target),e=>e.code==='request_origin_rejected');
 assert.equal(calls,0);
 for(const prefix of ['https://evil.example/api','/api?query','/api/../internal','//api','/api//x','/api%2fx'])
  assert.throws(()=>new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',canonicalApiPath:prefix}),e=>e.code==='invalid_canonical_api_path');
});
test('browser dispatch runs only after central-cookie confirmation',async()=>{
 const s=setup();await s.client.fetch('https://rp.example/api/items',{method:'POST',body:'hi'});
 assert.deepEqual(s.calls,['/api/auth/session/v2/status','/api/auth/session/v2/prepare','/api/auth/session/renew-cookie','/api/auth/session/v2/confirm-cookie','/api/auth/session/v2/dispatch']);
});
test('failed cookie confirmation cannot execute business',async()=>{
 const s=setup({reject:true});await assert.rejects(s.client.fetch('https://rp.example/api/items'),/cookie_confirmation_required/);assert(!s.calls.some(p=>p.endsWith('/dispatch')));
});
test('unknown or browser-forged context cannot downgrade the central-cookie gate',async()=>{
 const s=setup({context:'anything'});await assert.rejects(s.client.fetch('https://rp.example/api/items',{headers:{'x-session-context':'native'}}),/invalid_session_context/);assert(!s.calls.some(p=>p.endsWith('/dispatch')));
});
test('authoritative native RP bootstrap does not manufacture a central browser cookie',async()=>{
 const s=setup({context:'native'});await s.client.fetch('https://rp.example/api/items');assert(!s.calls.some(p=>p.endsWith('/renew-cookie')));assert(s.calls.some(p=>p.endsWith('/dispatch')));
});
test('arbitrary external targets are rejected before any authentication request',async()=>{
 const s=setup();await assert.rejects(s.client.fetch('https://attacker.example/api/items'),/request_origin_rejected/);assert.equal(s.calls.length,0);
});

test('native logout never touches an unrelated central browser identity',async()=>{
 const s=setup({context:'native'});await s.client.status();await s.client.logout();assert(!s.calls.some(p=>p.endsWith('/logout-complete')));assert(s.calls.some(p=>p.endsWith('/logout-confirm')));assert.equal((await s.client.status()).authenticated,false);
});
test('browser logout confirmation failure retains RP recovery and retries completion',async()=>{
 const s=setup({logoutFailure:true});await s.client.status();await assert.rejects(s.client.logout(),e=>e.status===503);assert(!s.calls.some(p=>p.endsWith('/logout-confirm')));
 await s.client.logout();assert.equal(s.calls.filter(p=>p.endsWith('/logout-complete')).length,2);assert(s.calls.some(p=>p.endsWith('/logout-confirm')));
});

test('RP logout remains recoverable until SSO verifies the new suppression cookie',async()=>{
 const s=setup({logoutCookieRejected:true});await s.client.status();await assert.rejects(s.client.logout(),e=>e.status===409);assert(!s.calls.some(p=>p.endsWith('/logout-confirm')));
});

test('safe prepared recovery uses a fresh rotation op with unchanged business bytes and idempotency key',async()=>{
 const prepares=[];let dispatch;let latest;
 const fetch=async(url,init={})=>{const path=new URL(url).pathname;const body=init.body?JSON.parse(init.body):{};
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){prepares.push(body);latest=body.operation_id;if(prepares.length===1)return Response.json({error:'operation_expired_retry'},{status:409});return Response.json({session_context:'browser',ticket:'renew'});}
  if(path.endsWith('/renew-cookie'))return Response.json({challenge:'challenge'});
  if(path.endsWith('/confirm-cookie'))return Response.json({confirmed:true,operation_id:latest});
  if(path.endsWith('/dispatch')){dispatch=body;return Response.json({ok:true});}throw new Error('unexpected path');
 };
 const client=new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch});
 await client.fetch('https://rp.example/api/items',{method:'POST',headers:{'x-idempotency-key':'business-key'},body:'exact bytes'});
 assert.equal(prepares.length,2);assert.notEqual(prepares[0].operation_id,prepares[1].operation_id);assert.deepEqual(prepares[0].request,prepares[1].request);assert.equal(dispatch.operation_id,prepares[1].operation_id);assert.equal(dispatch.request.headers['x-idempotency-key'],'business-key');
});
test('an already dispatched or unknown outcome is never automatically prepared with another op',async()=>{
 for(const phase of ['prepare','dispatch']){
  let prepares=0,dispatches=0;
  const fetch=async(url,init={})=>{const path=new URL(url).pathname;
   if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+100000});
   if(path.endsWith('/prepare')){prepares++;if(phase==='prepare')return Response.json({error:'operation_already_dispatched'},{status:409});return Response.json({session_context:'native'});}
   if(path.endsWith('/dispatch')){dispatches++;return Response.json({error:'operation_expired_retry'},{status:409});}throw new Error('unexpected path');
  };
  const client=new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch});
  if(phase==='prepare')await assert.rejects(client.fetch('https://rp.example/api/items',{method:'POST',body:'side effect'}),/operation_already_dispatched/);
  else assert.equal((await client.fetch('https://rp.example/api/items',{method:'POST',body:'side effect'})).status,409);
  assert.equal(prepares,1);assert.equal(dispatches,phase==='prepare'?0:1);
 }
});

test('real business headers are bound while credentials and forged authority headers are removed',async()=>{
 let envelope;
 const fetch=async(url,init={})=>{const p=new URL(url).pathname;
  if(p.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+100000});
  if(p.endsWith('/prepare')){envelope=JSON.parse(init.body).request;return Response.json({session_context:'native'});}
  return Response.json({ok:true});
 };
 const client=new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch});
 await client.fetch('https://rp.example/api/items',{method:'POST',headers:{'idempotency-key':'original-business-key','anthropic-version':'2023-06-01','x-current-tenant':'selected-member-tenant','x-knowledge-tenant':'knowledge-scope',accept:'application/json','content-type':'application/json',cookie:'must-drop',authorization:'Bearer must-drop','x-sso-service-token':'must-drop','x-workspace-admin':'true','x-tenant-id':'forged-tenant','if-match':'not-used'},body:'{}'});
 assert.equal(envelope.headers['idempotency-key'],'original-business-key');assert.equal(envelope.headers['anthropic-version'],'2023-06-01');assert.equal(envelope.headers['x-current-tenant'],'selected-member-tenant');assert.equal(envelope.headers['x-knowledge-tenant'],'knowledge-scope');
 for(const name of ['cookie','authorization','x-sso-service-token','x-workspace-admin','x-tenant-id','if-match'])assert.equal(envelope.headers[name],undefined);
});
test('deployment envelopes that keep only msg still surface retryable session codes',async()=>{
 let prepares=0,dispatches=0;
 const fetch=async(url,init={})=>{const path=new URL(url).pathname;
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'csrf',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){prepares++;if(prepares===1)return Response.json({code:409,msg:'session_busy',traceId:'t'},{status:409});return Response.json({session_context:'native',idle_expires_at:Date.now()+100000});}
  if(path.endsWith('/dispatch')){dispatches++;return Response.json({ok:true});}throw new Error('unexpected path');
 };
 const client=new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch});
 const response=await client.fetch('https://rp.example/api/items');
 assert.equal(response.status,200);assert.equal(prepares,2);assert.equal(dispatches,1);
});

test('a page request burst queues cookie renewal instead of generating session_busy retries',async()=>{
 let owner,conflicts=0,dispatches=0;
 const transport=async(url,init={})=>{
  const route=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  if(route.endsWith('/status'))return Response.json({authenticated:true,csrf:'fixture-csrf',idle_expires_at:Date.now()+100000});
  if(route.endsWith('/prepare')){
   if(owner){conflicts++;return Response.json({msg:'session_busy'},{status:409});}
   owner=body.operation_id;await new Promise(resolve=>setTimeout(resolve,10));
   return Response.json({session_context:'browser',ticket:owner});
  }
  if(route.endsWith('/renew-cookie'))return Response.json({challenge:body.ticket});
  if(route.endsWith('/confirm-cookie')){assert.equal(body.challenge,owner);owner=undefined;return Response.json({confirmed:true,operation_id:body.challenge});}
  if(route.endsWith('/dispatch')){dispatches++;return Response.json({ok:true});}
  throw new Error('unexpected route');
 };
 const client=new BrowserSessionV2({apiBaseUrl:'https://rp.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const responses=await Promise.all(Array.from({length:8},(_,i)=>client.fetch(`https://rp.example/api/items/${i}`)));
 assert(responses.every(response=>response.status===200));assert.equal(dispatches,8);
 assert.equal(conflicts,0,'ordinary concurrent requests must not turn into a prepare retry storm');
});

test('queued cancellation makes no auth request and a failed owner releases the next turn',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});const paths=[];
 const transport=async(url,init={})=>{
  const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'fixture-csrf',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){paths.push(body.request.path);if(body.request.path.endsWith('/first')){entered();await gate;throw new Error('fixture failure');}return Response.json({session_context:'native'});}
  return Response.json({ok:true});
 };
 const a=new BrowserSessionV2({apiBaseUrl:'https://cancel.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const b=new BrowserSessionV2({apiBaseUrl:'https://cancel.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const first=a.fetch('https://cancel.example/api/first');const failure=assert.rejects(first,/fixture failure/);await started;
 const controller=new AbortController(),cancelled=b.fetch('https://cancel.example/api/cancelled',{signal:controller.signal});controller.abort();
 await assert.rejects(cancelled,error=>error.name==='AbortError');
 const next=b.fetch('https://cancel.example/api/next');release();await failure;
 assert.equal((await next).status,200);assert.deepEqual(paths,['/api/first','/api/next']);
});

test('a streaming response releases admission at headers and another RP is independent',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 const transport=async(url,init={})=>{
  const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'fixture-csrf',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){if(body.request.path.endsWith('/slow')){entered();await gate;}return Response.json({session_context:'native'});}
  return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));}}),{headers:{'content-type':'text/event-stream'}});
 };
 const a=new BrowserSessionV2({apiBaseUrl:'https://stream.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const b=new BrowserSessionV2({apiBaseUrl:'https://other.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const first=a.fetch('https://stream.example/api/slow');await started;
 const other=await b.fetch('https://other.example/api/independent');release();const stream=await first;
 const next=await a.fetch('https://stream.example/api/next');assert.equal(next.status,200);
 await Promise.all([other.body.cancel(),stream.body.cancel(),next.body.cancel()]);
});

test('Web Locks coordinate tabs using the RP address without credentials',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),locks=[];
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(name,options,run)=>{locks.push({name,signal:options.signal});return run();}}}});
 try{
  const s=setup({context:'native'});await s.client.fetch('https://rp.example/api/items');
  assert.equal(locks.length,1);assert.equal(locks[0].name,'dofe:session-v2:https://rp.example/api/auth/session/v2');assert(locks[0].signal instanceof AbortSignal);
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('a page burst shares one preparation and cookie confirmation while dispatching each request independently',async()=>{
 const calls=[],dispatches=[];let windowId;
 const transport=async(url,init={})=>{
  const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};calls.push(path);
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'window-fixture',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){assert.equal(body.coordination,'session-window-v1');windowId=body.operation_id;await new Promise(r=>setTimeout(r,10));return Response.json({session_context:'browser',ticket:'fixture',session_window:{id:windowId,expires_at:Date.now()+60000}});}
  if(path.endsWith('/renew-cookie'))return Response.json({challenge:'fixture'});
  if(path.endsWith('/confirm-cookie'))return Response.json({confirmed:true,operation_id:windowId});
  if(path.endsWith('/dispatch')){assert.equal(body.session_window,windowId);dispatches.push(body);return Response.json({ok:true});}
  throw new Error('unexpected route');
 };
 const a=new BrowserSessionV2({apiBaseUrl:'https://window.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const b=new BrowserSessionV2({apiBaseUrl:'https://window.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const responses=await Promise.all(Array.from({length:20},(_,i)=>(i%2?a:b).fetch('https://window.example/api/items/'+i)));
 assert(responses.every(r=>r.ok));for(const step of ['prepare','renew-cookie','confirm-cookie'])assert.equal(calls.filter(p=>p.endsWith('/'+step)).length,1,step+' must be shared across the page');
 assert.equal(new Set(dispatches.map(d=>d.operation_id)).size,20);assert.equal(new Set(dispatches.map(d=>d.request.path)).size,20);
});

test('only an explicit pre-dispatch window expiry renews once; unknown outcomes never replay',async()=>{
 for(const outcome of ['session_window_expired','dispatch_outcome_unknown']){
  let prepares=0,dispatches=0;const operations=[];
  const transport=async(url,init={})=>{const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
   if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'expiry-fixture',idle_expires_at:Date.now()+100000});
   if(path.endsWith('/prepare')){prepares++;return Response.json({session_context:'native',session_window:{id:body.operation_id,expires_at:Date.now()+60000}});}
   if(path.endsWith('/dispatch')){operations.push(body.operation_id);dispatches++;return dispatches===1?Response.json({msg:outcome},{status:409}):Response.json({ok:true});}
   throw new Error('unexpected route');};
  const client=new BrowserSessionV2({apiBaseUrl:`https://${outcome}.example/api`,ssoBaseUrl:'https://sso.example/api',fetch:transport});
  const response=await client.fetch(`https://${outcome}.example/api/write`,{method:'POST',body:'exact bytes',headers:{'idempotency-key':'business'}});
  assert.equal(prepares,outcome==='session_window_expired'?2:1);assert.equal(dispatches,prepares);assert.equal(response.status,outcome==='session_window_expired'?200:409);
  if(operations.length===2)assert.equal(operations[0],operations[1]);
 }
});
test('a slow dispatch cannot hold shared preparation or block another business request',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);let prepares=0;
 const transport=async(url,init={})=>{const path=new URL(url).pathname,body=init.body?JSON.parse(init.body):{};
  if(path.endsWith('/status'))return Response.json({authenticated:true,csrf:'slow-fixture',idle_expires_at:Date.now()+100000});
  if(path.endsWith('/prepare')){prepares++;return Response.json({session_context:'native',session_window:{id:body.operation_id,expires_at:Date.now()+60000}});}
  if(body.request.path.endsWith('/slow')){entered();await gate;}return Response.json({ok:true});};
 const client=new BrowserSessionV2({apiBaseUrl:'https://slow-window.example/api',ssoBaseUrl:'https://sso.example/api',fetch:transport});
 const slow=client.fetch('https://slow-window.example/api/slow');await started;
 try{const fast=await Promise.race([client.fetch('https://slow-window.example/api/fast'),new Promise((_,reject)=>setTimeout(()=>reject(Error('blocked by slow dispatch')),500))]);assert.equal(fast.status,200);assert.equal(prepares,1);}finally{release();await slow;}
});
