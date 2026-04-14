export default function ProBadge({ size = "sm" }: { size?: "xs" | "sm" | "md" }) {
  const styles = {
    xs: "text-[8px] px-1.5 py-0.5",
    sm: "text-[9px] px-2 py-0.5",
    md: "text-[11px] px-2.5 py-1",
  };
  return (
    <span
      className={`inline-flex items-center font-black uppercase tracking-wider rounded-full bg-orange-500 text-white ${styles[size]}`}
    >
      Pro
    </span>
  );
}
