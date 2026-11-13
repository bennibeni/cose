export function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, '').replace(/^(?:\+|00)/, '');
}

export function assertUniquePhone(items, phone, currentId) {
  const normalized = normalizePhone(phone);
  if (normalized && items.some(item => item.id !== currentId && normalizePhone(item.phone) === normalized)) {
    throw new Error('Questo numero di telefono è già presente in un’altra card.');
  }
}
