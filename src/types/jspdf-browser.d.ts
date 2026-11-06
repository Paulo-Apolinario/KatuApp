// Explicit browser build avoids Node/AMD optional loaders during Expo SSR bundling.
declare module "jspdf/dist/jspdf.es.min.js" {
  export { jsPDF } from "jspdf";
}
