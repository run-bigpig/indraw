import { useRef, useCallback, useEffect } from 'react';

/**
 * 使用 requestAnimationFrame 节流回调函数
 * 确保回调函数最多每帧执行一次（约 16ms）
 * 
 * @param callback 要节流的回调函数
 * @returns 节流后的回调函数
 */
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T
): T {
  const rafId = useRef<number | null>(null);
  const latestCallback = useRef(callback);
  const latestArgs = useRef<any[] | null>(null);

  // 保持最新的回调引用
  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const throttledCallback = useCallback((...args: any[]) => {
    // 保存最新的参数
    latestArgs.current = args;

    // 如果已经有待执行的帧，直接返回
    if (rafId.current !== null) {
      return;
    }

    // 使用 requestAnimationFrame 调度执行
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (latestArgs.current !== null) {
        latestCallback.current(...latestArgs.current);
        latestArgs.current = null;
      }
    });
  }, []) as T;

  return throttledCallback;
}

/**
 * 使用时间间隔节流回调函数
 * 
 * @param callback 要节流的回调函数
 * @param delay 节流延迟（毫秒）
 * @returns 节流后的回调函数
 */
export function useTimeThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 16
): T {
  const lastRun = useRef<number>(0);
  const timeoutId = useRef<number | null>(null);
  const latestCallback = useRef(callback);
  const latestArgs = useRef<any[] | null>(null);

  // 保持最新的回调引用
  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);

  const throttledCallback = useCallback((...args: any[]) => {
    const now = Date.now();
    latestArgs.current = args;

    // 如果距离上次执行已经超过延迟时间，立即执行
    if (now - lastRun.current >= delay) {
      lastRun.current = now;
      latestCallback.current(...args);
      return;
    }

    // 否则，调度在延迟后执行
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current);
    }

    timeoutId.current = window.setTimeout(() => {
      lastRun.current = Date.now();
      if (latestArgs.current !== null) {
        latestCallback.current(...latestArgs.current);
        latestArgs.current = null;
      }
      timeoutId.current = null;
    }, delay - (now - lastRun.current));
  }, [delay]) as T;

  return throttledCallback;
}

