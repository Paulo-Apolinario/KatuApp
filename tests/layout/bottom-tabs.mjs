import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const root = resolve(
  process.env.KATUA_APP_WEB_EXPORT ||
    "../../validation-tools/gps-web-export",
);
const out = await mkdtemp(
  join(process.env.KATUA_VALIDATION_OUTPUT_ROOT || tmpdir(), "katua-tabs-"),
);
const req = createRequire(
  resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
);
const { chromium } = req(process.env.KATUA_PLAYWRIGHT_MODULE || "playwright");
const server = createServer(async (r, p) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(r.url, "http://localhost").pathname),
    );
    if (!file.startsWith(root + "/") && file !== root) {
      p.writeHead(403).end();
      return;
    }
    if (file === root) file = join(root, "index.html");
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      file += ".html";
    }
    const body = await readFile(file);
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".wasm": "application/wasm",
      ".json": "application/json",
      ".png": "image/png",
      ".ttf": "font/ttf",
    };
    p.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    p.end(body);
  } catch {
    p.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(8089, "127.0.0.1", r));
let browser;
const outcomes=[];
try {
  browser = await chromium.launch({ executablePath: process.env.KATUA_CHROMIUM_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"], headless: true });
  const profiles=[{role:"COLLECTOR",group:"catador",screen:"homecat"},{role:"PF",group:"pf-tabs",screen:"home"},{role:"GENERATOR_SMALL",group:"gerador",screen:"dashboard"}];
  for(const safeBottom of [0,34]) for(const profile of profiles){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await context.addInitScript(safeBottom=>{
      // Simula a área segura retornada pelo ambiente; não modifica a barra sob teste.
      const append=Element.prototype.appendChild;
      Element.prototype.appendChild=function(child){
        if(child instanceof HTMLElement && child.style.visibility==="hidden" && child.style.paddingBottom.includes("safe-area-inset-bottom"))child.style.paddingBottom=safeBottom+"px";
        return append.call(this,child);
      };
    },safeBottom);
    const user={id:"tabs-test",role:profile.role,displayName:"Teste da navegação"};
    await context.addInitScript(user=>{localStorage.setItem("@katu:token","tabs-test-session");localStorage.setItem("@katu:user",JSON.stringify(user));Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(_ok,err)=>err({code:1}),watchPosition:()=>1,clearWatch:()=>{}}});},user);
    await context.route("**/*",r=>{
      const url=new URL(r.request().url());
      if(["localhost","127.0.0.1"].includes(url.hostname))return r.continue();
      const body=url.pathname==="/auth/me"?{user}:url.pathname==="/collections"?{collections:[]}:url.pathname==="/schedules"?{schedules:[]}:url.pathname==="/routes"?{routes:[]}:{};
      return r.fulfill({status:200,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS"},contentType:"application/json",body:JSON.stringify(body)});
    });
    const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:8089/(${profile.group})/${profile.screen}`);
    await page.getByRole("tab").first().waitFor({timeout:30000});
    for(const [width,height] of [[320,568],[390,844],[844,390]]){
      await page.setViewportSize({width,height});
      await page.waitForTimeout(200);
      const geometry=await page.getByRole("tab").evaluateAll(tabs=>tabs.map(tab=>{
        const texts=[...tab.querySelectorAll("[dir]")].filter(e=>e.textContent.trim()&&!e.children.length&&!e.closest('[aria-hidden="true"]'));
        const label=texts[texts.length-1];const t=tab.getBoundingClientRect(),l=label?.getBoundingClientRect();
        return {title:tab.getAttribute("aria-label"),tab:{x:t.x,y:t.y,width:t.width,height:t.height},label:l?{x:l.x,y:l.y,width:l.width,height:l.height}:null,viewport:{w:window.innerWidth,h:window.innerHeight},text:label?.textContent,labelMetrics:label?{fontSize:parseFloat(getComputedStyle(label).fontSize),lineHeight:parseFloat(getComputedStyle(label).lineHeight),scrollHeight:label.scrollHeight,clientHeight:label.clientHeight}:null};
      }));
      try{
        assert.equal(geometry.length,5);
        for(const item of geometry){const l=item.label;assert(l,"Rótulo ausente: "+item.title);assert(l.height>=item.labelMetrics.fontSize*1.05 && item.labelMetrics.scrollHeight<=item.labelMetrics.clientHeight+1,JSON.stringify(item));assert(l.y>=item.tab.y-1&&l.y+l.height<=item.tab.y+item.tab.height+1,JSON.stringify(item));assert(l.y+l.height<=item.viewport.h-safeBottom+1,JSON.stringify(item));assert(item.tab.width>=44&&item.tab.height>=44,JSON.stringify(item));}
        assert.deepEqual(errors,[]);outcomes.push({name:`${profile.role} ${width}x${height} área segura ${safeBottom}: 5 rótulos inteiros e alvos de toque`,status:"PASS"});console.log("PASS",profile.role,width,height,"safe",safeBottom);
      }catch(e){outcomes.push({name:`${profile.role} ${width}x${height} área segura ${safeBottom}`,status:"FAIL",error:e.message});console.log("FAIL",profile.role,width,height,"safe",safeBottom,e.message);}
    }
    await page.setViewportSize({width:390,height:844});
    if(profile.role==="COLLECTOR"){
      await page.evaluate(()=>{document.querySelectorAll('div').forEach(e=>{if(e.scrollHeight>e.clientHeight+20&&getComputedStyle(e).overflowY==='auto')e.scrollTop=e.scrollHeight;});});
      await page.screenshot({path:join(out,`catador-rodape-${safeBottom}.png`)});
      try {
        const last=await page.getByText("Encerrar sessão neste dispositivo",{exact:true}).boundingBox();
        const first=await page.getByRole("tab").first().boundingBox();
        assert(last && first && last.y+last.height<=first.y,"Última ação deve ficar acima da barra ao rolar até o final");
        await page.getByRole("tab",{name:/Recibos|Comprovantes/}).click();
        await page.waitForURL(/receipts/);
        outcomes.push({name:`Catador: final da rolagem acessível e navegação para comprovantes (área segura ${safeBottom})`,status:"PASS"});
        console.log("PASS rolagem e navegação",safeBottom);
      } catch(e) { outcomes.push({name:`Catador: rolagem/navegação (área segura ${safeBottom})`,status:"FAIL",error:e.message}); console.log("FAIL rolagem",e.message); }

    }
    await context.close();
  }
} finally {
  await browser?.close(); await new Promise(r=>server.close(r));
  await writeFile(join(out,"results.json"),JSON.stringify({environment:"Expo web exportado e Chromium móvel; API/sessão controladas",outcomes},null,2));
  console.log("REPORT_DIR",out);if(outcomes.some(x=>x.status==="FAIL"))process.exitCode=1;
}
