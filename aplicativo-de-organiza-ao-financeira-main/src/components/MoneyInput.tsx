import { useEffect, useLayoutEffect, useRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { displayMoneyInput, normalizeMoneyInput } from '../moneyInput'

const useInputLayoutEffect = typeof document !== 'undefined' && typeof document.createElement === 'function' ? useLayoutEffect : useEffect

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max' | 'step'> & {
  value: string
  onValueChange: (value: string) => void
  min?: string | number
  max?: string | number
}

/** Display is localized; callers continue receiving decimal-point values in reais. */
export function MoneyInput({ value, onValueChange, min, max, onBlur, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const cursor = useRef<number | null>(null)
  useInputLayoutEffect(() => {
    const element = input.current
    if (!element) return
    const amount = Number(value)
    element.setCustomValidity(value && (!Number.isFinite(amount) || value === '-')
      ? 'Informe um valor válido.'
      : value && min !== undefined && amount < Number(min)
        ? 'O valor mínimo é ' + displayMoneyInput(String(min), true) + '.'
        : value && max !== undefined && amount > Number(max)
          ? 'O valor máximo é ' + displayMoneyInput(String(max), true) + '.'
          : '')
    if (cursor.current !== null && document.activeElement === element) {
      const text = element.value
      let remaining = cursor.current
      let position = 0
      while (position < text.length && remaining > 0) {
        if (/[\d,-]/.test(text[position])) remaining--
        position++
      }
      element.setSelectionRange(position, position)
      cursor.current = null
    }
  }, [value, min, max])
  return <input {...props} ref={input} type="text" inputMode="decimal" placeholder={props.placeholder ?? '0,00'} value={displayMoneyInput(value)}
    onChange={event => {
      const element = event.currentTarget
      const next = normalizeMoneyInput(element.value, false)
      if (next === null) return
      const position = element.selectionStart ?? element.value.length
      const prefix = element.value.slice(0, position)
      const decimalPoint = false
      cursor.current = (prefix.match(/[\d,-]/g) ?? []).length
      onValueChange(next)
    }}
    onPaste={event => {
      const element = event.currentTarget
      const start = element.selectionStart ?? 0
      const end = element.selectionEnd ?? element.value.length
      const raw = element.value.slice(0, start) + event.clipboardData.getData('text') + element.value.slice(end)
      const next = normalizeMoneyInput(raw, start === 0 && end === element.value.length)
      event.preventDefault()
      if (next === null) return
      cursor.current = null
      onValueChange(next)
    }}
    onBlur={event => {
      if (value && value !== '-' && Number.isFinite(Number(value))) onValueChange(Number(value).toFixed(2))
      onBlur?.(event)
    }} />
}