import { Rcon } from "rcon-client";

// TODO: Replace rcon password with environment variable
export async function executeRconCommand(command: string, host: string, port: number = 25575, password: string = "d34f080f24076e4b74c82b9a") {
  const rcon = new Rcon({
    host: host,
    port: port,
    password: password
  });

  rcon.on("connect", () => console.log(`Rcon: connected to ${host}`))
  rcon.on("authenticated", () => console.log(`Rcon: authenticated to ${host}`))
  // rcon.on("end", () => console.log("end"))
  rcon.on("error", (error: Error) => console.error(`Rcon: error from ${host} for command [${command}]:`, error))

  await rcon.connect()
    .catch((error: Error) => {
      console.error(`Rcon: error connecting to ${host} for command [${command}]: ${error}`);
      throw error;
    });

  const result = await rcon.send(command)
    .catch((error: Error) => {
      console.error(`Rcon: error from ${host} for command [${command}]: ${error}`);
      throw error;
    });
  console.log(`Rcon: result from executing [${command}] against ${host}: ${result}`)

  await rcon.end()
    .catch((error: Error) => {
      console.error(`Rcon: error from ${host} for command [${command}]: ${error}`);
      throw error;
    });
}
