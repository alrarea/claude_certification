import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import { prisma } from "@claude-cert/db";

// Local dev-server.ts has no WebSocket API in front of it, so this env var
// is simply unset there - every broadcast becomes a safe no-op, which is
// what lets the REST state machine be fully tested without a deployed
// sandbox (see the plan's verification notes).
function client(): ApiGatewayManagementApiClient | null {
  const endpoint = process.env.WEBSOCKET_MANAGEMENT_URL;
  if (!endpoint) return null;
  return new ApiGatewayManagementApiClient({ endpoint });
}

export async function broadcastToLiveExam(liveExamId: string, payload: unknown): Promise<void> {
  const mgmt = client();
  if (!mgmt) return;

  const connections = await prisma.liveExamConnection.findMany({
    where: { liveExamId },
    select: { id: true, connectionId: true },
  });
  if (connections.length === 0) return;

  const data = Buffer.from(JSON.stringify(payload));
  const staleIds: string[] = [];

  await Promise.all(
    connections.map(async (conn) => {
      try {
        await mgmt.send(new PostToConnectionCommand({ ConnectionId: conn.connectionId, Data: data }));
      } catch (err) {
        // GoneException = the client disconnected without a clean
        // $disconnect (closed tab, lost network) - prune the stale row.
        if (err instanceof GoneException) {
          staleIds.push(conn.id);
        }
      }
    })
  );

  if (staleIds.length > 0) {
    await prisma.liveExamConnection.deleteMany({ where: { id: { in: staleIds } } });
  }
}
