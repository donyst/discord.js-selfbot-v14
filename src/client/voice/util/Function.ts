import dgram, { type SocketType } from 'node:dgram';
import { setImmediate } from 'node:timers';

export interface InterfaceAddresses {
  udp4?: string;
  udp6?: string;
}

export function interfaceAddress(type: SocketType, interfaceAddresses?: InterfaceAddresses): string | undefined {
  return interfaceAddresses ? interfaceAddresses[type as keyof InterfaceAddresses] : undefined;
}

export async function randomPort(protocol: SocketType = 'udp4', interfaceAddresses?: InterfaceAddresses): Promise<number> {
  const socket = dgram.createSocket(protocol);

  setImmediate(() =>
    socket.bind({
      port: 0,
      address: interfaceAddress(protocol, interfaceAddresses),
    }),
  );

  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.once('listening', () => resolve());
  });

  const port = socket.address()?.port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  return port;
}

export async function randomPorts(num: number, protocol: SocketType = 'udp4', interfaceAddresses?: InterfaceAddresses): Promise<number[]> {
  return Promise.all(Array.from({ length: num }).map(() => randomPort(protocol, interfaceAddresses)));
}

export async function findPort(min: number, max: number, protocol: SocketType = 'udp4', interfaceAddresses?: InterfaceAddresses): Promise<number> {
  let port: number | undefined;

  for (let i = min; i <= max; i++) {
    const socket = dgram.createSocket(protocol);

    setImmediate(() =>
      socket.bind({
        port: i,
        address: interfaceAddress(protocol, interfaceAddresses),
      }),
    );

    const error = await new Promise<Error | null>(resolve => {
      socket.once('error', (err: Error) => resolve(err));
      socket.once('listening', () => resolve(null));
    });

    await new Promise<void>(resolve => socket.close(() => resolve()));

    if (error) continue;

    const addressInfo = socket.address();
    if (addressInfo && addressInfo.port >= min && addressInfo.port <= max) {
      port = addressInfo.port;
      break;
    }
  }

  if (!port) throw new Error('port not found');
  return port;
}

export interface StreamKeyParsed {
  type: string;
  guildId: string | null;
  channelId: string;
  userId: string;
}

export function parseStreamKey(key: string): StreamKeyParsed {
  const arr = key.split(':');
  const type = arr[0] ?? '';
  const guildId = type === 'guild' ? (arr[1] ?? null) : null;
  const channelId = (type === 'guild' ? arr[2] : arr[1]) ?? '';
  const userId = (type === 'guild' ? arr[3] : arr[2]) ?? '';
  return { type, guildId, channelId, userId };
}

export default {
  randomPort,
  randomPorts,
  findPort,
  interfaceAddress,
  parseStreamKey,
};
