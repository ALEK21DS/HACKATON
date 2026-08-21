export type BroadcastFailureCategory =
  | 'SPAM_BLOCKED'
  | 'NO_WHATSAPP'
  | 'META_EXPERIMENT'
  | 'OUT_OF_WINDOW'
  | 'SANDBOX_BLOCKED'
  | 'OTHER';

interface FailureClassification {
  category: BroadcastFailureCategory;
  label: string;
}

const CODE_CATEGORY_MAP: Record<number, FailureClassification> = {
  131048: { category: 'SPAM_BLOCKED', label: 'Rechazados por límite de spam' },
  131049: { category: 'SPAM_BLOCKED', label: 'Rechazados para evitar spam' },
  131026: { category: 'NO_WHATSAPP', label: 'Números sin WhatsApp' },
  130472: { category: 'META_EXPERIMENT', label: 'Bloqueados por experimento de Meta' },
};

/** Clasifica un fallo de envío de WhatsApp por código de Meta (async, vía webhook) o por texto (reglas propias, síncronas). */
export function classifyWhatsAppFailure(input: { code?: number; message?: string }): FailureClassification {
  if (input.code && CODE_CATEGORY_MAP[input.code]) {
    return CODE_CATEGORY_MAP[input.code];
  }

  const msg = (input.message || '').toLowerCase();
  if (msg.includes('ventana de 24')) {
    return { category: 'OUT_OF_WINDOW', label: 'Fuera de ventana de 24h' };
  }
  if (msg.includes('sandbox')) {
    return { category: 'SANDBOX_BLOCKED', label: 'No autorizado en sandbox de Meta' };
  }
  if (msg.includes('límite de spam') || msg.includes('limite de spam')) {
    return { category: 'SPAM_BLOCKED', label: 'Rechazados para evitar spam' };
  }

  return { category: 'OTHER', label: 'Otro motivo' };
}
