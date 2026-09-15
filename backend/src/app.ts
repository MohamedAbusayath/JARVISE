import express from "express";
import cors from "cors";

import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error.middleware";
import { notFoundHandler } from "./middleware/notFound.middleware";
import { requestLogger } from "./middleware/requestLogger.middleware";

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
