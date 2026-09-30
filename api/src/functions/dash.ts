import { app } from "@azure/functions";
import { dispatch } from "../dash/http.js";
import "../dash/authRoutes.js";
import "../dash/dataRoutes.js";

export function registerDash(): void {
  app.http("dashApi", {
    route: "dash/{*path}",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    authLevel: "anonymous",
    handler: dispatch,
  });
}
