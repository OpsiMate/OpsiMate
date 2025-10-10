import { Request, Response } from "express";
import { ViewBL } from "../../../bl/custom-views/custom-view.bl";
import { Logger } from "@OpsiMate/shared";
import { SavedView } from "../../../dal/viewRepository";
import { AuthenticatedRequest } from "../../../middleware/auth";

const logger = new Logger("api/v1/views/controller");

export class ViewController {
  constructor(private viewBL: ViewBL) {}

  getViewsHandler = async (req: Request, res: Response) => {
    try {
      const views = await this.viewBL.getAllViews();
      return res.json({ success: true, data: views });
    } catch (error) {
      logger.error("Error getting views:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to get views" });
    }
  };

  getViewsByIdHandler = async (req: Request, res: Response) => {
    try {
      const viewId = req.params.viewId;
      const view = await this.viewBL.getViewById(viewId);

      if (!view) {
        return res
          .status(404)
          .json({ success: false, error: "View not found" });
      }

      return res.json({ success: true, data: view });
    } catch (error) {
      logger.error("Error getting view:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to get view" });
    }
  };

  createViewHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // todo: should use zod schema
      const view = req.body as SavedView;
      const user = req.user;

      if (!view || !view.id || !view.name) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid view data" });
      }

      if (!user) {
        return res
          .status(401)
          .json({ success: false, error: "Unauthorized: user not found" });
      }

      const savedView = await this.viewBL.saveView(view, user);

      if (!savedView) {
        return res
          .status(500)
          .json({ success: false, error: "Failed to save view" });
      }

      return res.json({ success: true, data: savedView });
    } catch (error) {
      logger.error("Error saving view:", error);
      const message = error instanceof Error ? error.message : String(error);
      return res
        .status(500)
        .json({ success: false, error: message || "Failed to save view" });
    }
  };

  deleteViewHandler = async (req: Request, res: Response) => {
    try {
      const viewId = req.params.viewId;
      const success = await this.viewBL.deleteView(viewId);

      if (!success) {
        return res
          .status(404)
          .json({
            success: false,
            error: "View not found or could not be deleted",
          });
      }

      return res.json({ success: true, message: "View deleted successfully" });
    } catch (error) {
      logger.error("Error deleting view:", error);
      const message = error instanceof Error ? error.message : String(error);
      return res
        .status(500)
        .json({ success: false, error: message || "Failed to delete view" });
    }
  };

  setActiveViewHandler = async (req: Request, res: Response) => {
    try {
      const viewId = req.params.viewId;
      const success = await this.viewBL.setActiveViewId(viewId);

      if (!success) {
        return res
          .status(404)
          .json({
            success: false,
            error: "View not found or could not be set as active",
          });
      }

      return res.json({
        success: true,
        message: "Active view set successfully",
      });
    } catch (error) {
      logger.error("Error setting active view:", error);
      const message = error instanceof Error ? error.message : String(error);
      return res
        .status(500)
        .json({
          success: false,
          error: message || "Failed to set active view",
        });
    }
  };

  getActiveViewHandler = async (req: Request, res: Response) => {
    try {
      const activeViewId = await this.viewBL.getActiveViewId();
      return res.json({ success: true, data: { activeViewId } });
    } catch (error) {
      logger.error("Error getting active view ID:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to get active view ID" });
    }
  };
}
