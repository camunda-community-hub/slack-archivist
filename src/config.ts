import { Configuration } from "./lib/Configuration";

let configJSON;
try {
  configJSON = require("../config");
  console.log("Loaded configuration from config.json");
} catch (e) {
  console.log("Error loading ../config.json.");
}

export const configuration = new Configuration(configJSON).validate();

if (!configuration.isValid) {
  console.log("Missing required configuration to run!");
  console.log("Missing values for: ");
  console.log(JSON.stringify(configuration.missingRequiredKeys, null, 2));
  console.log(
    "See the README for configuration schema, and make sure either env vars are set or a config.json is available"
  );
  process.exit(1);
}
