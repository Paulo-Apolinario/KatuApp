import { FastifyInstance } from "fastify";
import { WasteStockController } from "./waste-stock.controller";

const wasteStockController = new WasteStockController();

export async function wasteStockRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/api/waste-stock/ping", async () => {
    return {
      ok: true,
      module: "waste-stock",
    };
  });

  app.get("/api/waste-stock", wasteStockController.listMine);
  app.post("/api/waste-stock", wasteStockController.create);
  app.get("/api/waste-stock/:id", wasteStockController.findById);
  app.put("/api/waste-stock/:id", wasteStockController.update);
  app.delete("/api/waste-stock/:id", wasteStockController.delete);

  app.get("/api/waste-stock/:id/lots", wasteStockController.listLots);
  app.post("/api/waste-stock/:id/lots", wasteStockController.createLot);

  app.put("/api/waste-stock/lots/:lotId", wasteStockController.updateLot);
  app.delete("/api/waste-stock/lots/:lotId", wasteStockController.deleteLot);
}