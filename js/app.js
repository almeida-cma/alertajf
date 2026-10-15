import { AlertModel } from "./models/AlertModel.js";
import { AlertView } from "./views/AlertView.js";
import { AlertController } from "./controllers/AlertController.js";

document.addEventListener("DOMContentLoaded", () => {
  const model = new AlertModel();
  const view = new AlertView();
  const controller = new AlertController(model, view);

  controller.init();
});