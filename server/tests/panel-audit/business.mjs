import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import fs from 'node:fs';
export async function run({fixture:f,api,test,page,context,go,out,results}){
 const ok=async(url,method='GET',body,token)=>{const r=await api(url,method,body,token);assert(r.status>=200&&r.status<300,`${method} ${url}: ${r.status} ${JSON.stringify(r.data).slice(0,900)}`);return r.data;};
 const reject=async(url,method,body,token)=>{const r=await api(url,method,body,token);assert(r.status>=400&&r.status<500,`${method} ${url}: deveria rejeitar, retornou ${r.status} ${JSON.stringify(r.data).slice(0,600)}`);return r;};
 const data=(r,key)=>r?.[key]||r?.data||r;const button=name=>page.getByRole('button',{name,exact:true});
 const people=(await ok('/collectors')).collectors,driverId=f.fieldMeeting.driver,catId=f.fieldMeeting.collector,memberId=people.find(c=>c.id!==catId&&c.status!=='INACTIVE')?.id;
 const day='10/11/2026',iso='2026-11-10T13:00:00.000Z';let created={};
 function cpf(base){let s=base;for(let j=0;j<2;j++){let sum=0;for(let i=0;i<s.length;i++)sum+=Number(s[i])*(s.length+1-i);let d=(sum*10)%11;s+=d===10?'0':String(d);}return s;}
 const generatorBody={type:'SMALL',name:'Gerador auditoria painel QA',documentNumber:cpf('314159265'),email:'panel-generator@test.invalid',street:'Rua Auditoria',number:'10',city:'Fortaleza',state:'CE',latitude:-3.74,longitude:-38.52};
 const basic=[
 {key:'gerador',name:'Gerador residencial cadastrado por CPF',url:'/generators',entity:'generator',body:generatorBody,invalid:{...generatorBody,email:'incorreto'},duplicate:()=>({...generatorBody,email:'duplicate-panel-generator@test.invalid'}),patch:()=>({name:'Gerador auditoria atualizado QA',phone:'85999990000'}),check:(x)=>assert.equal(x.phone,'85999990000')},
 {key:'catador',name:'Catador',url:'/collectors',entity:'collector',body:{name:'Catador auditoria painel QA',email:'panel-collector@test.invalid',isAutonomous:true,registrationNumber:'AUD-001'},invalid:{name:'A',email:'invalido'},patch:()=>({name:'Catador auditoria atualizado QA',phone:'85988880000'}),check:x=>assert.equal(x.phone,'85988880000')},
 {key:'motorista',name:'Motorista',url:'/drivers',entity:'driver',body:{name:'Motorista auditoria painel QA',email:'panel-driver@test.invalid',phone:'85977770000'},invalid:{name:'   ',email:'spaces-panel-driver@test.invalid'},patch:()=>({phone:'85977771111',name:'Motorista auditoria atualizado QA'}),check:x=>assert.equal(x.phone,'85977771111')},
 {key:'veiculo',name:'Veículo',url:'/vehicles',entity:'vehicle',body:{plate:'AUD1A23',model:'Caminhão auditoria',capacityKg:1200,driverId},invalid:{plate:'   ',model:'  '},patch:()=>({model:'Caminhão auditoria atualizado',capacityKg:1500}),check:x=>assert.equal(Number(x.capacityKg),1500)},
 {key:'pev',method:'PUT',name:'PEV',url:'/bins',entity:'bin',body:{bin_id:'PEV-AUDITORIA-PAINEL',name:'PEV auditoria painel QA',street:'Rua Auditoria',number:'12',city:'Fortaleza',state:'CE',latitude:-3.75,longitude:-38.53,publicAccess:false,acceptedMaterials:['Papel','Óleo']},invalid:{bin_id:'',capacity_kg:-10},patch:()=>({name:'PEV auditoria atualizado QA',needsPickup:true,pickupReason:'Material acumulado no teste'}),check:x=>assert.equal(x.needsPickup,true)},
 {key:'rota',name:'Rota programada',url:'/routes',entity:'route',body:{name:'Rota auditoria painel QA',scheduledDate:day,stops:['Bairro Auditoria']},invalid:{name:'A',scheduledDate:'31/02/2026'},duplicate:()=>({name:'Rota com coleta repetida QA',collectionIds:[f.normal,f.normal]}),patch:()=>({name:'Rota auditoria atualizada QA'}),check:x=>assert.equal(x.name,'Rota auditoria atualizada QA')},
 {key:'catalogo',name:'Material do catálogo',url:'/waste-stock/items',entity:'item',body:{name:'Papel auditoria painel QA',category:'Reciclável',unit:'KG',internalCode:'AUD-PAINEL-KG'},invalid:{name:'A',category:''},duplicate:()=>({name:'Outro material repetido QA',category:'Reciclável',unit:'KG',internalCode:'AUD-PAINEL-KG'}),patch:()=>({description:'Descrição atualizada na auditoria'}),check:x=>assert.equal(x.description,'Descrição atualizada na auditoria')},
 ];

 function cnpj(base){let s=base;for(const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]){const r=[...s].reduce((n,c,i)=>n+Number(c)*weights[i],0)%11;s+=String(r<2?0:11-r);}return s;}
 for(const [key,type,document,category,label] of [['gerador-cnpj','SMALL',cnpj('314159260001'),'SMALL_BUSINESS','Pequeno gerador por CNPJ'],['grande-gerador','LARGE',cnpj('271828180001'),'LARGE','Grande gerador por CNPJ']]){
   const body={...generatorBody,type,documentNumber:document,name:label+' auditoria QA',email:key+'@panel.test.invalid'};
   basic.push({...basic[0],key,name:label,category,body,invalid:{...body,email:'invalido'},duplicate:()=>({...body,email:'duplicado-'+key+'@panel.test.invalid'})});
 }
 for(let i=0;i<basic.length;i++){
  const c=basic[i],prefix='CAD-'+c.key;
  await test(prefix+'-1','cadastros',c.name+' — criar e consultar persistência (API do painel)',async()=>{const x=data(await ok(c.url,'POST',c.body),c.entity);assert(x.id);created[c.key]=x;const got=data(await ok(c.url+'/'+x.id),c.entity);assert.equal(got.id,x.id);if(c.category)assert.equal(got.registrationCategory,c.category);});
  await test(prefix+'-2','cadastros',c.name+' — dados inválidos não criam registro',async()=>{await reject(c.url,'POST',c.invalid);});
  await test(prefix+'-3','cadastros',c.name+' — duplicidade ou vínculo repetido é tratado',async()=>{if(c.key==='pev'){await reject(c.url,'POST',c.body);return;}await reject(c.url,'POST',c.duplicate?c.duplicate():c.body);});
  await test(prefix+'-4','cadastros',c.name+' — corrigir dados e preservar campos existentes',async()=>{const old=created[c.key];assert(old);const x=data(await ok(c.url+'/'+old.id,c.method||'PATCH',c.patch()),c.entity);assert.equal(x.id,old.id);c.check(data(await ok(c.url+'/'+old.id),c.entity));});
  await test(prefix+'-5','cadastros',c.name+' — impedir consulta por outra cooperativa',async()=>{assert(f.audit?.foreignToken);await reject(c.url+'/'+created[c.key].id,'GET',undefined,f.audit.foreignToken);});
 }
 const base={name:'Sede auditoria QA',address:'Rua Sede, 10, Fortaleza',latitude:-3.73,longitude:-38.52},point={...base,key:'house-audit',kind:'ADDRESS',name:'Casa Auditoria',address:'Rua Auditoria, 25, Fortaleza'};
 const plan={name:'Diária auditoria painel QA',startsOn:'2026-11-06',endsOn:'2026-11-07',weekdays:[0,1,2,3,4,5,6],departureTime:'08:00',collectorIds:[catId],points:[point],startPoint:base,endPoint:base};
 const extended=[
 {key:'plano',listOnly:true,name:'Rota fixa diária',url:'/route-plans',entity:'plan',body:plan,invalid:{...plan,points:[]},adverse:{...plan,points:[point,point]},patch:old=>({...plan,name:'Diária atualizada QA',expectedVersion:old.version}),check:x=>assert.equal(x.name,'Diária atualizada QA')},
 {key:'equipe',name:'Equipe de catadores',url:'/collector-teams',entity:'team',body:{name:'Equipe auditoria painel QA',active:true,memberIds:[catId,memberId]},invalid:{name:'Equipe inválida',active:true,memberIds:[catId]},adverse:{name:'Equipe repetida',active:true,memberIds:[catId,catId]},patch:old=>({name:'Equipe auditoria atualizada QA',active:false,memberIds:[catId,memberId],expectedVersion:old.version}),check:x=>assert.equal(x.active,false),listOnly:true},
 {key:'entregador',name:'Entregador avulso',url:'/intake-deliverers',entity:null,body:{operationId:randomUUID(),name:'Entregador auditoria painel QA'},invalid:{operationId:randomUUID(),name:''},replay:true,patch:old=>({name:'Entregador auditoria atualizado QA',phone:'85966660000',expectedVersion:old.version}),check:x=>assert.equal(x.phone,'85966660000'),listOnly:true},
 ];
 for(const c of extended){const prefix='CAD-'+c.key;
 const entity=r=>c.entity?data(r,c.entity):r.person||r;
 const read=async()=>c.listOnly?(c.key==='equipe'?(await ok(c.url)).teams:c.key==='plano'?(await ok(c.url)).plans:(await ok(c.url)).items).find(x=>x.id===created[c.key].id):entity(await ok(c.url+'/'+created[c.key].id));
 await test(prefix+'-1','cadastros',c.name+' — criar cadastro completo',async()=>{created[c.key]=entity(await ok(c.url,'POST',c.body));assert(created[c.key]?.id);});
 await test(prefix+'-2','cadastros',c.name+' — rejeitar mínimo obrigatório ausente',async()=>{await reject(c.url,'POST',c.invalid);});
 await test(prefix+'-3','cadastros',c.name+' — repetição segura ou participantes/pontos duplicados',async()=>{if(c.replay){const replay=entity(await ok(c.url,'POST',c.body));assert.equal(replay.id,created[c.key].id);}else await reject(c.url,'POST',c.adverse);});
 await test(prefix+'-4','cadastros',c.name+' — editar usando versão atual',async()=>{await ok(c.url+'/'+created[c.key].id,'PATCH',c.patch(created[c.key]));c.check(await read());});
 await test(prefix+'-5','cadastros',c.name+' — rejeitar versão antiga sem sobrescrever',async()=>{await reject(c.url+'/'+created[c.key].id,'PATCH',c.patch(created[c.key]));});}
 const item=created.catalogo,vehicle=created.veiculo;
 const lotUrl='/waste-stock/items/'+item?.id+'/lots';
 await test('CAD-lote-1','cadastros','Lote — entrada manual gera código e saldo',async()=>{created.lote=(await ok(lotUrl,'POST',{quantity:50,unit:'KG',origin:'Auditoria painel'})).lot;assert(created.lote.id);assert(created.lote.code||created.lote.lotCode);assert.equal(Number(created.lote.availableQuantity),50);});
 await test('CAD-lote-2','cadastros','Lote — quantidade negativa é rejeitada',async()=>{await reject(lotUrl,'POST',{quantity:-1});});
 await test('CAD-lote-3','cadastros','Lote — unidade incompatível com catálogo é rejeitada',async()=>{await reject(lotUrl,'POST',{quantity:10,unit:'LITER'});});
 await test('CAD-lote-4','cadastros','Lote — editar localização sem alterar origem/quantidade',async()=>{const id=created.lote.id;await ok('/waste-stock/lots/'+id,'PATCH',{storageLocation:'Galpão Auditoria'});const x=(await ok('/waste-workspace/lots/'+id)).lot;assert.equal(x.storageLocation,'Galpão Auditoria');assert.equal(Number(x.availableQuantity),50);});
 await test('CAD-lote-5','cadastros','Lote — outra cooperativa não acessa entrada',async()=>{await reject('/waste-workspace/lots/'+created.lote.id,'GET',undefined,f.audit.foreignToken);});
 const maintenance={vehicle_id:vehicle?.id,maintenance_type:'preventive',maintenance_date:'2026-11-04',cost:125.5,notes:'Revisão auditoria',status:'completed'};
 await test('CAD-manutencao-1','cadastros','Manutenção — criar data, custo e observação',async()=>{created.manutencao=data(await ok('/maintenance-logs','POST',maintenance),'log');assert(created.manutencao.id);});
 await test('CAD-manutencao-2','cadastros','Manutenção — custo negativo é bloqueado',async()=>{await reject('/maintenance-logs','POST',{...maintenance,cost:-1});});
 await test('CAD-manutencao-3','cadastros','Manutenção — próxima data anterior à manutenção é bloqueada',async()=>{await reject('/maintenance-logs','POST',{...maintenance,next_maintenance_date:'2026-10-01'});});
 await test('CAD-manutencao-4','cadastros','Manutenção — editar observação preserva data e veículo',async()=>{await ok('/maintenance-logs/'+created.manutencao.id,'PUT',{notes:'Observação atualizada QA',cost:0});const x=data(await ok('/maintenance-logs/'+created.manutencao.id),'log');assert.equal(x.notes||x.note,'Observação atualizada QA');assert.equal(Number(x.cost),0);});
 await test('CAD-manutencao-5','cadastros','Manutenção — outra cooperativa não acessa registro',async()=>{await reject('/maintenance-logs/'+created.manutencao.id,'GET',undefined,f.audit.foreignToken);});

 const vehicleDoc={vehicle_id:vehicle.id,document_type:'Licenciamento',document_number:'DOC-AUD-2026',issue_date:'2026-11-04',expiry_date:'2027-11-04'};let documentRegister;
 await test('CAD-documento-veiculo-1','cadastros','Registro documental do veículo — criar identificação, emissão e validade',async()=>{documentRegister=data(await ok('/vehicle-documents','POST',vehicleDoc),'document');assert(documentRegister.id);});
 await test('CAD-documento-veiculo-2','cadastros','Registro documental do veículo — número obrigatório',()=>reject('/vehicle-documents','POST',{...vehicleDoc,document_number:''}));
 await test('CAD-documento-veiculo-3','cadastros','Registro documental do veículo — validade anterior à emissão é rejeitada',()=>reject('/vehicle-documents','POST',{...vehicleDoc,expiry_date:'2025-11-04'}));
 await test('CAD-documento-veiculo-4','cadastros','Registro documental do veículo — edição preserva titular e número',async()=>{await ok('/vehicle-documents/'+documentRegister.id,'PUT',{notes:'Documento conferido na auditoria'});const x=data(await ok('/vehicle-documents/'+documentRegister.id),'document');assert.equal(x.notes,'Documento conferido na auditoria');assert.equal(x.document_number||x.documentNumber,vehicleDoc.document_number);});
 await test('CAD-documento-veiculo-5','cadastros','Registro documental do veículo — outra cooperativa não acessa registro',()=>reject('/vehicle-documents/'+documentRegister.id,'GET',undefined,f.audit.foreignToken));
 // The four document registries accept a real multipart PDF and restrict every owner scope.
 for(const [kind,entityKey] of [['collector','catador'],['driver','motorista'],['generator','gerador'],['vehicle','veiculo']]){
  const ownerId=created[entityKey]?.id,pre='CAD-doc-'+kind;let doc;
  async function upload(overrides={}){const body=new FormData();for(const [k,v] of Object.entries({kind,ownerId,title:'Documento auditoria '+kind,documentType:'Registro interno',issueDate:'2026-11-04',expiryDate:'2027-11-04',...overrides}))body.append(k,v);body.append('file',new Blob(['%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'],{type:'application/pdf'}),'auditoria.pdf');const r=await fetch('http://127.0.0.1:3339/owner-documents',{method:'POST',headers:{authorization:'Bearer '+f.token},body});return {status:r.status,data:await r.json()};}
  await test(pre+'-1','cadastros','Documento '+kind+' — enviar PDF para o titular correto',async()=>{const r=await upload();assert(r.status<300,JSON.stringify(r.data));doc=r.data.document||r.data;assert(doc.id);});
  await test(pre+'-2','cadastros','Documento '+kind+' — título obrigatório é validado',async()=>{const r=await upload({title:''});assert.equal(r.status,400);});
  await test(pre+'-3','cadastros','Documento '+kind+' — vencimento anterior à emissão é rejeitado',async()=>{const r=await upload({expiryDate:'2025-11-04'});assert.equal(r.status,400);});
  await test(pre+'-4','cadastros','Documento '+kind+' — arquivo retorna PDF autenticado',async()=>{const r=await fetch('http://127.0.0.1:3339/owner-documents/owner/'+doc.id+'/file',{headers:{authorization:'Bearer '+f.token}});assert.equal(r.status,200);assert((await r.text()).startsWith('%PDF-'));});
  await test(pre+'-5','cadastros','Documento '+kind+' — outra cooperativa não consulta metadados',async()=>{await reject('/owner-documents?'+new URLSearchParams({kind,ownerId}),'GET',undefined,f.audit.foreignToken);});
 }
 const intake=async(extra={})=>(await ok('/material-intakes','POST',{operationId:randomUUID(),kind:'DIRECT',origin:{name:'Entrega auditoria painel QA',description:'Material para conferência'},...extra})).collection;
 const weigh=async c=>await ok('/material-intakes/'+c.id+'/weigh','POST',{operationId:randomUUID(),materials:[{wasteTypeId:item.id,quantity:10,unit:'KG'}]});
 const entryOf=async c=>(await ok('/waste-workspace/collections?q='+c.id)).collections[0].collectionWasteEntries[0];
 let delivery=await intake(),entry;
 const adverseReceive=[
 ['Pesagem sem materiais','/material-intakes/'+delivery.id+'/weigh',{operationId:randomUUID(),materials:[]}],
 ['Quantidade negativa','/material-intakes/'+delivery.id+'/weigh',{operationId:randomUUID(),materials:[{wasteTypeId:item.id,quantity:-1,unit:'KG'}]}],
 ['Entrada direta com rota indevida','/material-intakes',{operationId:randomUUID(),kind:'DIRECT',origin:{name:'Inválida'},routeId:f.route}],
 ['Coleta avulsa sem endereço','/material-intakes',{operationId:randomUUID(),kind:'PICKUP',origin:{name:'Inválida'}}],
 ['Coordenada incompleta','/material-intakes',{operationId:randomUUID(),kind:'PICKUP',origin:{address:'Rua incompleta, 20',latitude:-3.7}}]
 ];for(let i=0;i<5;i++)await test('ADV-recebimento-'+(i+1),'adversos','Recebimento — '+adverseReceive[i][0],async()=>{await reject(adverseReceive[i][1],'POST',adverseReceive[i][2]);});
 await weigh(delivery);entry=await entryOf(delivery);
 const dest={operationId:randomUUID(),collectionWasteEntryId:entry.id,type:'DIRECT_DESTINATION',quantity:10,unit:'KG',destinationName:'Destinatário auditoria'};
 const adverseDest=[['Saldo excedido',{...dest,quantity:11}],['Quantidade zero',{...dest,quantity:0}],['Unidade incompatível',{...dest,unit:'LITER'}],['Destinatário ausente',{...dest,destinationName:''}],['Protocolo ausente',{...dest,operationId:undefined}]];
 for(let i=0;i<5;i++)await test('ADV-destino-'+(i+1),'adversos','Destinação — '+adverseDest[i][0],async()=>{await reject('/collection-waste-destinations','POST',adverseDest[i][1]);assert.equal(Number((await entryOf(delivery)).remainingQuantity),10);});
 const adverseCad=[['CPF inválido','/generators',{...generatorBody,documentNumber:'11111111111',email:'bad-cpf-audit@test.invalid'}],['CNPJ inválido','/generators',{...generatorBody,documentNumber:'00000000000000',email:'bad-cnpj-audit@test.invalid'}],['Coordenada impossível','/bins',{...basic[4].body,bin_id:'BAD-COORD-AUD',latitude:91}],['Capacidade negativa','/vehicles',{plate:'AUD2A23',model:'Caminhão',capacityKg:-1}],['E-mail inválido','/collectors',{name:'Coleta inválida',email:'email'}]];
 for(let i=0;i<5;i++)await test('ADV-cadastro-'+(i+1),'adversos','Cadastro — '+adverseCad[i][0],()=>reject(adverseCad[i][1],'POST',adverseCad[i][2]));
 const scheduleBody={generatorId:created.gerador.id,preferredDate:iso,requestedMaterials:[{wasteTypeId:item.id,unit:'KG',estimatedQuantity:20}]};
 const badRequests=[['Sem material',{...scheduleBody,requestedMaterials:[]}],['Quantidade negativa',{...scheduleBody,requestedMaterials:[{wasteTypeId:item.id,unit:'KG',estimatedQuantity:-1}]}],['Data textual inválida',{...scheduleBody,preferredDate:'data impossível'}],['Coordenada incompleta',{...scheduleBody,pickupLatitude:-3.7}],['Gerador inexistente',{...scheduleBody,generatorId:'inexistente-auditoria'}]];
 for(let i=0;i<5;i++)await test('ADV-solicitacao-'+(i+1),'adversos','Solicitação — '+badRequests[i][0],()=>reject('/schedules','POST',badRequests[i][1]));
 // Ten different operational situations per subject, against the same services used by the panel.
 const ops={catadores:[],geradores:[],rotas:[],motoristas:[],veiculos:[],solicitacoes:[]};let s,c,started,doneEntry,destination;
 ops.geradores.push(['CPF classifica residencial sem conta PF',async()=>{assert.equal(created.gerador.type,'SMALL');assert.equal(created.gerador.documentNumber,generatorBody.documentNumber);}]);
 ops.geradores.push(['CNPJ distingue pequeno gerador no mesmo cadastro',async()=>{const r=(await ok('/generators','POST',{...generatorBody,documentNumber:'11222333000181',name:'Empresa auditoria QA',email:'panel-company@test.invalid'})).generator;assert.equal(r.documentNumber,'11222333000181');}]);
 ops.geradores.push(['Sem acesso ativo não impede cooperativa registrar pedido',async()=>{s=(await ok('/schedules','POST',scheduleBody)).schedule;assert(s.id);}]);
 ops.geradores.push(['Documentação do gerador fica no titular selecionado',async()=>{const d=await ok('/owner-documents?kind=generator&ownerId='+created.gerador.id);assert(d.documents.length>=1);}]);
 ops.geradores.push(['Alterar endereço exige coordenadas em par',()=>reject('/generators/'+created.gerador.id,'PATCH',{latitude:-3.8})]);
 ops.geradores.push(['CPF duplicado não cria segundo gerador',()=>reject('/generators','POST',{...generatorBody,email:'another-panel-gen@test.invalid'})]);
 ops.geradores.push(['Cadastro não aparece para outra cooperativa',async()=>{const r=await ok('/generators','GET',undefined,f.audit.foreignToken);assert(!r.generators.some(x=>x.id===created.gerador.id));}]);
 ops.geradores.push(['Consulta por identificação curta da coleta',async()=>{const r=await ok('/waste-workspace/collections?q='+delivery.id.slice(-8).toUpperCase());assert(r.collections.some(x=>x.id===delivery.id));}]);
 ops.geradores.push(['Histórico não atribui entrada anônima ao gerador',async()=>{const x=(await ok('/collections/'+delivery.id)).collection;assert.equal(x.generatorId,null);}]);
 ops.geradores.push(['Editar nome conserva documento e e-mail',async()=>{const g=(await ok('/generators/'+created.gerador.id)).generator;assert.equal(g.documentNumber,generatorBody.documentNumber);assert.equal(g.email,generatorBody.email);}]);
 for(const [group,tests] of Object.entries(ops))if(group==='geradores')for(let i=0;i<tests.length;i++)await test('OP-'+group+'-'+(i+1),'operacionais',group+' — '+tests[i][0],tests[i][1]);
 const collBody=()=>({scheduleId:s.id,collectorId:created.catador.id,driverId,vehicleId:f.fieldMeeting.vehicle});
 ops.solicitacoes=[
 ['Solicitação com data e material gera registro',async()=>{assert(s.id);const x=(await ok('/schedules/'+s.id)).schedule;assert.equal(x.generatorId,created.gerador.id);}],
 ['Delegação vincula equipe, motorista e veículo',async()=>{c=(await ok('/collections','POST',collBody())).collection;assert.equal(c.driverId,driverId);assert.equal(c.collectorId,created.catador.id);}],
 ['Pedido delegado não pode ser cancelado isoladamente',()=>reject('/schedules/'+s.id+'/status','PATCH',{status:'CANCELLED'})],
 ['Duplicar delegação não cria segunda coleta',()=>reject('/collections','POST',collBody())],
 ['Outro perfil não delega solicitação',()=>reject('/collections','POST',collBody(),f.fieldMeeting.catToken)],
 ['Cooperativa filtra solicitação por ID',async()=>{const x=(await ok('/schedules/'+s.id)).schedule;assert(x.id===s.id);} ],
 ['Estado concluído não pode ser forçado no pedido',()=>reject('/schedules/'+s.id+'/status','PATCH',{status:'COMPLETED'})],
 ['ID inexistente não revela dados',()=>reject('/schedules/solicitacao-inexistente-auditoria')],
 ['Outra cooperativa não acessa solicitação',()=>reject('/schedules/'+s.id,'GET',undefined,f.audit.foreignToken)],
 ['Sem catador a delegação é rejeitada',()=>reject('/collections','POST',{scheduleId:s.id})]
 ];
 ops.catadores=[
 ['Nome e inscrição persistem no cadastro',async()=>{const x=(await ok('/collectors/'+created.catador.id)).collector;assert.equal(x.registrationNumber,'AUD-001');}],
 ['Sem vínculo não se atribui produção avulsa',async()=>{const x=(await ok('/collections/'+delivery.id)).collection;assert.equal(x.collectorId,null);}],
 ['Catador inválido é rejeitado na delegação',()=>reject('/collections','POST',{scheduleId:s.id,collectorId:'inexistente-auditoria'})],
 ['Equipe com integrante repetido é rejeitada',()=>reject('/collector-teams','POST',{name:'Teste repetido',active:true,memberIds:[catId,catId]})],
 ['Equipe inativa não pode assumir atendimento',()=>reject('/collections/'+c.id+'/team','POST',{teamId:created.equipe.id,expectedVersion:0})],
 ['Alterar categoria preserva cadastro e inscrição',async()=>{await ok('/collectors/'+created.catador.id,'PATCH',{membershipCategory:'EFFECTIVE'});} ],
 ['Versão antiga da equipe não sobrescreve participantes',()=>reject('/collector-teams/'+created.equipe.id,'PATCH',{...extended[1].body,expectedVersion:0})],
 ['Catador não edita dados administrativos de outro',()=>reject('/collectors/'+created.catador.id,'PATCH',{name:'Proibido'},f.fieldMeeting.catToken)],
 ['Histórico do participante inclui trabalho em equipe',async()=>{const r=await ok('/cooperative-field/collectors/'+catId);assert(r.collections.some(x=>x.participants?.length>=2));}],
 ['Documentos do catador exigem autenticação',async()=>{const r=await fetch('http://127.0.0.1:3339/owner-documents?kind=collector&ownerId='+created.catador.id);assert.equal(r.status,401);}]
 ];
 ops.rotas=[
 ['Rota diária gera execuções independentes',async()=>{const r=await ok('/routes');assert(r.routes.filter(x=>x.planId===created.plano.id).length>=2);} ],
 ['Modalidade por pontos rejeita roteiro vazio',()=>reject('/route-plans','POST',{...plan,points:[]})],
 ['Modalidade por bairro permite começar sem pontos',async()=>{const r=await ok('/route-plans','POST',{...plan,name:'Bairro auditoria QA',coverageMode:'AREA',coverageArea:'Bairro Auditoria e ruas internas',points:[]});assert(r.plan.id);} ],
 ['Saída sem motorista e veículo é bloqueada',()=>reject('/routes/'+created.rota.id+'/field-status','POST',{status:'IN_PROGRESS'},f.fieldMeeting.catToken)],
 ['Cancelar rota não apaga coletas realizadas',async()=>{const r=await ok('/routes/'+f.intakeDeliverers.route);assert.equal(r.route.closureOutcome,'PARTIAL');assert.equal(r.route.collections.filter(x=>x.attendanceOutcome==='NOT_COLLECTED').length,2);} ],
 ['Próximo dia mantém todos os pontos',async()=>{const r=await ok('/routes/'+f.intakeDeliverers.tomorrow);assert.equal(r.route.collections.length,10);} ],
 ['Pontos duplicados impedem plano recorrente',()=>reject('/route-plans','POST',{...plan,points:[point,point]})],
 ['Intervalo de dias inválido é rejeitado',()=>reject('/route-plans','POST',{...plan,endsOn:'2026-01-01'})],
 ['Motorista não replaneja a rota administrativa',()=>reject('/routes/'+created.rota.id,'PATCH',{name:'Proibido'},f.fieldMeeting.driverToken)],
 ['Outra cooperativa não altera recursos da rota',()=>reject('/routes/'+created.rota.id,'PATCH',{driverId},f.audit.foreignToken)]
 ];
 ops.motoristas=[
 ['Motorista ativo pode ser associado a veículo',async()=>{const r=(await ok('/vehicles/'+vehicle.id)).vehicle;assert.equal(r.driverId,driverId);} ],
 ['Dados de contato podem ser corrigidos',async()=>{const x=(await ok('/drivers/'+created.motorista.id)).driver;assert.equal(x.phone,'85977771111');}],
 ['Motorista não consulta localização de colega',()=>reject('/driver-tracking/drivers/'+driverId,'GET',undefined,f.fieldMeeting.driverToken)],
 ['Gestor não inicia compartilhamento em nome do motorista',()=>reject('/driver-tracking/start','POST',{routeId:f.fieldMeeting.route,mode:'FOREGROUND'})],
 ['Posição impossível é rejeitada',()=>reject('/driver-tracking/position','PUT',{sessionId:randomUUID(),latitude:91,longitude:-38,capturedAt:new Date().toISOString()},f.fieldMeeting.driverToken)],
 ['Relato exige descrição útil',()=>reject('/drivers/me/reports','POST',{type:'DELAY',description:'A'},f.fieldMeeting.driverToken)],
 ['Relato de atraso é registrado no serviço',async()=>{const r=await ok('/drivers/me/reports','POST',{type:'DELAY',description:'Atraso no trânsito na auditoria',routeId:f.fieldMeeting.route},f.fieldMeeting.driverToken);assert(r.report?.id);} ],
 ['Histórico do motorista mantém relato registrado',async()=>{const r=await ok('/drivers/me/reports','GET',undefined,f.fieldMeeting.driverToken);assert(r.reports.length>=1);} ],
 ['Outra cooperativa não altera disponibilidade',()=>reject('/drivers/'+created.motorista.id+'/status','PATCH',{status:'INACTIVE'},f.audit.foreignToken)],
 ['Disponibilidade pode ser atualizada sem apagar CNH',async()=>{await ok('/drivers/'+created.motorista.id+'/status','PATCH',{status:'INACTIVE'});assert.equal((await ok('/drivers/'+created.motorista.id)).driver.status,'INACTIVE');}]
 ];
 ops.veiculos=[
 ['Capacidade e vínculo são preservados na edição',async()=>{const x=(await ok('/vehicles/'+vehicle.id)).vehicle;assert.equal(x.driverId,driverId);assert.equal(Number(x.capacityKg),1500);} ],
 ['Placa duplicada é rejeitada mesmo em outra grafia',()=>reject('/vehicles','POST',{plate:'aud-1a23',model:'Duplicado'})],
 ['Ano fora do intervalo é rejeitado',()=>reject('/vehicles','POST',{plate:'AUD3A23',model:'Caminhão',year:1800})],
 ['Veículo de outra cooperativa não pode ser delegado',()=>reject('/collections','POST',{scheduleId:s.id,collectorId:catId,vehicleId:'fora-auditoria'})],
 ['Documento vinculado preserva titular',async()=>{const r=await ok('/owner-documents?kind=vehicle&ownerId='+vehicle.id);assert(r.documents.length);} ],
 ['Manutenção fica no histórico do próprio veículo',async()=>{const r=(await ok('/maintenance-logs')).data;assert(r.some(x=>x.id===created.manutencao.id));} ],
 ['Estado de manutenção pode ser consultado',async()=>{await ok('/vehicles/'+vehicle.id+'/status','PATCH',{status:'MAINTENANCE'});assert.equal((await ok('/vehicles/'+vehicle.id)).vehicle.status,'MAINTENANCE');} ],
 ['Operação não inicia usando veículo em manutenção',async()=>{await reject('/routes','POST',{name:'Rota bloqueada manutenção QA',scheduledDate:day,driverId,vehicleId:vehicle.id,stops:['Rua QA']});} ],
 ['Liberação do veículo preserva modelo e placa',async()=>{await ok('/vehicles/'+vehicle.id+'/status','PATCH',{status:'ACTIVE'});const r=(await ok('/vehicles/'+vehicle.id)).vehicle;assert.equal(r.model,'Caminhão auditoria atualizado');} ],
 ['Outra cooperativa não apaga ou troca placa',()=>reject('/vehicles/'+vehicle.id,'PATCH',{plate:'PROIBIDO'},f.audit.foreignToken)]
 ];
 for(const group of ['solicitacoes','catadores','rotas','motoristas','veiculos'])for(let i=0;i<ops[group].length;i++)await test('OP-'+group+'-'+(i+1),'operacionais',group+' — '+ops[group][i][0],ops[group][i][1]);
 // UI interactions with actual APIs: registrations, searches, PDFs, receipts and the material chain.
 await test('UI-cadastro-catador','fluxos-ui','Catador — criar e editar cadastro pelo formulário do painel',async()=>{
 await go('/create-collector');await page.locator('input[name="name"]').fill('Catador formulário painel QA');await page.locator('input[name="email"]').fill('panel-form-collector@test.invalid');await page.locator('input[name="registrationNumber"]').fill('FORM-2026');await page.locator('form button[type="submit"]').click();await page.waitForURL(/collector-list/);await page.getByText('Catador formulário painel QA',{exact:true}).waitFor();
 const row=page.getByRole('row').filter({hasText:'Catador formulário painel QA'});await row.getByRole('link',{name:/Editar/}).click();await page.locator('input[name="phone"]').fill('85955550000');await page.locator('form button[type="submit"]').click();await page.waitForURL(/collector-list/);assert((await ok('/collectors')).collectors.some(c=>c.name==='Catador formulário painel QA'&&c.phone==='85955550000'));});
 await test('UI-cadastro-motorista','fluxos-ui','Motorista — criar e corrigir telefone pelo painel',async()=>{
 await go('/create-staff');await page.locator('input[name="name"]').fill('Motorista formulário painel QA');await page.locator('input[name="email"]').fill('panel-form-driver@test.invalid');await page.locator('form button[type="submit"]').click();await page.waitForURL(/staff-list/);const x=(await ok('/drivers')).drivers.find(d=>d.email==='panel-form-driver@test.invalid');await go('/edit-staff/'+x.id);await page.locator('input[name="phone"]').fill('85944440000');await page.locator('form button[type="submit"]').click();await page.waitForURL(/staff-list/);assert.equal((await ok('/drivers/'+x.id)).driver.phone,'85944440000');});
 await test('UI-cadastro-veiculo','fluxos-ui','Veículo — criar com motorista, editar capacidade e consultar',async()=>{
 await go('/create-vehicle');await page.locator('input[name="plate"]').fill('UIA1B23');await page.locator('input[name="model"]').fill('Veículo formulário QA');await page.locator('input[name="capacityKg"]').fill('800');await page.locator('form button[type="submit"]').click();await page.waitForURL(/vehicle-list/);const x=(await ok('/vehicles')).vehicles.find(v=>v.plate==='UIA1B23');assert(x);await go('/edit-vehicle/'+x.id);await page.locator('input[name="capacityKg"]').fill('900');await page.locator('form button[type="submit"]').click();await page.waitForURL(/vehicle-list/);assert.equal(Number((await ok('/vehicles/'+x.id)).vehicle.capacityKg),900);});

 await test('UI-cadastro-gerador','fluxos-ui','Gerador — CPF e CNPJ classificam cadastro criado pelo painel',async()=>{
   await context.addInitScript(()=>{window.google={maps:{Map:class{constructor(el){this.listeners={};el.setAttribute('aria-label','Mapa controlado da auditoria');el.addEventListener('click',()=>this.listeners.click?.({latLng:{lat:()=>-3.73,lng:()=>-38.52}}));}addListener(name,fn){this.listeners[name]=fn;}panTo(){}setZoom(){}},Marker:class{addListener(){}setVisible(){}setPosition(){}}}};});
   for(const [doc,name,email,category] of [[cpf('555666777'),'Residencial formulário painel QA','panel-form-cpf@test.invalid','REGISTERED_RESIDENTIAL'],['12345678000195','Empresa formulário painel QA','panel-form-cnpj@test.invalid','SMALL_BUSINESS']]){
     await go('/create-generator');await page.locator('input[name=name]').fill(name);await page.locator('input[name=email]').fill(email);await page.getByLabel('CPF/CNPJ *',{exact:true}).fill(doc);await page.getByLabel('Mapa controlado da auditoria',{exact:true}).click();await button('Confirmar localização').click();await button('Salvar gerador').click();await page.waitForURL(/generator-list/);const x=(await ok('/generators')).generators.find(g=>g.email===email);assert.equal(x.registrationCategory,category);
   }
 });
 await test('UI-cadastro-pev','fluxos-ui','PEV — salvar identificação e ponto confirmado pelo formulário',async()=>{
   await go('/create-bin');await page.locator('input[name=bin_id]').fill('PEV-FORM-AUDITORIA');await page.locator('input[name=name]').fill('PEV formulário painel QA');await page.locator('input[name=street]').fill('Rua Auditoria PEV');await page.locator('input[name=latitude]').fill('-3.76');await page.locator('input[name=longitude]').fill('-38.54');await button('Confirmar localização no mapa').click();await button('Salvar PEV').click();await page.waitForURL(/bin-list/);const r=await ok('/bins');const rows=r.data||r.bins||r.items||r;const x=rows.find(b=>(b.binId||b.bin_id)==='PEV-FORM-AUDITORIA');assert(x);assert.equal(Number(x.latitude),-3.76);
 });
 await test('UI-cadastro-equipe','fluxos-ui','Equipe — escolher dois participantes e confirmar vínculo no painel',async()=>{
   await go('/collector-teams');await button('Nova equipe').click();await page.getByLabel('Nome da equipe').fill('Equipe formulário painel QA');const dialog=page.getByRole('dialog');await dialog.locator('fieldset input[type=checkbox]').nth(0).check();await dialog.locator('fieldset input[type=checkbox]').nth(1).check();await button('Salvar equipe').click();await dialog.waitFor({state:'hidden'});assert((await ok('/collector-teams')).teams.some(t=>t.name==='Equipe formulário painel QA'&&t.memberIds.length===2));
 });
 await test('UI-cadastro-material','fluxos-ui','Material — cadastro gera código interno e preserva unidade em português',async()=>{
   await go('/create-type');await page.locator('#waste-name').fill('Plástico formulário painel QA');await page.locator('#waste-category').fill('Reciclável');await page.locator('#waste-unit').selectOption('KG');await button('Salvar cadastro').click();await page.waitForURL(/waste-type-list/);const x=(await ok('/waste-stock/items')).items.find(i=>i.name==='Plástico formulário painel QA');assert(x.internalCode);assert.equal(x.unit,'KG');
 });
 await test('UI-cadastro-lote','fluxos-ui','Lote — entrada manual cria código e saldo pelo formulário',async()=>{
   await go('/waste-stock/create?itemId='+item.id);await page.locator('#waste-quantity').fill('7.5');await page.locator('#waste-origin').fill('Entrada manual formulário QA');await button('Salvar lote').click();await page.waitForURL(/waste-stock$/);const x=(await ok('/waste-stock/items/'+item.id+'/lots')).lots.find(l=>l.origin==='Entrada manual formulário QA');assert(x.code||x.lotCode);assert.equal(Number(x.availableQuantity),7.5);
 });
 await test('UI-cadastro-manutencao','fluxos-ui','Manutenção — formulário preserva custo zero e observações',async()=>{
   await go('/create-maintenance');await page.locator('[name=vehicle_id]').selectOption(vehicle.id);await page.locator('[name=maintenance_type]').fill('Revisão preventiva');await page.locator('[name=maintenance_date]').fill('2026-11-04');await page.locator('[name=cost]').fill('0');await page.locator('[name=note]').fill('Manutenção gratuita no formulário QA');await page.locator('form button[type=submit]').click();await page.waitForURL(/maintenance-list/);const x=(await ok('/maintenance-logs')).data.find(r=>(r.notes||r.note)==='Manutenção gratuita no formulário QA');assert(x);assert.equal(Number(x.cost),0);
 });
 await test('UI-cadastro-entregador','fluxos-ui','Entregador — cadastrar somente nome e corrigir telefone',async()=>{
   await go('/intake-deliverers');await button('Novo entregador').click();await page.getByLabel('Nome do entregador').fill('Entregador formulário painel QA');await button('Salvar cadastro simplificado').click();const row=page.getByRole('row').filter({hasText:'Entregador formulário painel QA'});await row.getByRole('button',{name:'Editar cadastro',exact:true}).click();await page.getByLabel('Telefone do entregador').fill('85911112222');await button('Salvar cadastro simplificado').click();await row.getByText('85911112222',{exact:true}).waitFor();
 });
 for(const type of ['DIRECT_DESTINATION','STOCK','TRIAGE','RESERVATION','REJECT','DISPOSAL'])await test('UI-destino-'+type,'fluxos-ui','Destinação — executar '+type+' pelo modal do painel',async()=>{
   const collection=await intake({origin:{name:'Fluxo UI destino '+type}});await weigh(collection);await go('/collected-waste?q='+collection.id);await button('Ver materiais').click();await button('Destinar').click();const dialog=page.getByRole('dialog');await dialog.locator('input[type=radio][value='+type+']').check();await dialog.locator('#destination-quantity').fill('10');if(type==='STOCK')await dialog.locator('select[name=stockItemId]').selectOption(item.id);if(await dialog.locator('#destination-name').count())await dialog.locator('#destination-name').fill('Receptor auditoria '+type);if(await dialog.locator('#destination-notes').count())await dialog.locator('#destination-notes').fill('Encaminhamento registrado na auditoria do painel');await dialog.getByRole('button',{name:'Registrar destinação',exact:true}).click();await dialog.waitFor({state:'hidden'});const e=await entryOf(collection);assert.equal(Number(e.remainingQuantity),0);assert(e.destinations.some(d=>d.type===type));
 });
 for(const [url,kind] of [['/collector-list','collectors'],['/generator-list','generators'],['/staff-list','drivers']])for(const scope of ['one','all'])await test('PDF-'+kind+'-'+scope,'exportacoes','PDF de '+kind+' — '+scope,async()=>{
 await go(url);await button('Baixar cadastros em PDF').click();await page.getByLabel('O que deseja baixar?').selectOption(scope);if(scope==='one'){const select=page.getByLabel('Selecionar cadastro');await select.locator('option').nth(1).waitFor({state:'attached'});await select.selectOption({index:1});}
 const download=page.waitForEvent('download');await button('Baixar PDF').click();const d=await download;await d.saveAs(out+'/'+kind+'-'+scope+'.pdf');assert(fs.readFileSync(out+'/'+kind+'-'+scope+'.pdf').subarray(0,5).toString()==='%PDF-');});
 await test('UI-recebimento-destinacao','fluxos-ui','Entrada anônima — receber, separar, pesar e abrir rastreabilidade',async()=>{
 await go('/material-intakes');await button('Receber material na cooperativa').click();await page.getByLabel('Pessoa / órgão / origem (opcional)').fill('Entrega de material fluxo UI QA');await page.getByLabel('Descrição do recebimento / materiais aparentes').fill('Sacos separados no recebimento do painel');await button('Registrar entrada / coleta').click();await page.getByText('Entrada recebida. Registre a separação e pesagem quando estiverem prontas.',{exact:true}).waitFor();const row=page.getByRole('row').filter({hasText:'Entrega de material fluxo UI QA'});await row.getByRole('button',{name:'Separar e pesar',exact:true}).click();await page.getByLabel('Material',{exact:true}).selectOption(item.id);await page.getByLabel('Quantidade',{exact:true}).fill('15.5');await button('Confirmar pesagem').click();await page.getByText('Pesagem registrada. O material está disponível para triagem, estoque ou destinação.',{exact:true}).waitFor();await row.getByRole('link',{name:'Triagem e destinações',exact:true}).click();await page.getByText('Entrega de material fluxo UI QA',{exact:true}).waitFor();});
 await test('UI-gestao-busca','gestoes','Cinco gestões — filtros vazios e busca sem resultado não misturam entidades',async()=>{
 for(const route of ['/generator-list','collector-list','staff-list','vehicle-list','bin-list']){await go(route.startsWith('/')?route:'/'+route);const search=page.locator('main input[type="search"],main input[placeholder*="Buscar"],main input[placeholder*="buscar"]');assert(await search.count());await search.first().fill('zzz-sem-registro-auditoria-999');await page.waitForTimeout(350);assert(/Nenhum|nenhum/.test(await page.locator('main.page-content').innerText()));}});


 for(const [kind,route] of [['overview','/analytics-dashboard'],['collections','/waste-collection-reports'],['waste','/waste-type-reports'],['staff','/staff-reports'],['vehicles','/vehicle-reports']]){
   await test('REL-'+kind+'-1','relatorios','Relatório '+kind+' — aplicar período com dados reais da cooperativa',async()=>{await go(route);await page.getByLabel('Data inicial',{exact:true}).fill('2026-10-01');await page.getByLabel('Data final',{exact:true}).fill('2026-11-15');await button('Aplicar filtros').click();await button('Exportar PDF').waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Exportar PDF'&&!b.disabled));assert.equal(new URL(page.url()).searchParams.get('start'),'2026-10-01');});
   await test('REL-'+kind+'-2','relatorios','Relatório '+kind+' — exportar PDF do recorte completo',async()=>{const download=page.waitForEvent('download');await button('Exportar PDF').click();const d=await download;const file=out+'/relatorio-'+kind+'.pdf';await d.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,5).toString(),'%PDF-');});
   await test('REL-'+kind+'-3','relatorios','Relatório '+kind+' — exportar planilha Excel válida',async()=>{const download=page.waitForEvent('download');await button('Exportar Excel').click();const d=await download;const file=out+'/relatorio-'+kind+'.xlsx';await d.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,2).toString(),'PK');});
   await test('REL-'+kind+'-4','relatorios','Relatório '+kind+' — salvar e restaurar filtros do próprio usuário',async()=>{await button('Salvar filtros').click();await button('Limpar filtros').click();await button('Restaurar filtros').click();await page.waitForFunction(()=>new URL(location.href).searchParams.get('start')==='2026-10-01');});
   await test('REL-'+kind+'-5','relatorios','Relatório '+kind+' — período invertido não permite exportação',async()=>{const failed=page.waitForResponse(r=>new URL(r.url()).pathname==='/reports/'+kind&&new URL(r.url()).searchParams.get('start')==='2026-11-15'&&new URL(r.url()).searchParams.get('end')==='2026-10-01'&&r.request().method()==='GET');await go(route+'?start=2026-11-15&end=2026-10-01');assert.equal((await failed).status(),400);await page.locator('main.page-content [role=alert]').first().waitFor();assert(await button('Exportar PDF').isDisabled());});
 }
 // Session recovery is tested in isolated browser contexts so one expiry cannot affect another case.
 for (const mode of ['guest','expired','temporary','role','mid-session']) await test('AUTH-'+mode,'sessao','Sessão — '+mode,async()=>{
   const c=await context.browser().newContext({viewport:{width:390,height:844},locale:'pt-BR'});c.setDefaultTimeout(10000);let unavailable=mode==='temporary',expire=mode==='expired',later=false;
   try {
     if(mode!=='guest')await c.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},{token:mode==='role'?f.fieldMeeting.catToken:f.token,user:mode==='role'?f.fieldMeeting.catUser:f.owner});
     await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin==='https://vps.katua.com.br'){
       if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS'}});
       if(u.pathname==='/auth/me'&&(unavailable||expire))return r.fulfill({status:expire?401:503,json:{message:expire?'Sessão inválida no teste':'Serviço temporariamente indisponível no teste'},headers:{'access-control-allow-origin':'*'}});
       if(later&&u.pathname==='/generators')return r.fulfill({status:401,json:{message:'Sessão encerrada no teste'},headers:{'access-control-allow-origin':'*'}});
       const response=await r.fetch({url:r.request().url().replace('https://vps.katua.com.br','http://127.0.0.1:3339')});return r.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}});
     }if(['localhost','127.0.0.1'].includes(u.hostname))return r.continue();return r.abort();});
     const p=await c.newPage();await p.goto('http://127.0.0.1:5181/generator-list');
     if(['guest','expired','role'].includes(mode)){await p.waitForURL(/login/);assert.equal(await p.evaluate(()=>localStorage.getItem('auth_token')),null);}
     if(mode==='temporary'){await p.getByRole('button',{name:'Tentar confirmar sessão',exact:true}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('auth_token')),f.token);assert.equal(await p.locator('main.page-content').count(),0);unavailable=false;await p.getByRole('button',{name:'Tentar confirmar sessão',exact:true}).click();await p.locator('main.page-content').waitFor();}
     if(mode==='mid-session'){await p.locator('main.page-content').waitFor();later=true;await p.reload();await p.waitForURL(/login/);assert.equal(await p.evaluate(()=>localStorage.getItem('auth_token')),null);}
   } finally {await c.unrouteAll({behavior:'ignoreErrors'});await c.close();}
 });
 fs.writeFileSync(out+'/created-ids.json',JSON.stringify(Object.fromEntries(Object.entries(created).map(([k,v])=>[k,v?.id])),null,2));
}
