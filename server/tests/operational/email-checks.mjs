import net from 'node:net';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// SMTP descartável; apenas loopback, sem entrega externa e sem credenciais reais.
export async function startTestSmtp() {
 const messages=[];let reject=false;
 const sockets=new Set();
 const server=net.createServer(socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
  let buffer='',dataMode=false;
  socket.write('220 local-test ESMTP\r\n');
  socket.on('data',chunk=>{
   buffer+=chunk.toString();
   while(true){
    if(dataMode){const end=buffer.indexOf('\r\n.\r\n');if(end<0)return;messages.push(buffer.slice(0,end));buffer=buffer.slice(end+5);dataMode=false;socket.write('250 queued locally\r\n');continue;}
    const end=buffer.indexOf('\r\n');if(end<0)return;const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
    if(/^EHLO/i.test(line))socket.write('250-local-test\r\n250 AUTH PLAIN\r\n');
    else if(/^AUTH /i.test(line))socket.write('235 authenticated\r\n');
    else if(/^DATA/i.test(line)){dataMode=true;socket.write('354 continue\r\n');}
    else if(/^RCPT/i.test(line)&&reject)socket.write('550 rejected for test\r\n');
    else if(/^QUIT/i.test(line)){socket.end('221 bye\r\n');return;}
    else socket.write('250 OK\r\n');
   }
  });
 });
 await new Promise(resolve=>server.listen(25259,'127.0.0.1',resolve));
 return {messages,setReject:value=>{reject=value;},stop:async()=>{for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));}};
}
export function parseMail(raw){
 const decoded=raw.replace(/=\r\n/g,'').replace(/=([A-Fa-f0-9]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
 const link=decoded.match(/https?:\/\/[^\s]+\/(?:quick-login|reset-password)[^\s]*/)?.[0];
 assert.ok(link,'Mensagem contém link utilizável');
 return {url:new URL(link),temporaryPassword:decoded.match(/para redefini[^:\r\n]*: ([A-F0-9]+)/)?.[1]};
}
export async function runEmailChecks({api,db,fixture,smtp,check}){
 let loginToken;
 await check('E-mail/API: SMTP real local, hash, destino painel, uso único e audiência',async()=>{
  const response=await api('/auth/login-link','POST',{email:fixture.owner.email,audience:'PANEL'});assert.equal(response.status,200);assert.equal(response.data.token,undefined);
  const {url}=parseMail(smtp.messages.at(-1));assert.equal(url.origin,'http://127.0.0.1:5179');assert.equal(url.pathname,'/quick-login');assert.equal(url.search,'');
  loginToken=new URLSearchParams(url.hash.slice(1)).get('token');assert.ok(loginToken);
  const stored=await db.query('SELECT "tokenHash" FROM "AuthEmailToken" WHERE "userId"=$1',[fixture.owner.id]);assert.equal(stored.rows[0].tokenHash,createHash('sha256').update(loginToken).digest('hex'));assert.notEqual(stored.rows[0].tokenHash,loginToken);
  assert.equal((await api('/auth/login-link/consume','POST',{token:loginToken,audience:'APP'})).status,400);
  const accepted=await api('/auth/login-link/consume','POST',{token:loginToken,audience:'PANEL'});assert.equal(accepted.status,200);assert.equal(accepted.data.user.id,fixture.owner.id);
  assert.equal((await api('/auth/login-link/consume','POST',{token:loginToken,audience:'PANEL'})).status,400);
 });
 await check('E-mail/API: endereço ausente e perfil incompatível não recebem links; expiração bloqueada',async()=>{
  const count=smtp.messages.length;
  const unknown=await api('/auth/login-link','POST',{email:'ausente@example.invalid',audience:'PANEL'});assert.equal(unknown.status,200);
  await api('/auth/login-link','POST',{email:fixture.owner.email,audience:'APP',profile:'motorista'});assert.equal(smtp.messages.length,count);
  await api('/auth/login-link','POST',{email:fixture.owner.email,audience:'APP',profile:'cooperativa'});
  const {url}=parseMail(smtp.messages.at(-1));assert.equal(url.origin,'http://127.0.0.1:8089');const token=new URLSearchParams(url.hash.slice(1)).get('token');
  await db.query('UPDATE "AuthEmailToken" SET "expiresAt" = NOW() - INTERVAL \'1 minute\' WHERE "tokenHash"=$1',[createHash('sha256').update(token).digest('hex')]);
  assert.equal((await api('/auth/login-link/consume','POST',{token,audience:'APP'})).status,400);
 });
 await check('Recuperação: senha atual preservada até redefinir, destino painel e consumo único',async()=>{
  assert.equal((await api('/auth/forgot-password','POST',{email:fixture.owner.email,audience:'PANEL'})).status,200);
  const {url,temporaryPassword}=parseMail(smtp.messages.at(-1));assert.equal(url.origin,'http://127.0.0.1:5179');assert.equal(url.pathname,'/reset-password');assert.ok(temporaryPassword);
  assert.equal((await api('/auth/login','POST',{email:fixture.owner.email,password:fixture.password})).status,200);
  const payload={email:fixture.owner.email,token:url.searchParams.get('token'),temporaryPassword,newPassword:'NovaSenhaLocal123',confirmPassword:'NovaSenhaLocal123'};
  assert.equal((await api('/auth/reset-password','POST',{...payload,temporaryPassword:'incorreta'})).status,400);
  assert.equal((await api('/auth/reset-password','POST',payload)).status,200);
  assert.equal((await api('/auth/reset-password','POST',payload)).status,400);
  assert.equal((await api('/auth/login','POST',{email:fixture.owner.email,password:'NovaSenhaLocal123'})).status,200);
 });
 await check('SMTP: rejeição não retorna sucesso, não deixa token válido e preserva senha',async()=>{
  const before=await db.query('SELECT count(*)::int AS n FROM "AuthEmailToken" WHERE "userId"=$1',[fixture.otherUser.id]);
  smtp.setReject(true);
  try{assert.equal((await api('/auth/login-link','POST',{email:fixture.otherUser.email,audience:'PANEL'})).status,503);}
  finally{smtp.setReject(false);}
  const after=await db.query('SELECT count(*)::int AS n FROM "AuthEmailToken" WHERE "userId"=$1',[fixture.otherUser.id]);assert.equal(after.rows[0].n,before.rows[0].n);
  assert.equal((await api('/auth/login','POST',{email:fixture.otherUser.email,password:fixture.password})).status,200);
 });
}
