import type { CalculationResult } from "./grades"

export type SummaryView = {
  label: string
  average: string
}

export type ResultViewModel = {
  terms: SummaryView[]
}

export function isSupportedWorkbook(name: string): boolean {
  return /\.xlsx?$/i.test(name)
}

export function buildResultViewModel(
  result: CalculationResult,
): ResultViewModel {
  const formatSummary = (summary: CalculationResult["overall"]): SummaryView => ({
    label: summary.term,
    average: summary.average.toFixed(1),
  })

  return {
    terms: result.terms.map(formatSummary),
  }
}
