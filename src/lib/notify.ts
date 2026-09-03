import type { AuthenticatedProject } from "./apiKey";
import { prisma } from "./db";
import type { CapturedEventInput } from "./eventSchema";
import { getNotificationService } from "./notification";
import { buildNotificationPayload, determineNotificationType } from "./notificationRules";
import type { PersistedEvent } from "./persistEvent";

/**
 * Called after persistEvent() has already committed — a notification
 * failure must never affect whether the event itself was saved. This
 * function itself doesn't swallow errors (so it stays testable/composable);
 * the route calling it is responsible for treating it as best-effort (see
 * events/route.ts).
 *
 * Notifies the owner *and* every project member — not owner-only. This was
 * owner-only from Phase 12, which predates Phase 15's direct-membership
 * model; that was never revisited when members were introduced, so a member
 * (e.g. someone who only self-assigns errors) never got an ingestion push
 * even though they can get an ASSIGNED_ERROR one. The owner never has their
 * own ProjectMember row (see schema.prisma), so there's no double-notify.
 */
export async function notifyIfNeeded(
  project: AuthenticatedProject,
  event: CapturedEventInput,
  persisted: PersistedEvent,
): Promise<void> {
  const members = await prisma.projectMember.findMany({
    where: { projectId: project.id },
    select: { userId: true },
  });
  const recipientIds = project.ownerId ? [project.ownerId, ...members.map((m) => m.userId)] : members.map((m) => m.userId);

  if (recipientIds.length === 0) {
    return; // no owner, no members — no one to notify
  }

  const type = determineNotificationType(event, persisted);
  const payload = buildNotificationPayload(type, project.id, event, persisted);
  const service = getNotificationService();
  await Promise.all(recipientIds.map((userId) => service.notifyUser(userId, payload)));
}
