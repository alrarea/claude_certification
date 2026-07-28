import type { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { prisma } from "@claude-cert/db";
import { verifyAccessToken } from "../api/lib/jwt.ts";

// Clients never send messages over this socket - every live-exam action is
// a normal REST call to the main API Lambda, which broadcasts pushes here
// via liveExamBroadcast.ts. This handler only exists to track which
// connectionId belongs to which live exam, for that broadcast to address.
export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const { connectionId } = event.requestContext;
  const eventType = event.requestContext.eventType;

  if (eventType === "CONNECT") {
    const token = event.queryStringParameters?.token;
    const liveExamId = event.queryStringParameters?.liveExamId;
    if (!token || !liveExamId) {
      return { statusCode: 400, body: "Missing token or liveExamId" };
    }

    let userId: string;
    try {
      const claims = await verifyAccessToken(token);
      userId = claims.sub;
    } catch {
      return { statusCode: 401, body: "Invalid or expired token" };
    }

    const liveExam = await prisma.liveExam.findUnique({ where: { id: liveExamId } });
    if (!liveExam) {
      return { statusCode: 404, body: "Live exam not found" };
    }

    await prisma.liveExamConnection.create({
      data: { connectionId, liveExamId, userId },
    });
    return { statusCode: 200, body: "Connected" };
  }

  if (eventType === "DISCONNECT") {
    await prisma.liveExamConnection.deleteMany({ where: { connectionId } });
    return { statusCode: 200, body: "Disconnected" };
  }

  // eventType === "MESSAGE" - unused, but API Gateway still expects a response.
  return { statusCode: 200, body: "" };
}
