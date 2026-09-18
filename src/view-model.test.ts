import { describe, expect, test } from "vitest"
import type { CalculationResult } from "./grades"
import {
  buildResultViewModel,
  isSupportedWorkbook,
} from "./view-model"

const result: CalculationResult = {
  courses: [
    {
      term: "2026春",
      name: "大学化学",
      credits: 4,
      rawGrade: "90",
      score: 90,
      included: true,
      reason: null,
    },
    {
      term: "2026春",
      name: "大学英语（国家六级）",
      credits: 0,
      rawGrade: "493",
      score: null,
      included: false,
      reason: "0 学分",
    },
  ],
  terms: [
    { term: "2026春", credits: 34, courseCount: 16, average: 92.23529411764706 },
    { term: "2025秋", credits: 26, courseCount: 12, average: 92.38461538461539 },
  ],
  overall: {
    term: "全部学期",
    credits: 60,
    courseCount: 28,
    average: 92.3,
  },
  warnings: [],
}

describe("isSupportedWorkbook", () => {
  test.each(["成绩.xls", "成绩.XLSX", "archive.final.xlsx"])(
    "accepts %s",
    (name) => expect(isSupportedWorkbook(name)).toBe(true),
  )

  test.each(["成绩.csv", "成绩.xlsx.pdf", "xlsx", ""])(
    "rejects %s",
    (name) => expect(isSupportedWorkbook(name)).toBe(false),
  )
})

describe("buildResultViewModel", () => {
  test("returns only the per-term summaries shown on the result screen", () => {
    const view = buildResultViewModel(result)

    expect(view).toEqual({
      terms: [
        { label: "2026春", average: "92.2" },
        { label: "2025秋", average: "92.4" },
      ],
    })
  })
})
