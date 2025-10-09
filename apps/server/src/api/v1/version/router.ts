import PromiseRouter from "express-promise-router";
import { VersionController } from "./controller";

export default function createVersionRouter(
  versionController: VersionController,
) {
  const router = PromiseRouter();

  // Use get() for a single endpoint
  router.get("/", versionController.getVersionHandler);

  return router;
}
