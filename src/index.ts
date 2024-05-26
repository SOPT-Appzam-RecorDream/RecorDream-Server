import express, { Request, Response, NextFunction } from "express";
import connectDB from "./loaders/db";
import routes from "./routes";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import cors from "cors";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

const app = express();
connectDB();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const whitelist = ["https://recordream-web.vercel.app", "http://localhost:5173"];
const corsOptions: cors.CorsOptions = {
  origin: whitelist,
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(routes); //라우터
// error handler
const swaggerSpec = YAML.load(path.join(__dirname, "../build/swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

interface ErrorType {
  message: string;
  status: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function (err: ErrorType, req: Request, res: Response, next: NextFunction) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "production" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

app
  .listen(process.env.PORT, () => {
    console.log(`
    ################################################
          🛡️  Server listening on port 🛡️
    ################################################
  `);
  })
  .on("error", (err) => {
    console.error(err);
    process.exit(1);
  });
