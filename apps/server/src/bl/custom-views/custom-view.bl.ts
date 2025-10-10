import { AuditActionType, AuditResourceType, User } from "@OpsiMate/shared";
import { AuditLogRepository } from "../../dal/auditLogRepository";
import { SavedView, ViewRepository } from "../../dal/viewRepository";
import { AuditBL } from "../audit/audit.bl";

export class ViewBL {
  constructor(private viewRepository: ViewRepository) {}

  /**
   * Get all views
   */
  async getAllViews(): Promise<SavedView[]> {
    return await this.viewRepository.getAllViews();
  }

  /**
   * Get a specific view by ID
   */
  async getViewById(id: string): Promise<SavedView | null> {
    return await this.viewRepository.getViewById(id);
  }

  /**
   * Create a new view or update an existing one
   */
  async saveView(view: SavedView, user: User): Promise<SavedView | null> {
    const existingView = await this.viewRepository.getViewById(view.id);
    const auditBL = new AuditBL(
      new AuditLogRepository(this.viewRepository["db"]),
    );

    if (existingView) {
      const savedView = await this.viewRepository.updateView(view);

      if (savedView) {
        await auditBL.logAction({
          actionType: AuditActionType.UPDATE,
          resourceType: AuditResourceType.VIEW,
          resourceId: view.id,
          userId: user.id,
          userName: user.fullName,
          resourceName: view.name,
          details: JSON.stringify(savedView),
        });
      }

      return savedView;
    } else {
      const savedView = await this.viewRepository.createView(view);

      if (savedView) {
        await auditBL.logAction({
          actionType: AuditActionType.CREATE,
          resourceType: AuditResourceType.VIEW,
          resourceId: savedView.id,
          userId: user.id,
          userName: user.fullName,
          resourceName: view.name,
          details: JSON.stringify(savedView),
        });
      }

      return savedView;
    }
  }

  /**
   * Delete a view
   */
  async deleteView(id: string): Promise<boolean> {
    const view = await this.viewRepository.getViewById(id);
    if (view && view.isDefault) {
      return false;
    }

    const existingView = await this.viewRepository.getViewById(id);
    if (!existingView) {
      return false;
    }

    return await this.viewRepository.deleteView(id);
  }

  /**
   * Set active view ID
   */
  async setActiveViewId(viewId: string): Promise<boolean> {
    const view = await this.viewRepository.getViewById(viewId);

    if (!view) {
      throw new Error("View not found");
    }

    return await this.viewRepository.saveActiveViewId(viewId);
  }

  /**
   * Get active view ID
   */
  async getActiveViewId(): Promise<string | null> {
    return await this.viewRepository.getActiveViewId();
  }

  /**
   * Initialize the views tables
   */
  async initViewsTables(): Promise<void> {
    await this.viewRepository.initViewsTable();
  }
}
