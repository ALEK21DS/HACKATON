/** Formato visual del teléfono: añade "+" al inicio si no lo tiene (solo para mostrar). */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  return phone.startsWith('+') ? phone : `+${phone}`;
}
