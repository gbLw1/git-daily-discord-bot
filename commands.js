import "dotenv/config";
import { InstallGlobalCommands } from "./utils.js";

// From command
const DAILYFROM_COMMAND = {
  name: "dailyfrom",
  description: "Get user information",
  type: 1, // Slash command
  integration_types: [0, 1], // Global and Application
  contexts: [0, 1, 2], // Global, Application, and Message
};

const ALL_COMMANDS = [DAILYFROM_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
