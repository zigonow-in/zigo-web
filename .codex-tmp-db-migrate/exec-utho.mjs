import { Client } from "ssh2";

const command = process.argv.slice(2).join(" ");
if (!command) throw new Error("Missing remote command");

const client = new Client();
client
  .on("ready", () => {
    client.exec(command, (error, stream) => {
      if (error) throw error;
      stream.on("data", (data) => process.stdout.write(data));
      stream.stderr.on("data", (data) => process.stderr.write(data));
      stream.on("close", (code) => {
        client.end();
        process.exitCode = code || 0;
      });
    });
  })
  .on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .connect({
    host: "103.209.146.160",
    username: "root",
    password: "@5b6VjEb6BNByN",
    readyTimeout: 20_000
  });
