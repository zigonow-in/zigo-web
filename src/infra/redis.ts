import net from "node:net";
import tls from "node:tls";
import { URL } from "node:url";
import { env } from "../config/env.js";

export type RedisValue = string | number | null | RedisValue[];

type RedisConfig = {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  database: number | null;
  secure: boolean;
};

let unavailableUntil = 0;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL?.trim());
}

export async function redisCommand(args: string[], timeoutMs = 750): Promise<RedisValue | null> {
  const config = parseRedisUrl();
  if (!config || Date.now() < unavailableUntil) return null;

  return new Promise((resolve) => {
    const socket = createRedisSocket(config);
    let buffer = Buffer.alloc(0);
    let completed = false;
    const commands = [
      ...authCommands(config),
      ...(config.database != null ? [["SELECT", String(config.database)]] : []),
      args
    ];
    let repliesNeeded = commands.length;
    let lastReply: RedisValue | null = null;

    const finish = (value: RedisValue | null) => {
      if (completed) return;
      completed = true;
      socket.destroy();
      resolve(value);
    };

    const timer = setTimeout(() => {
      unavailableUntil = Date.now() + 5000;
      finish(null);
    }, timeoutMs);

    socket.once("connect", () => socket.write(commands.map(encodeCommand).join("")));
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (repliesNeeded > 0) {
        const parsed = parseResp(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.nextOffset);
        lastReply = parsed.value;
        repliesNeeded -= 1;
      }
      clearTimeout(timer);
      finish(lastReply);
    });
    socket.once("error", () => {
      unavailableUntil = Date.now() + 5000;
      clearTimeout(timer);
      finish(null);
    });
  });
}

export function redisSubscribe(channel: string, onMessage: (message: string) => void): () => void {
  const config = parseRedisUrl();
  if (!config || Date.now() < unavailableUntil) return () => undefined;

  let closed = false;
  let socket: net.Socket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let buffer = Buffer.alloc(0);

  const connect = () => {
    if (closed) return;
    socket = createRedisSocket(config);
    const commands = [
      ...authCommands(config),
      ...(config.database != null ? [["SELECT", String(config.database)]] : []),
      ["SUBSCRIBE", channel]
    ];
    socket.once("connect", () => socket?.write(commands.map(encodeCommand).join("")));
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        const parsed = parseResp(buffer);
        if (!parsed) return;
        buffer = buffer.subarray(parsed.nextOffset);
        const value = parsed.value;
        if (Array.isArray(value) && String(value[0]) === "message" && value[2] != null) onMessage(String(value[2]));
      }
    });
    socket.once("error", scheduleReconnect);
    socket.once("close", scheduleReconnect);
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  };

  connect();
  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.destroy();
  };
}

function parseRedisUrl(): RedisConfig | null {
  if (!env.REDIS_URL?.trim()) return null;
  try {
    const parsed = new URL(env.REDIS_URL);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : null,
      password: parsed.password ? decodeURIComponent(parsed.password) : null,
      database: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : null,
      secure: parsed.protocol === "rediss:"
    };
  } catch {
    return null;
  }
}

function createRedisSocket(config: RedisConfig): net.Socket {
  if (config.secure) return tls.connect({ host: config.host, port: config.port, servername: config.host });
  return net.createConnection({ host: config.host, port: config.port });
}

function authCommands(config: RedisConfig): string[][] {
  if (!config.password) return [];
  return config.username ? [["AUTH", config.username, config.password]] : [["AUTH", config.password]];
}

function encodeCommand(args: string[]) {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

function parseResp(buffer: Buffer, offset = 0): { value: RedisValue; nextOffset: number } | null {
  if (offset >= buffer.length) return null;
  const type = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf("\r\n", offset);
  if (lineEnd === -1) return null;
  const line = buffer.toString("utf8", offset + 1, lineEnd);
  const next = lineEnd + 2;
  if (type === "+" || type === "-") return { value: line, nextOffset: next };
  if (type === ":") return { value: Number(line), nextOffset: next };
  if (type === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, nextOffset: next };
    const end = next + length;
    if (buffer.length < end + 2) return null;
    return { value: buffer.toString("utf8", next, end), nextOffset: end + 2 };
  }
  if (type === "*") {
    const length = Number(line);
    if (length === -1) return { value: null, nextOffset: next };
    const values: RedisValue[] = [];
    let cursor = next;
    for (let index = 0; index < length; index += 1) {
      const parsed = parseResp(buffer, cursor);
      if (!parsed) return null;
      values.push(parsed.value);
      cursor = parsed.nextOffset;
    }
    return { value: values, nextOffset: cursor };
  }
  return null;
}
