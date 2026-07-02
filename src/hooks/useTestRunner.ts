import { useEffect, useRef, RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function useMountedRef(): RefObject<boolean> {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  return mountedRef;
}

interface RunGuardedOptions<T> {
  listeners?: { event: string; handler: (payload: any) => void }[];
  run: () => Promise<T>;
  resetCommands?: string[];
  onSuccess: (result: T) => void;
  onError: (message: string, wasReset: boolean) => void;
}

export async function runGuarded<T>(
  mountedRef: RefObject<boolean>,
  opts: RunGuardedOptions<T>
): Promise<void> {
  const unlistens: (() => void)[] = [];
  if (opts.listeners) {
    for (const { event, handler } of opts.listeners) {
      unlistens.push(
        await listen(event, (e) => {
          if (!mountedRef.current) return;
          handler(e.payload);
        })
      );
    }
  }

  try {
    const result = await opts.run();
    if (mountedRef.current) opts.onSuccess(result);
  } catch (e) {
    if (!mountedRef.current) return;
    const message = String(e);
    let wasReset = false;
    if (message.includes("already running") && opts.resetCommands?.length) {
      await Promise.all(opts.resetCommands.map((cmd) => invoke(cmd).catch(() => {})));
      wasReset = true;
    }
    opts.onError(message, wasReset);
  } finally {
    unlistens.forEach((u) => u());
  }
}
