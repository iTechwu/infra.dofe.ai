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
