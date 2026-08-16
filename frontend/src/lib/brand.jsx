export const LOGO_URL = "/blinkedin-logo.png";
export const BRAND = "BlinkedIn";

// Small compact logo mark used inside chips / small nav
export function LogoMark({ size = 32, className = "" }) {
  return (
    <img
      src={LOGO_URL}
      alt="BlinkedIn"
      width={size}
      height={size}
      className={`rounded-lg object-cover ${className}`}
      style={{ display: "block" }}
    />
  );
}
