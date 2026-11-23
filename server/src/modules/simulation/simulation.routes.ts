import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { simulationAction } from "./simulation.schemas";
import { actSimulation, enableSimulation, previewSimulation, simulationWorkspace, SimulationError } from "./simulation.service";
export async function simulationRoutes(app:FastifyInstance){
  app.addHook("preHandler",app.authenticate);
  const id=(r:any)=>z.string().min(1).max(100).parse(r.params.cooperativeId);
  const handle=(fn:(r:any)=>Promise<unknown>)=>async(r:any,p:any)=>{
    p.header("Cache-Control","private, no-store");
    try{return await fn(r);}catch(e:any){
      const code=e instanceof z.ZodError?400:e instanceof SimulationError?e.statusCode:e.statusCode||500;
      if(code===500)r.log.error({code:e.code},"Falha na simulação isolada");
      return p.code(code).send({error:e instanceof z.ZodError?e.issues.map(i=>i.message).join(" "):code!==500?e.message:"Não foi possível concluir a simulação. Atualize e confira o histórico antes de repetir."});
    }
  };
  app.get("/simulation/context",handle(r=>simulationWorkspace(r.user.sub)));
  app.get("/simulation/workspaces/:cooperativeId",handle(r=>simulationWorkspace(r.user.sub,id(r))));
  app.post("/simulation/workspaces/:cooperativeId/enable",handle(r=>enableSimulation(r.user.sub,id(r),z.object({enabled:z.boolean()}).strict().parse(r.body).enabled)));
  app.post("/simulation/workspaces/:cooperativeId/preview",handle(r=>previewSimulation(r.user.sub,id(r),r.body)));
  app.post("/simulation/workspaces/:cooperativeId/actions",handle(r=>actSimulation(r.user.sub,id(r),simulationAction.parse(r.body))));
}
