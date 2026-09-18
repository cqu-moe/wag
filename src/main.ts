import "./styles.css"
import { parseGrade, parseWorkbook, type CalculationResult } from "./grades"
import {
  buildResultViewModel,
  isSupportedWorkbook,
} from "./view-model"

const app = document.querySelector<HTMLDivElement>("#app")
if (!app) throw new Error("页面挂载点不存在")

app.innerHTML = `
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <div class="page-shell">
    <header class="masthead">
      <p class="kicker">重庆大学 · 成绩工具</p>
      <h1>分学期加权平均分</h1>
      <p class="lead">上传教务系统导出的“主修成绩”Excel，按学分分别计算每个学期。</p>
    </header>

    <main id="main-content">
      <section class="section-grid upload-section" aria-labelledby="upload-title">
        <p class="section-number" aria-hidden="true">01</p>
        <div class="section-content">
          <div class="section-heading">
            <h2 id="upload-title">选择成绩单</h2>
            <p>支持 .xls 和 .xlsx。不会上传、存储或发送成绩数据。</p>
          </div>

          <input
            class="file-input"
            id="transcript"
            name="transcript"
            type="file"
            accept=".xls,.xlsx"
            aria-describedby="file-help file-name"
          />
          <label class="upload-field" for="transcript" id="drop-zone">
            <span class="upload-action" id="upload-action">选择成绩单</span>
            <span class="upload-hint" id="file-help">也可将 Excel 文件拖到这里</span>
            <span class="file-name" id="file-name">尚未选择文件</span>
          </label>

          <div class="message message-error" id="error-message" role="alert" hidden>
            <span class="message-mark" aria-hidden="true">!</span>
            <p id="error-text"></p>
          </div>
          <p class="visually-hidden" id="status" aria-live="polite"></p>
        </div>
      </section>

      <div id="result-area" hidden>
        <section class="section-grid result-section" aria-labelledby="result-title">
          <p class="section-number" aria-hidden="true">02</p>
          <div class="section-content">
            <div class="section-heading result-heading">
              <div>
                <h2 id="result-title" tabindex="-1">计算结果</h2>
                <p>分数显示一位小数，计算过程使用原始精度。</p>
              </div>
              <p class="result-file" id="result-file"></p>
            </div>

            <div class="result-ledger">
              <div class="overall-result">
                <p class="result-label" id="overall-label">全部学期</p>
                <output class="overall-score" id="overall-score">—</output>
                <p class="result-detail" id="overall-detail"></p>
              </div>
              <div class="term-list" id="term-list" aria-label="各学期加权平均分"></div>
            </div>

            <div class="message message-note" id="warning-message" hidden>
              <span class="message-mark" aria-hidden="true">i</span>
              <p id="warning-text"></p>
            </div>
          </div>
        </section>

        <section class="section-grid audit-section" aria-labelledby="audit-title">
          <p class="section-number" aria-hidden="true">03</p>
          <div class="section-content">
            <div class="section-heading">
              <h2 id="audit-title">课程核对</h2>
              <p>逐门列出原成绩、换算分和是否计入，便于发现零学分或未识别成绩。</p>
            </div>
            <div class="table-wrap" tabindex="0" aria-label="课程核对表，可横向滚动">
              <table>
                <thead>
                  <tr>
                    <th scope="col">学期</th>
                    <th scope="col">课程</th>
                    <th scope="col" class="numeric">学分</th>
                    <th scope="col" class="numeric">原成绩</th>
                    <th scope="col" class="numeric">换算分</th>
                    <th scope="col">状态</th>
                  </tr>
                </thead>
                <tbody id="course-body"></tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section class="section-grid method-section" aria-labelledby="method-title">
        <p class="section-number" aria-hidden="true">04</p>
        <div class="section-content">
          <details>
            <summary id="method-title">计算口径</summary>
            <div class="method-copy">
              <p><strong>加权平均分</strong> = Σ（课程百分制成绩 × 学分）÷ Σ学分。0 学分课程不计入。</p>
              <p>五级制：优 95、良 85、中 75、及格 65、不及格 50；两级制：合格 85、不合格 50。缺考、违纪、作弊按 0 分。</p>
              <p class="source-line">依据：<a href="https://jwc.cqu.edu.cn/info/1075/1011.htm" target="_blank" rel="noreferrer">重庆大学课程成绩评定补充办法（试行）</a></p>
            </div>
          </details>
        </div>
      </section>
    </main>
  </div>
`

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`缺少页面元素：${selector}`)
  return element
}

