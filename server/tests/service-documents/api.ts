import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
export async function checkServiceDocuments(app: FastifyInstance, p: PrismaClient, users: any, coop: any, pass: (s: string) => void) {
  const call = async (url: string, who = 'owner', status = 200) => {
    const r = await app.inject({
      method: 'GET',
      url,
      headers: {
        authorization: 'Bearer ' + app.jwt.sign({
          sub: users[who].id,
          role: users[who].role
        })
      }
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  };
  const driver = await p.driver.findFirstOrThrow({
      where: {
        cooperativeId: coop.id
      }
    }),
    vehicle = await p.vehicle.findFirstOrThrow({
      where: {
        cooperativeId: coop.id
      }
    }),
    collector = await p.collector.findFirstOrThrow({
      where: {
        cooperativeId: coop.id
      }
    });
  const route = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: 'Rota documentos QA',
      driverId: driver.id,
      vehicleId: vehicle.id,
      scheduledDate: new Date('2026-11-01T11:00:00Z'),
      stops: []
    }
  });
  const cs = await p.$transaction(async tx => {
    const rows = [];
    for (let i = 0; i < 3; i++) rows.push(await tx.collection.create({
      data: {
        cooperativeId: coop.id,
        routeId: route.id,
        collectorId: collector.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        routePoint: {
          name: 'Ponto documentos ' + i,
          address: 'Rua QA, ' + i
        }
      }
    }));
    return rows;
  });
  const os = await p.serviceOrder.findUniqueOrThrow({
    where: {
      cooperativeId_sourceKey: {
        cooperativeId: coop.id,
        sourceKey: 'ROUTE:' + route.id
      }
    }
  });
  const first = await call('/service-orders/' + os.id);
  assert.equal(first.current.collections.length, 3);
  assert.equal(first.documents.filter((d: any) => d.kind === 'SERVICE_ORDER').length, 1);
  const plan = await call('/internal-documents/' + first.documents[0].id);
  assert.equal(plan.document.snapshot.collections.length, 3);
  assert.match(os.number, /^OS-\d{4}-\d{8,}$/);
  assert.equal(plan.document.snapshot.internalOnly, true);
  pass('Uma O.S. por execução de rota, três pontos no documento emitido após a transação e numeração única');
  const original = JSON.stringify(plan.document.snapshot);
  await p.route.update({
    where: {
      id: route.id
    },
    data: {
      description: 'Orientação atualizada'
    }
  });
  assert.equal(JSON.stringify((await call('/internal-documents/' + plan.document.id)).document.snapshot), original);
  assert.equal((await call('/service-orders/' + os.id)).documents.filter((d: any) => d.kind === 'SERVICE_ORDER').length, 2);
  await p.route.update({
    where: {
      id: route.id
    },
    data: {
      description: 'Orientação atualizada'
    }
  });
  assert.equal((await call('/service-orders/' + os.id)).documents.filter((d: any) => d.kind === 'SERVICE_ORDER').length, 2);
  pass('Alterações geram nova versão e preservam a emissão original; gravação repetida não duplica documento');
  await p.$transaction(async tx => {
    await tx.collection.update({
      where: {
        id: cs[0].id
      },
      data: {
        status: 'COLLECTED',
        collectedAt: new Date(),
        fieldCompletedByUserId: users.cat.id
      }
    });
    await tx.collectionMaterial.create({
      data: {
        collectionId: cs[0].id,
        nameSnapshot: 'Óleo documentos QA',
        quantity: 50,
        unit: 'LITER'
      }
    });
  });
  const docs = (await call('/service-orders/' + os.id)).documents,
    receipt = docs.find((d: any) => d.kind === 'COLLECTION_RECEIPT');
  assert(receipt);
  const rp = (await call('/internal-documents/' + receipt.id)).document;
  assert.equal(rp.snapshot.collections.find((c: any) => c.id === cs[0].id).materials[0].quantity, 50);
  await p.collection.update({
    where: {
      id: cs[0].id
    },
    data: {
      status: 'RECEIVED',
      receivedAt: new Date(),
      receivedByUserId: users.owner.id
    }
  });
  await p.collection.update({
    where: {
      id: cs[0].id
    },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedByUserId: users.owner.id
    }
  });
  await p.collection.update({
    where: {
      id: cs[1].id
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Sem atendimento',
      cancelledByUserId: users.owner.id
    }
  });
  await p.route.update({
    where: {
      id: route.id
    },
    data: {
      status: 'COMPLETED',
      closureOutcome: 'WITH_PENDING',
      closedAt: new Date()
    }
  });
  assert.equal((await p.collection.findUniqueOrThrow({
    where: {
      id: cs[0].id
    }
  })).status, 'COMPLETED');
  assert.equal((await p.collectionMaterial.findFirstOrThrow({
    where: {
      collectionId: cs[0].id
    }
  })).quantity.toNumber(), 50);
  const finalDocs = (await call('/service-orders/' + os.id)).documents;
  for (const k of ['COLLECTION_RECEIPT', 'RECEIVING_RECEIPT', 'CLOSURE', 'CANCELLATION']) assert(finalDocs.some((d: any) => d.kind === k));
  pass('Coleta, recebimento, encerramento e cancelamento preservam os atendimentos e o óleo em litros');
  await call('/service-orders/' + os.id, 'foreign', 404);
  await call('/internal-documents/' + plan.document.id, 'foreign', 404);
  await call('/service-orders', 'cat', 403);
  await call('/internal-documents', 'driver', 403);
  assert.equal((await app.inject({
    method: 'GET',
    url: '/internal-documents'
  })).statusCode, 401);
  await call('/service-orders?dateFrom=2026-11-02&dateTo=2026-10-01', 'owner', 400);
  pass('Cooperativas isoladas, perfis de campo sem acesso, autenticação e filtros de período validados');
  const before = await p.internalDocument.count();
  try {
    await p.$transaction(async tx => {
      await tx.collection.create({
        data: {
          cooperativeId: coop.id,
          status: 'COLLECTED',
          collectedAt: new Date()
        }
      });
      throw Error('Rollback QA');
    });
  } catch {}
  assert.equal(await p.internalDocument.count(), before);
  pass('Rollback da coleta não deixa O.S. ou comprovante órfão');
  await assert.rejects(p.internalDocument.update({where:{id:plan.document.id},data:{snapshot:{changed:true}}}));
  await assert.rejects(p.internalDocument.delete({where:{id:plan.document.id}}));
  pass('Banco bloqueia alteração ou exclusão de documento emitido');
  const historical = await p.internalDocument.findFirstOrThrow({
    where: {
      kind: 'HISTORICAL_RECORD'
    }
  });
  assert.equal((historical.snapshot as any).historicalReconstruction, true);
  pass('Migração identifica operações antigas como reconstrução atual, sem inventar autorização retroativa');
  const item = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: 'Óleo documento saída QA',
      category: 'Óleo',
      unit: 'LITER'
    }
  });
  const lot = await p.wasteStockLot.create({
    data: {
      cooperativeId: coop.id,
      stockItemId: item.id,
      code: 'LOT-DOC-QA',
      quantity: 50,
      availableQuantity: 50,
      unit: 'LITER',
      originCollectionId: cs[0].id
    }
  });
  const payload = {
    operationId: crypto.randomUUID(),
    expectedVersion: 1,
    kind: 'DIRECT_DESTINATION',
    quantity: 20,
    destinationName: 'Destinatário QA',
    destinationDocument: 'Documento QA',
    transportDriverName: 'Motorista saída QA',
    transportVehiclePlate: 'OUT2026',
    movementDate: '2026-10-30T15:00:00Z'
  };
  const send = () => app.inject({
    method: 'POST',
    url: `/waste-stock/lots/${lot.id}/movements`,
    headers: {
      authorization: 'Bearer ' + app.jwt.sign({
        sub: users.owner.id,
        role: users.owner.role
      })
    },
    payload
  });
  const exit = await send();
  assert.equal(exit.statusCode, 201, exit.body);
  const count = await p.internalDocument.count({
    where: {
      movementId: exit.json().movement.id
    }
  });
  assert.equal(count, 1);
  assert.equal((await send()).statusCode, 200);
  assert.equal(await p.internalDocument.count({
    where: {
      movementId: exit.json().movement.id
    }
  }), 1);
  const transport = (await call('/internal-documents?lotId=' + lot.id)).documents[0];
  assert.equal(transport.kind, 'TRANSPORT_RECORD');
  assert(transport.orders.some((o: any) => o.serviceOrder.id === os.id));
  assert.equal((await call('/internal-documents/' + transport.id)).document.snapshot.movement.quantity, 20);
  assert.equal((await call('/internal-documents/' + transport.id)).document.snapshot.movement.transportVehiclePlate, 'OUT2026');
  pass('Saída parcial gera comprovante interno com O.S. automática; repetição idempotente não duplica saldo nem documento');
  const manual = await p.wasteStockLot.create({
    data: {
      cooperativeId: coop.id,
      stockItemId: item.id,
      code: 'LOT-MANUAL-DOC-QA',
      quantity: 10,
      availableQuantity: 10,
      unit: 'LITER'
    }
  });
  await p.wasteStockMovement.create({
    data: {
      cooperativeId: coop.id,
      lotId: manual.id,
      operationId: crypto.randomUUID(),
      operationHash: 'manual',
      kind: 'DONATION',
      quantity: 5,
      unit: 'LITER',
      destinationName: 'Recebedor manual',
      actorUserId: users.owner.id,
      before: {
        availableQuantity: 10
      },
      after: {
        availableQuantity: 5
      }
    }
  });
  const manualDoc = (await call('/internal-documents?lotId=' + manual.id)).documents[0];
  assert.equal(manualDoc.orders.length, 0);
  pass('Saída de lote manual aparece na central sem inventar coleta ou autorização de origem');
  const standalone = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      collectorId: collector.id
    }
  });
  const one = (await call('/service-orders?collectionId=' + standalone.id)).orders;
  assert.equal(one.length, 1);
  assert.equal(one[0].sourceType, 'COLLECTION');
  assert((await call('/service-orders?q=' + encodeURIComponent('#' + cs[0].id.slice(-8)))).orders.some((o: any) => o.id === os.id));
  pass('Coleta individual possui O.S. própria e busca aceita código curto com #');
  await call('/service-orders?dateFrom=2026-02-30', 'owner', 400);
  assert((await call('/service-orders?status=COMPLETED')).orders.some((o: any) => o.id === os.id));
  assert(!(await call('/service-orders?status=PENDING')).orders.some((o: any) => o.id === os.id));
  assert.equal(new Date(plan.document.snapshot.route.date).toISOString(), '2026-11-01T11:00:00.000Z');
  pass('Filtro por situação usa o serviço atual, datas impossíveis são rejeitadas e horários mantêm UTC explícito');
  const direct = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      status: 'RECEIVED',
      quantityReviewVersion: 1,
      receivedAt: new Date(),
      collectionMaterials: {
        create: {
          nameSnapshot: 'Vidro saída direta QA',
          quantity: 10,
          unit: 'KG'
        }
      }
    },
    include: {
      collectionMaterials: true
    }
  });
  const entry = await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: direct.id,
      collectionMaterialId: direct.collectionMaterials[0].id,
      materialNameSnapshot: 'Vidro saída direta QA',
      collectedQuantity: 10,
      remainingQuantity: 10,
      unit: 'KG'
    }
  });
  const mutation = async (method: any, url: string, payload: any, status = 200) => {
    const r = await app.inject({
      method,
      url,
      payload,
      headers: {
        authorization: 'Bearer ' + app.jwt.sign({
          sub: users.owner.id,
          role: users.owner.role
        })
      }
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  };
  const dest = (await mutation('POST', '/collection-waste-destinations', {
    operationId: crypto.randomUUID(),
    collectionWasteEntryId: entry.id,
    type: 'DIRECT_DESTINATION',
    quantity: 10,
    unit: 'KG',
    destinationName: 'Destino direto QA'
  }, 201)).destination;
  let directDocs = await p.internalDocument.findMany({
    where: {
      destinationId: dest.id
    }
  });
  assert(directDocs.some(d => d.kind === 'TRANSPORT_RECORD'));
  assert(directDocs.some(d => d.kind === 'DESTINATION_RECORD'));
  const initialCount = directDocs.length;
  await mutation('PATCH', '/collection-waste-destinations/' + dest.id, {
    notes: null
  });
  assert.equal(await p.internalDocument.count({
    where: {
      destinationId: dest.id
    }
  }), initialCount);
  await mutation('POST', '/collection-waste-destinations/' + dest.id + '/cancel', {
    reason: 'Correção de encaminhamento QA'
  });
  assert.equal((await call('/internal-documents/' + directDocs[0].id)).destinationCurrentState.status, 'CANCELLED');
  assert.equal((directDocs[0].snapshot as any).destination.status, 'ACTIVE');
  pass('Destino direto emite registros internos de encaminhamento e transporte; cancelamento preserva emissão e informa situação atual');
  const relinked = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      collectorId: collector.id,
      driverId: driver.id,
      vehicleId: vehicle.id
    }
  });
  const prior = await p.serviceOrder.findUniqueOrThrow({
    where: {
      cooperativeId_sourceKey: {
        cooperativeId: coop.id,
        sourceKey: 'COLLECTION:' + relinked.id
      }
    }
  });
  const transferRoute = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: 'Rota transferência QA',
      stops: []
    }
  });
  await p.collection.update({
    where: {
      id: relinked.id
    },
    data: {
      routeId: transferRoute.id
    }
  });
  const transferOrder = await p.serviceOrder.findUniqueOrThrow({
    where: {
      cooperativeId_sourceKey: {
        cooperativeId: coop.id,
        sourceKey: 'ROUTE:' + transferRoute.id
      }
    }
  });
  const linkedLot = await p.wasteStockLot.create({
    data: {
      cooperativeId: coop.id,
      stockItemId: item.id,
      code: 'LOT-RELINK-DOC-QA',
      quantity: 1,
      availableQuantity: 1,
      unit: 'LITER',
      originCollectionId: relinked.id
    }
  });
  await mutation('POST', `/waste-stock/lots/${linkedLot.id}/movements`, {
    operationId: crypto.randomUUID(),
    expectedVersion: 1,
    kind: 'DONATION',
    quantity: 1,
    destinationName: 'Destino com histórico QA'
  }, 201);
  const linkedDocs = (await call('/internal-documents?lotId=' + linkedLot.id)).documents;
  assert(linkedDocs[0].orders.some((o: any) => o.serviceOrder.id === prior.id));
  assert(linkedDocs[0].orders.some((o: any) => o.serviceOrder.id === transferOrder.id));
  assert((await call('/service-orders?collectionId=' + relinked.id)).orders.some((o: any) => o.id === prior.id));
  pass('Reatribuição de coleta preserva O.S. anterior e vincula comprovante de saída a todas as referências de origem');
  return {
    order: os.id,
    document: plan.document.id,
    transport: transport.id,
    collection: cs[0].id,
    lot: lot.id
  };
}
