import { NHttp } from "../mod.ts";

const app = new NHttp();

app.use(({ response, request }, next) => {
  // example header
  response.header({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
  });
  if (request.method == "OPTIONS") {
    return response.send();
  }
  return next();
});

app.get("/", ({ response }) => {
  return response.send("Hello Cors");
});

app.listen(8000, (_err, info) => {
  console.log(`Running on port ${info?.port}`);
});
