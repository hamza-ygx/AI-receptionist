export function normalizeE164(input: string, defaultCountry = "46"): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) {
    const d = digits.replace(/\D/g, "");
    if (!d) return null;
    digits = d.startsWith("0") ? `+${defaultCountry}${d.slice(1)}` : `+${defaultCountry}${d}`;
  }
  digits = `+${digits.slice(1).replace(/\D/g, "")}`;
  if (digits.startsWith(`+${defaultCountry}0`)) digits = `+${defaultCountry}${digits.slice(defaultCountry.length + 2)}`;
  return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : null;
}

export function sameNumber(a: string, b: string): boolean {
  const na = normalizeE164(a);
  const nb = normalizeE164(b);
  return na !== null && na === nb;
}

export function spokenSwedish(e164: string): string {
  if (e164.startsWith("+46")) {
    const local = `0${e164.slice(3)}`;
    return local.replace(/^(0\d{2})(\d{3})(\d{2})(\d{2})$/, "$1-$2 $3 $4");
  }
  return e164;
}
