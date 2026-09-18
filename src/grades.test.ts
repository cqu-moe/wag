import { describe, expect, test } from "vitest"
import * as XLSX from "xlsx"
import {
  calculateRows,
  parseGrade,
  parseWorkbook,
  type RawCourseInput,
} from "./grades"

describe("parseGrade", () => {
  test.each([
    ["优", 95],
    ["优秀", 95],
    ["良", 85],
    ["良好", 85],
    ["中", 75],
    ["中等", 75],
    ["及格", 65],
    ["不及格", 50],
    ["合格", 85],
    ["不合格", 50],
    ["缺考", 0],
    ["违纪", 0],
    ["作弊", 0],
  ])("converts %s to %d", (raw, score) => {
    expect(parseGrade(raw)).toEqual({ score, converted: true })
  })

  test("keeps a percentage score unchanged", () => {
    expect(parseGrade(" 92 ")).toEqual({ score: 92, converted: false })
  })

  test.each(["", "493", -1, 101, "待录入"])(
    "rejects an invalid percentage score: %s",
    (raw) => {
      expect(parseGrade(raw)).toBeNull()
    },
  )
})

describe("calculateRows", () => {
  test("calculates each sample term and the full transcript", () => {
    const rows: RawCourseInput[] = [
      { term: "2026春", name: "课程 01", credits: 3, grade: 84 },
      { term: "2026春", name: "课程 02", credits: 0.5, grade: "合格" },
      { term: "2026春", name: "课程 03", credits: 2, grade: "合格" },
      { term: "2026春", name: "课程 04", credits: 0.5, grade: "合格" },
      { term: "2026春", name: "课程 05", credits: 0.5, grade: "合格" },
      { term: "2026春", name: "课程 06", credits: 0.5, grade: "合格" },
      { term: "2026春", name: "课程 07", credits: 4, grade: 90 },
      { term: "2026春", name: "课程 08", credits: 1, grade: 92 },
      { term: "2026春", name: "零学分课程 A", credits: 0, grade: 93 },
      { term: "2026春", name: "课程 09", credits: 4, grade: 93 },
      { term: "2026春", name: "课程 10", credits: 1, grade: 93 },
      { term: "2026春", name: "课程 11", credits: 3, grade: 95 },
      { term: "2026春", name: "课程 12", credits: 4, grade: 95 },
      { term: "2026春", name: "课程 13", credits: 1, grade: 95 },
      { term: "2026春", name: "课程 14", credits: 1, grade: "优" },
      { term: "2026春", name: "课程 15", credits: 4, grade: 95 },
      { term: "2026春", name: "课程 16", credits: 4, grade: 98 },
      { term: "2026春", name: "零学分课程 B", credits: 0, grade: 493 },
      { term: "2025秋", name: "课程 17", credits: 2, grade: 83 },
      { term: "2025秋", name: "课程 18", credits: 1, grade: 84 },
      { term: "2025秋", name: "零学分课程 C", credits: 0, grade: 88 },
      { term: "2025秋", name: "课程 19", credits: 2, grade: 89 },
      { term: "2025秋", name: "课程 20", credits: 3, grade: 91 },
      { term: "2025秋", name: "课程 21", credits: 4, grade: 92 },
      { term: "2025秋", name: "课程 22", credits: 3, grade: 93 },
      { term: "2025秋", name: "课程 23", credits: 3, grade: 94 },
      { term: "2025秋", name: "课程 24", credits: 1, grade: 94 },
      { term: "2025秋", name: "课程 25", credits: 3, grade: 95 },
      { term: "2025秋", name: "课程 26", credits: 1, grade: "优" },
      { term: "2025秋", name: "课程 27", credits: 1, grade: 98 },
      { term: "2025秋", name: "课程 28", credits: 2, grade: 100 },
      { term: "2025秋", name: "零学分课程 D", credits: 0, grade: 565 },
    ]

    const result = calculateRows(rows)

    expect(result.terms).toEqual([
      {
        term: "2026春",
        credits: 34,
        courseCount: 16,
        average: 92.23529411764706,
      },
      {
        term: "2025秋",
        credits: 26,
        courseCount: 12,
        average: 92.38461538461539,
      },
    ])
    expect(result.overall).toEqual({
      term: "全部学期",
      credits: 60,
      courseCount: 28,
      average: 92.3,
    })
  })

  test("reports excluded courses without hiding a valid failing grade", () => {
    const result = calculateRows([
      { term: "2025秋", name: "正常课程", credits: 2, grade: 90 },
      { term: "2025秋", name: "不及格课程", credits: 1, grade: "不及格" },
      { term: "2025秋", name: "未知成绩课程", credits: 1, grade: "待录入" },
      { term: "2025秋", name: "零学分课程", credits: 0, grade: 565 },
    ])

    expect(result.overall).toMatchObject({ credits: 3, courseCount: 2 })
    expect(result.courses[1]).toMatchObject({ included: true, score: 50 })
    expect(result.courses[2]).toMatchObject({
      included: false,
      reason: "无法识别成绩“待录入”",
    })
    expect(result.courses[3]).toMatchObject({ included: false, reason: "0 学分" })
    expect(result.warnings).toEqual(["1 门课程因成绩无法识别而未计入"])
  })

  test("rejects input without a calculable course", () => {
    expect(() =>
      calculateRows([
        { term: "2025秋", name: "零学分课程", credits: 0, grade: 90 },
      ]),
    ).toThrow("没有可计算的课程")
  })
})

describe("parseWorkbook", () => {
  test.each(["xls", "xlsx"] as const)(
    "parses a %s transcript with inherited term cells",
    (bookType) => {
      const transcript = XLSX.utils.aoa_to_sheet([
        ["主修成绩"],
        ["学期", "课程名称", "课程代码", "学分", "有效成绩"],
        ["2026春", "大学化学", "CHEM20000", "4.0", "90"],
        [null, "大学化学实验Ⅰ", "CHEM12000", "1.0", "优"],
        [],
        ["加权平均分: 91.0"],
      ])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([["导出说明"]]),
        "说明",
      )
      XLSX.utils.book_append_sheet(workbook, transcript, "主修成绩")
      const bytes = XLSX.write(workbook, { type: "array", bookType })

      const result = parseWorkbook(bytes)

      expect(result.terms).toEqual([
        { term: "2026春", credits: 5, courseCount: 2, average: 91 },
      ])
      expect(result.courses.map((course) => course.term)).toEqual([
        "2026春",
        "2026春",
      ])
    },
  )

  test("explains which transcript headers are required", () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["学期", "课程名称", "有效成绩"],
        ["2026春", "大学化学", "90"],
      ]),
      "主修成绩",
    )
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" })

    expect(() => parseWorkbook(bytes)).toThrow(
      "没有找到包含“学期、课程名称、学分、有效成绩”的表头",
    )
  })
})
