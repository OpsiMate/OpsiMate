/* eslint-disable @typescript-eslint/no-misused-promises */
import PromiseRouter from "express-promise-router";
import { CustomFieldsController } from "./controller";

export default function createCustomFieldsRouter(
  customFieldsController: CustomFieldsController,
) {
  const router = PromiseRouter();

  // Custom Field CRUD operations
  // POST /api/v1/custom-fields
  router.post("/", customFieldsController.createCustomField);

  // GET /api/v1/custom-fields
  router.get("/", customFieldsController.getCustomFields);

  // GET /api/v1/custom-fields/:id
  router.get("/:id", customFieldsController.getCustomFieldById);

  // PUT /api/v1/custom-fields/:id
  router.put("/:id", customFieldsController.updateCustomField);

  // DELETE /api/v1/custom-fields/:id
  router.delete("/:id", customFieldsController.deleteCustomField);

  // Custom Field Value operations
  // POST /api/v1/custom-fields/values
  router.post("/values", customFieldsController.upsertCustomFieldValue);

  // GET /api/v1/custom-fields/services/:serviceId/values
  router.get(
    "/services/:serviceId/values",
    customFieldsController.getCustomFieldValuesForService,
  );

  // DELETE /api/v1/custom-fields/services/:serviceId/values/:customFieldId
  router.delete(
    "/services/:serviceId/values/:customFieldId",
    customFieldsController.deleteCustomFieldValue,
  );

  return router;
}