const fileInput = getElement<HTMLInputElement>("#transcript")
const dropZone = getElement<HTMLLabelElement>("#drop-zone")
const uploadAction = getElement<HTMLSpanElement>("#upload-action")
const fileName = getElement<HTMLSpanElement>("#file-name")
const status = getElement<HTMLParagraphElement>("#status")
const errorMessage = getElement<HTMLDivElement>("#error-message")
const errorText = getElement<HTMLParagraphElement>("#error-text")
const resultArea = getElement<HTMLDivElement>("#result-area")
const resultTitle = getElement<HTMLHeadingElement>("#result-title")
const resultFile = getElement<HTMLParagraphElement>("#result-file")
const overallLabel = getElement<HTMLParagraphElement>("#overall-label")
const overallScore = getElement<HTMLOutputElement>("#overall-score")
const overallDetail = getElement<HTMLParagraphElement>("#overall-detail")
const termList = getElement<HTMLDivElement>("#term-list")
const warningMessage = getElement<HTMLDivElement>("#warning-message")
const warningText = getElement<HTMLParagraphElement>("#warning-text")
const courseBody = getElement<HTMLTableSectionElement>("#course-body")

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
})

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

function resetFeedback(): void {
  errorMessage.hidden = true
  errorText.textContent = ""
  dropZone.classList.remove("has-error")
  warningMessage.hidden = true
  warningText.textContent = ""
}

function showError(message: string): void {
  resultArea.hidden = true
  errorText.textContent = message
  errorMessage.hidden = false
  dropZone.classList.add("has-error")
  status.textContent = `读取失败：${message}`
}

function appendCell(
  row: HTMLTableRowElement,
  text: string,
  className = "",
): void {
  const cell = document.createElement("td")
  cell.className = className
  cell.textContent = text
  row.append(cell)
}

function renderResult(result: CalculationResult, uploadedFileName: string): void {
  const view = buildResultViewModel(result)
  overallLabel.textContent = view.overall.label
  overallScore.textContent = view.overall.average
  overallDetail.textContent = view.overall.detail
  resultFile.textContent = uploadedFileName

  termList.replaceChildren(
    ...view.terms.map((term) => {
      const row = document.createElement("div")
      row.className = "term-row"
      row.append(
        textElement("p", "term-name", term.label),
        textElement("p", "term-detail", term.detail),
        textElement("output", "term-score", term.average),
      )
      return row
    }),
  )

  courseBody.replaceChildren(
    ...result.courses.map((course) => {
      const row = document.createElement("tr")
      if (!course.included) row.className = "is-excluded"
      const converted = parseGrade(course.rawGrade)?.converted ?? false
      const state = course.included
        ? converted
          ? "等级制换算并计入"
          : "计入"
        : (course.reason ?? "未计入")

      appendCell(row, course.term || "—")
      appendCell(row, course.name, "course-name")
      appendCell(
        row,
        course.credits === null ? "—" : numberFormatter.format(course.credits),
        "numeric",
      )
      appendCell(row, course.rawGrade || "—", "numeric")
      appendCell(
        row,
        course.score === null ? "—" : numberFormatter.format(course.score),
        "numeric",
      )
      appendCell(row, state, course.included ? "course-state" : "course-state excluded")
      return row
    }),
  )

  if (view.excludedCount > 0) {
    warningText.textContent = `${view.excludedCount} 门课程未计入，具体原因已列在课程核对表中。`
    warningMessage.hidden = false
  }

  resultArea.hidden = false
  uploadAction.textContent = "选择另一份成绩单"
  resultTitle.focus()
}

async function handleFile(file: File): Promise<void> {
  resetFeedback()
  resultArea.hidden = true
  fileName.textContent = file.name

  if (!isSupportedWorkbook(file.name)) {
    showError("文件格式不支持。请选择扩展名为 .xls 或 .xlsx 的成绩单。")
    return
  }

  status.textContent = `正在读取 ${file.name}`
  try {
    const result = parseWorkbook(await file.arrayBuffer())
    renderResult(result, file.name)
    status.textContent = `已完成 ${file.name} 的分学期计算`
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取这个文件"
    showError(message)
  } finally {
    fileInput.value = ""
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0]
  if (file) void handleFile(file)
})

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.add("is-dragging")
  })
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.remove("is-dragging")
  })
}

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0]
  if (file) void handleFile(file)
})
