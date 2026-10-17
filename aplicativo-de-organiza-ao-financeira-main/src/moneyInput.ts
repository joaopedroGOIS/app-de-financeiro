/** Accept Brazilian notation and decimal-point pastes, returning canonical decimals. */
export function normalizeMoneyInput(raw: string, allowDecimalPoint = true): string | null {
  const text = raw.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (!text || text === '-') return text
  if (!/^-?[\d.,]+$/.test(text)) return null
  if (text.includes(',')) {
    if ((text.match(/,/g) ?? []).length !== 1) return null
    const [whole, fraction] = text.split(',')
    if (!/^\d{0,2}$/.test(fraction)) return null
    return (whole.replace(/\./g, '') || '0') + '.' + fraction
  }
  if (!allowDecimalPoint) return text.replace(/\./g, '')
  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) return text.replace(/\./g, '')
  if (text.includes('.')) {
    const position = text.lastIndexOf('.')
    const fraction = text.slice(position + 1)
    if (fraction.length > 2) return null
    return (text.slice(0, position).replace(/\./g, '') || '0') + '.' + fraction
  }
  return text
}

export function displayMoneyInput(value: string, pad = false): string {
  if (!value || value === '-') return value
  const [whole, fraction] = value.split('.')
  const negative = whole.startsWith('-')
  const digits = whole.replace('-', '').replace(/^0+(?=\d)/, '') || '0'
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (negative ? '-' : '') + grouped + (fraction !== undefined || pad ? ',' + (pad ? (fraction ?? '').padEnd(2, '0') : fraction) : '')
}