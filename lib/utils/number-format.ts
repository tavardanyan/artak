/**
 * Formats a number with thousand separators (e.g., 12,345.67)
 * @param value - The number to format
 * @returns Formatted string with commas
 */
export function formatNumberWithCommas(value: number | string): string {
  if (value === "" || value === null || value === undefined) return ""

  const numStr = value.toString()
  const parts = numStr.split(".")
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const decimalPart = parts[1] ? `.${parts[1]}` : ""

  return integerPart + decimalPart
}

/**
 * Removes thousand separators from a formatted string
 * @param value - The formatted string
 * @returns Number without commas
 */
export function parseFormattedNumber(value: string): number {
  if (!value) return 0
  const cleanValue = value.replace(/,/g, "")
  return parseFloat(cleanValue) || 0
}

/**
 * Handles input change for formatted number fields
 * @param value - The input value
 * @returns Formatted value for display
 */
export function handleNumberInput(value: string): string {
  // Remove all commas first
  const cleaned = value.replace(/,/g, "")

  // If empty or just a dash, return as is
  if (cleaned === "" || cleaned === "-") return cleaned

  // Validate it's a valid number format
  if (!/^-?\d*\.?\d*$/.test(cleaned)) {
    return value.substring(0, value.length - 1) // Remove last invalid character
  }

  // Split into integer and decimal parts
  const parts = cleaned.split(".")
  const integerPart = parts[0]
  const decimalPart = parts[1]

  // Format integer part with commas
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  // Reconstruct with decimal if exists
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`
  }

  // If the original input ended with a dot, preserve it
  if (cleaned.endsWith(".")) {
    return `${formattedInteger}.`
  }

  return formattedInteger
}
