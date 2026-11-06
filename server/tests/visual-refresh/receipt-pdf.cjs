/** Run: node --import tsx tests/visual-refresh/receipt-pdf.cjs. Requires local Poppler. */
const assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const {buildReceiptPdfDocument}=require("../../../src/services/receiptPdfDocument.ts");
const user={name:"Catador QA",cooperativeName:"Cooperativa QA",code:"collector-qa"};
async function pdf(data,receipt){
 const bytes=Buffer.from(await(await buildReceiptPdfDocument(data,receipt)).arrayBuffer());
 assert.equal(bytes.subarray(0,4).toString(),"%PDF");
 return {text:execFileSync("pdftotext",["-","-"],{input:bytes,encoding:"utf8"}),info:execFileSync("pdfinfo",["-"],{input:bytes,encoding:"utf8"})};
}
(async()=>{
 const oil={type:"Óleo",quantity:80,quantityKg:0,unit:"LITER"};
 const receipt={id:"oil-qa",date:"06/11/2026",local:"Origem QA",kg:0,materials:[oil]};
 const single=await pdf(user,receipt);assert(single.text.includes("80 L"));assert(single.text.includes("Óleo"));assert(!/\b0 kg\b/.test(single.text));
 console.log("PASS PDF de óleo preserva 80 L sem zero kg fictício");
 const mixed=await pdf({...user,collectionCount:2,topMaterials:[oil,{type:"Papelão",quantity:25,quantityKg:25,unit:"KG"}]});
 assert(mixed.text.includes("80 L · 25 kg"));assert(!mixed.text.includes("105 kg"));console.log("PASS PDF consolidado separa volume e massa");
 const revised=await pdf(user,{...receipt,materials:[{type:"Papelão",quantity:40,quantityKg:40,unit:"KG"}],quantityReviews:[{version:1,actorName:"Cooperativa QA",createdAt:"2026-11-06T06:00:00Z",reason:"Balança conferida",items:[{name:"Papelão",unit:"KG",reportedQuantity:50,previousQuantity:50,confirmedQuantity:40}]}]});
 assert(revised.text.includes("50 kg"));assert(revised.text.includes("40 kg"));assert(revised.text.includes("Conferência 1"));console.log("PASS PDF mantém quantidades informadas e conferidas");
 const many=await pdf({...user,collectionCount:85,topMaterials:Array.from({length:85},(_,i)=>({...oil,type:`Material QA ${i+1}`,quantity:i+1}))});
 assert(many.text.includes("Material QA 85"));assert(many.text.includes("3.655 L"));assert(Number(many.info.match(/Pages:\s+(\d+)/)[1])>1);console.log("PASS PDF de 85 materiais pagina sem perder registros");
})().catch(e=>{console.error(e);process.exitCode=1;});
