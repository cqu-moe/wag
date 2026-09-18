import type { CalculationResult } from "./grades"

export type SummaryView = {
  label: string
  average: string
  detail: string
}

export type ResultViewModel = {
  overall: SummaryView
  terms: SummaryView[]
  excludedCount: number
}

const creditsFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
})

export function isSupportedWorkbook(name: string): boolean {
  return /\.xlsx?$/i.test(name)
}

export function buildResultViewModel(
  result: CalculationResult,
): ResultViewModel {
  const formatSummary = (summary: CalculationResult["overall"]): SummaryView => ({
    label: summary.term,
    average: summary.average.toFixed(1),
    detail: `${creditsFormatter.format(summary.credits)} 学分 · ${summary.courseCount} 门课程`,
  })

  return {
    overall: formatSummary(result.overall),
    terms: result.terms.map(formatSummary),
    excludedCount: result.courses.filter((course) => !course.included).length,
  }
}
