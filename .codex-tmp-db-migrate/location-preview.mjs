import { fork } from "node:child_process";

if (process.argv.includes("--serve")) {
  const { createApp } = await import("../dist/app.js");
  const { env } = await import("../dist/config/env.js");
  const app = createApp();
  let port = 4010;
  const listen = () => {
    const server = app.listen(port, "127.0.0.1");
    server.once("listening", () => {
      process.send?.({ url: `http://127.0.0.1:${port}${env.APP_BASE_PATH || ""}/` });
      process.disconnect();
    });
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" && port < 4020) { port++; listen(); }
      else { process.send?.({ error: "Unable to start local preview." }); process.exit(1); }
    });
  };
  listen();
} else {
  const child = fork(new URL(import.meta.url), ["--serve"], { detached: true, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const result = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Preview exited with code ${code}`)));
  });
  child.unref();
  if (result.error) throw new Error(result.error);
  console.log(result.url);
}
