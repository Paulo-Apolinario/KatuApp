import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDocument, validDocument, documentType, generatorCategory } from "../../src/modules/generators/generator-document";
async function main() {
  const panel = process.env.KATUA_PANEL_FRONTEND;
  if (!panel) throw Error("Informe o frontend para validar os dois contratos.");
  const ui = await import(pathToFileURL(path.join(panel,"src/utils/generatorDocument.js")).href);
  const cases: [string,boolean][] = [["529.982.247-25",true],["12345678909",true],["11.222.333/0001-81",true],["04.252.011/0001-10",true],["12.abc.345/01de-35",true],["00000000000",false],["11111111111",false],["00000000000000",false],["52998224726",false],["11222333000182",false],["12ABC34501DE34",false],["12ABC34501DEX5",false],["12ABC34501DE3A",false],["52998224725!",false],["CPF 52998224725",false],["",false],["5299822472",false],["123456789012345",false]];
  for(const [value,expected] of cases) { assert.equal(validDocument(value),expected,value);assert.equal(ui.validDocument(value),expected,value);assert.equal(ui.documentType(value),documentType(value)); }
  console.log("PASS Servidor e Painel concordam em 18 casos de CPF/CNPJ, incluindo o exemplo alfanumérico oficial");
  for(const [value,expected] of [["52998224725","529.982.247-25"],["11222333000181","11.222.333/0001-81"],["12abc34501de35","12.ABC.345/01DE-35"],["529982247","529.982.247"],["5299822472","529.982.247-2"],["",""],["12ABC34501DE","12.ABC.345/01DE"]]) assert.equal(ui.formatDocument(value),expected);
  for(const value of ["529.982.247-25","11.222.333/0001-81","12.ABC.345/01DE-35"]) assert.equal(ui.formatDocument(ui.formatDocument(value)),ui.formatDocument(value));
  assert.equal(ui.formatDocument("529.982.247-2"),"529.982.247-2");assert.equal(normalizeDocument(" 12.abc.345/01de-35 "),"12ABC34501DE35");
  console.log("PASS Máscara permite digitar, colar, apagar e reformatar sem perder caracteres de CPF/CNPJ");
  for(const [type,doc,expected] of [["SMALL","52998224725","REGISTERED_RESIDENTIAL"],["SMALL","11222333000181","SMALL_BUSINESS"],["SMALL",null,"PENDING_DOCUMENT"],["LARGE",null,"LARGE"]]) {assert.equal(generatorCategory(type,doc),expected);assert.equal(ui.generatorCategory({type,documentNumber:doc}),expected);}
  console.log("PASS Classificação não depende do nome ou razão social e mantém registro legado pendente");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
