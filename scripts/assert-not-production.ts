import "dotenv/config";

import { assertNonProductionOperation } from "../src/lib/app-environment";

const operation = process.argv.slice(2).join(" ").trim() || "this operation";

assertNonProductionOperation(operation);
