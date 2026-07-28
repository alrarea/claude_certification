import { defineBackend } from "@aws-amplify/backend";
import { FunctionUrlAuthType, HttpMethod, type Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { WebSocketApi, WebSocketStage } from "aws-cdk-lib/aws-apigatewayv2";
import { WebSocketLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { RemovalPolicy, Stack } from "aws-cdk-lib";
import { apiFunction } from "./functions/api/resource.ts";
import { websocketFunction } from "./functions/websocket/resource.ts";

const backend = defineBackend({
  apiFunction,
  websocketFunction,
});

// Function URL instead of API Gateway — see spec Section 4b (Always Free vs.
// API Gateway's time-limited/credit-drawdown free tier).
// `resources.lambda` is typed as the narrower `IFunction` CDK interface;
// the concrete `Function` construct is what defineFunction() actually returns,
// and is required here for addFunctionUrl/addEnvironment.
const apiLambda = backend.apiFunction.resources.lambda as LambdaFunction;

const functionUrl = apiLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: [process.env.FRONTEND_ORIGIN ?? "*"],
    allowedMethods: [HttpMethod.ALL],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

apiLambda.addEnvironment("FRONTEND_ORIGIN", process.env.FRONTEND_ORIGIN ?? "");

// Document uploads (spec Section 11) - Lambda has no persistent local disk,
// so uploaded source documents go to S3. Private bucket, no public access;
// the Lambda reads/writes via IAM, never a public URL.
const uploadsBucketStack = Stack.of(apiLambda);
const uploadsBucket = new Bucket(uploadsBucketStack, "DocumentUploadsBucket", {
  blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
  removalPolicy: RemovalPolicy.RETAIN,
});
uploadsBucket.grantReadWrite(apiLambda);
apiLambda.addEnvironment("UPLOADS_BUCKET_NAME", uploadsBucket.bucketName);

// Live exam sessions (host-controlled, synchronized multi-user quizzes) need
// real-time push, which the Function URL above can't do - it's plain HTTP.
// This is the first API Gateway resource in the project; everything else
// deliberately avoids API Gateway to stay on the Always Free tier (see the
// Function URL comment above), but there's no Function-URL equivalent for
// WebSocket. `websocketFunction`'s handler only tracks connect/disconnect
// (see functions/websocket/handler.ts) - all actual live-exam actions are
// normal REST calls to `apiLambda`, which pushes updates out over these
// connections via liveExamBroadcast.ts.
const wsLambda = backend.websocketFunction.resources.lambda as LambdaFunction;

const webSocketApi = new WebSocketApi(uploadsBucketStack, "LiveExamWebSocketApi", {
  connectRouteOptions: { integration: new WebSocketLambdaIntegration("ConnectIntegration", wsLambda) },
  disconnectRouteOptions: { integration: new WebSocketLambdaIntegration("DisconnectIntegration", wsLambda) },
  defaultRouteOptions: { integration: new WebSocketLambdaIntegration("DefaultIntegration", wsLambda) },
});
const webSocketStage = new WebSocketStage(uploadsBucketStack, "LiveExamWebSocketStage", {
  webSocketApi,
  stageName: "prod",
  autoDeploy: true,
});

// Only apiLambda ever posts to connections (from REST handlers) - wsLambda
// itself never broadcasts, it only records/removes connection rows.
webSocketStage.grantManagementApiAccess(apiLambda);
apiLambda.addEnvironment("WEBSOCKET_MANAGEMENT_URL", webSocketStage.callbackUrl);

backend.addOutput({
  custom: {
    apiUrl: functionUrl.url,
    webSocketUrl: webSocketStage.url,
  },
});
