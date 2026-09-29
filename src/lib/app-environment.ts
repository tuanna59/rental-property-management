export type AppEnvironment = "development" | "production";

export function getAppEnvironment(
  source: Record<string, string | undefined> = process.env,
): AppEnvironment {
  return source.APP_ENV === "production" ? "production" : "development";
}

export function assertNonProductionOperation(
  operation: string,
  source: Record<string, string | undefined> = process.env,
) {
  if (getAppEnvironment(source) === "production") {
    throw new Error(`Refusing to run ${operation} in production.`);
  }
}
