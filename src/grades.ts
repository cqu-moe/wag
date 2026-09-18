import * as XLSX from "xlsx"

export type ParsedGrade = {
  score: number
  converted: boolean
}

export type RawCourseInput = {
  term: string
  name: string
  credits: unknown
  grade: unknown
}

export type CourseRecord = {
  term: string
  name: string
  credits: number | null
  rawGrade: string
  score: number | null
  included: boolean
  reason: string | null
}

export type TermSummary = {
  term: string
  credits: number
  courseCount: number
  average: number
}

export type CalculationResult = {
  courses: CourseRecord[]
  terms: TermSummary[]
  overall: TermSummary
  warnings: string[]
}

const gradeScale = new Map<string, number>([
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
])

export function parseGrade(value: unknown): ParsedGrade | null {
  const raw = String(value ?? "").trim()
  const converted = gradeScale.get(raw)

  if (converted !== undefined) {
    return { score: converted, converted: true }
  }

  if (raw === "") return null

  const score = Number(raw)
  if (!Number.isFinite(score) || score < 0 || score > 100) return null

  return { score, converted: false }
}

export function calculateRows(rows: RawCourseInput[]): CalculationResult {
  let unknownGradeCount = 0
  const courses = rows.map((row): CourseRecord => {
    const term = row.term.trim()
    const name = row.name.trim()
    const rawGrade = String(row.grade ?? "").trim()
    const rawCredits = String(row.credits ?? "").trim()
    const credits = rawCredits === "" ? null : Number(rawCredits)
    const parsedGrade = parseGrade(row.grade)

    let reason: string | null = null
    if (!term) reason = "缺少学期"
    else if (credits === null || !Number.isFinite(credits) || credits < 0) {
      reason = "学分无效"
    } else if (credits === 0) reason = "0 学分"
    else if (!parsedGrade) {
      reason = `无法识别成绩“${rawGrade || "空白"}”`
      unknownGradeCount += 1
    }

    return {
      term,
      name,
      credits:
        credits !== null && Number.isFinite(credits) && credits >= 0
          ? credits
          : null,
      rawGrade,
      score: parsedGrade?.score ?? null,
      included: reason === null,
      reason,
    }
  })

  const accumulators = new Map<
    string,
    { credits: number; courseCount: number; weightedScore: number }
  >()

  for (const course of courses) {
    if (!course.included || course.credits === null || course.score === null) {
      continue
    }

    const current = accumulators.get(course.term) ?? {
      credits: 0,
      courseCount: 0,
      weightedScore: 0,
    }
    current.credits += course.credits
    current.courseCount += 1
    current.weightedScore += course.credits * course.score
    accumulators.set(course.term, current)
  }

  const terms = [...accumulators].map(
    ([term, value]): TermSummary => ({
      term,
      credits: value.credits,
      courseCount: value.courseCount,
      average: value.weightedScore / value.credits,
    }),
  )

  if (terms.length === 0) throw new Error("没有可计算的课程")

  const overallCredits = terms.reduce((sum, term) => sum + term.credits, 0)
  const overallCourseCount = terms.reduce(
    (sum, term) => sum + term.courseCount,
    0,
  )
  const overallWeightedScore = terms.reduce(
    (sum, term) => sum + term.average * term.credits,
    0,
  )

  return {
    courses,
    terms,
    overall: {
      term: "全部学期",
      credits: overallCredits,
      courseCount: overallCourseCount,
      average: overallWeightedScore / overallCredits,
    },
    warnings:
      unknownGradeCount > 0
        ? [`${unknownGradeCount} 门课程因成绩无法识别而未计入`]
        : [],
  }
}

type HeaderIndexes = {
  term: number
  name: number
  credits: number
  grade: number
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
}

function findHeader(row: unknown[]): HeaderIndexes | null {
  const headers = row.map(normalizeHeader)
  const term = headers.indexOf("学期")
  const name = headers.indexOf("课程名称")
  const credits = headers.indexOf("学分")
  const grade = Math.max(headers.indexOf("有效成绩"), headers.indexOf("成绩"))

  if ([term, name, credits, grade].some((index) => index < 0)) return null
  return { term, name, credits, grade }
}

export function parseWorkbook(
  data: ArrayBuffer | Uint8Array,
): CalculationResult {
  const workbook = XLSX.read(data, { type: "array" })

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    })
    const headerRowIndex = rows.findIndex((row) => findHeader(row) !== null)
    if (headerRowIndex < 0) continue

    const header = findHeader(rows[headerRowIndex])
    if (!header) continue

    let currentTerm = ""
    const courses: RawCourseInput[] = []
    for (const row of rows.slice(headerRowIndex + 1)) {
      const nextTerm = String(row[header.term] ?? "").trim()
      if (nextTerm) currentTerm = nextTerm

      const name = String(row[header.name] ?? "").trim()
      if (!name) continue

      courses.push({
        term: currentTerm,
        name,
        credits: row[header.credits],
        grade: row[header.grade],
      })
    }

    return calculateRows(courses)
  }

  throw new Error("没有找到包含“学期、课程名称、学分、有效成绩”的表头")
}
