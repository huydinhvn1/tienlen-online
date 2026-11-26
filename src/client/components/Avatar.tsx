export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const hue = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  return (
    <div
      className="grid place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: `hsl(${hue} 42% 32%)`, fontSize: Math.max(12, size * 0.38) }}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </div>
  );
}
