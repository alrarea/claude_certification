import { defineBackend } from "@aws-amplify/backend";
import { FunctionUrlAuthType, HttpMethod, type Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { apiFunction } from "./functions/api/resource";

const backend = defineBackend({
  apiFunction,
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

backend.addOutput({
  custom: {
    apiUrl: functionUrl.url,
  },
});
