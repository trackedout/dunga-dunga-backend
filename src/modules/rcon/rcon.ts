import { Rcon } from 'rcon-client';

// TODO: Replace rcon password with environment variable
export async function executeRconCommand(
  command: string,
  host: string,
  port: number = 25575,
  password: string = 'd34f080f24076e4b74c82b9a'
) {
  const rcon = new Rcon({
    host,
    port,
    password,
    timeout: 200,
  });

  rcon.on('connect', () => console.log(`Rcon: connected to ${host}`));
  rcon.on('authenticated', () => console.log(`Rcon: authenticated to ${host}`));
  // rcon.on("end", () => console.log("end"))
  rcon.on('error', (error: Error) => console.error(`Rcon: error from ${host} for command [${command}]:`, error));

  await rcon.connect().catch((error: Error) => {
    console.error(`Rcon: error connecting to ${host} for command [${command}]: ${error}`);
    throw error;
  });

  const result = await rcon.send(command).catch((error: Error) => {
    console.error(`Rcon: error from ${host} for command [${command}]: ${error}`);
    if (error.message.startsWith('Timeout for packet id')) {
      // Not really an error because Rcon does stupid things, and usually doesn't reply in time (or at all)
      console.warn('Suppressing timeout error');
      return '(suppressed timeout error)';
    }
    throw error;
  });
  console.log(`Rcon: result from executing [${command}] against ${host}: ${result}`);

  rcon.end().catch((error: Error) => {
    console.error(`Rcon: error from ${host} for command [${command}]: ${error}`);
    throw error;
  });
}
