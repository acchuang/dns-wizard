export function normalizeIp(ip: string): string {
  if (ip.includes(":")) {
    try {
      const parsed = new URL(`http://[${ip}]`);
      return parsed.hostname;
    } catch {
      return ip.toLowerCase();
    }
  }
  return ip.trim();
}

export function normalizedIncludes(list: string[], ip: string): boolean {
  const normalized = normalizeIp(ip);
  return list.some((item) => normalizeIp(item) === normalized);
}