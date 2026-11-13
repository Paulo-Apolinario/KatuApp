export type CreatePoint = { latitude: number; longitude: number };
export function validCreatePoint(value: unknown): CreatePoint | null {
  if (!value || typeof value !== 'object') return null;
  const point=value as Partial<CreatePoint>;
  if(typeof point.latitude!=='number'||typeof point.longitude!=='number'||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return null;
  return {latitude:point.latitude,longitude:point.longitude};
}
// A server-rejected operation becomes a new draft, with all contact data intact.
export function recoveredCreateDraft(payload: Record<string,any>,pev:boolean){
 const point=validCreatePoint(payload),type:'SMALL'|'LARGE'=payload.type==='LARGE'?'LARGE':'SMALL';
 return {form:{name:payload.name||'',email:payload.email||'',recoveryEmail:payload.recoveryEmail||'',phone:payload.phone||'',companyName:payload.companyName||'',documentNumber:payload.documentNumber||'',zipCode:payload.zipCode||'',street:payload.street||'',number:payload.number||'',neighborhood:payload.neighborhood||'',city:payload.city||'',state:payload.state||'CE',notes:payload.notes||'',acceptedMaterials:Array.isArray(payload.acceptedMaterials)?payload.acceptedMaterials.join(', '):''},type,point,confirmed:point!==null,pev};
}
