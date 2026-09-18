import "./styles.css"
import { parseWorkbook, type CalculationResult } from "./grades"
import { buildResultViewModel, isSupportedWorkbook } from "./view-model"

const app = document.querySelector<HTMLDivElement>("#app")
if (!app) throw new Error("页面挂载点不存在")

app.innerHTML = `
  <main class="page-shell">
    <input
      class="file-input"
      id="transcript"
      name="transcript"
      type="file"
      accept=".xls,.xlsx"
      aria-describedby="upload-hint"
    />

    <section class="upload-view" id="upload-view">
      <h1 class="visually-hidden">重庆大学各学期加权平均分</h1>
      <label class="upload-box" for="transcript" id="drop-zone">
        <span class="upload-title" id="upload-action">把成绩表拖进来</span>
        <span class="upload-hint" id="upload-hint">或点击选择 .xls / .xlsx 文件</span>
      </label>

      <div class="error-message" id="error-message" role="alert" hidden>
        <span aria-hidden="true">!</span>
        <p id="error-text"></p>
      </div>
    </section>

    <section class="result-view" id="result-area" aria-labelledby="result-title" hidden>
      <header class="result-header">
        <div>
          <p class="result-file" id="result-file"></p>
          <h1 id="result-title" tabindex="-1">各学期加权平均分</h1>
        </div>
        <label class="replace-file" for="transcript">重新选择</label>
      </header>

      <ul class="term-list" id="term-list"></ul>
      <p class="warning-message" id="warning-message" role="status" hidden></p>

      <section class="method" aria-labelledby="method-title">
        <h2 id="method-title">计算方式</h2>
        <math
          class="formula"
          display="block"
          aria-label="每学期加权平均分等于各课程成绩乘学分之和除以各课程学分之和"
        >
          <mrow>
            <msub>
              <mover><mi>x</mi><mo>¯</mo></mover>
              <mtext>学期</mtext>
            </msub>
            <mo>=</mo>
            <mfrac>
              <mrow>
                <munderover>
                  <mo>∑</mo>
                  <mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>
                  <mi>n</mi>
                </munderover>
                <msub><mi>s</mi><mi>i</mi></msub>
                <msub><mi>c</mi><mi>i</mi></msub>
              </mrow>
              <mrow>
                <munderover>
                  <mo>∑</mo>
                  <mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>
                  <mi>n</mi>
                </munderover>
                <msub><mi>c</mi><mi>i</mi></msub>
              </mrow>
            </mfrac>
          </mrow>
        </math>
        <p class="method-note">
          <var>s<sub>i</sub></var> 为百分制成绩，<var>c<sub>i</sub></var> 为学分。0 学分课程不计入，等级制成绩先换算为百分制。
          <a href="https://jwc.cqu.edu.cn/info/1075/1011.htm" target="_blank" rel="noreferrer">查看换算规则</a>
        </p>
      </section>
    </section>

    <p class="visually-hidden" id="status" aria-live="polite"></p>
  </main>
`

function getElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`缺少页面元素：${selector}`)
  return element
}

const fileInput = getElement<HTMLInputElement>("#transcript")
const uploadView = getElement<HTMLElement>("#upload-view")
const dropZone = getElement<HTMLLabelElement>("#drop-zone")
const uploadAction = getElement<HTMLSpanElement>("#upload-action")
const status = getElement<HTMLParagraphElement>("#status")
const errorMessage = getElement<HTMLDivElement>("#error-message")
const errorText = getElement<HTMLParagraphElement>("#error-text")
const resultArea = getElement<HTMLElement>("#result-area")
const resultTitle = getElement<HTMLHeadingElement>("#result-title")
const resultFile = getElement<HTMLParagraphElement>("#result-file")
const termList = getElement<HTMLUListElement>("#term-list")
const warningMessage = getElement<HTMLParagraphElement>("#warning-message")

function resetFeedback(): void {
  errorMessage.hidden = true
  errorText.textContent = ""
  dropZone.classList.remove("has-error")
  warningMessage.hidden = true
  warningMessage.textContent = ""
}

function showError(message: string): void {
  resultArea.hidden = true
  uploadView.hidden = false
  uploadAction.textContent = "把成绩表拖进来"
  errorText.textContent = message
  errorMessage.hidden = false
  dropZone.classList.add("has-error")
  status.textContent = `读取失败：${message}`
}

function renderResult(result: CalculationResult, uploadedFileName: string): void {
  const view = buildResultViewModel(result)
  resultFile.textContent = uploadedFileName
  termList.replaceChildren(
    ...view.terms.map((term) => {
      const row = document.createElement("li")
      row.className = "term-row"

      const name = document.createElement("span")
      name.className = "term-name"
      name.textContent = term.label

      const score = document.createElement("output")
      score.className = "term-score"
      score.textContent = term.average

      row.append(name, score)
      return row
    }),
  )

  if (result.warnings.length > 0) {
    warningMessage.textContent = result.warnings.join("；")
    warningMessage.hidden = false
  }

  uploadView.hidden = true
  resultArea.hidden = false
  uploadAction.textContent = "把成绩表拖进来"
  resultTitle.focus()
}

async function handleFile(file: File): Promise<void> {
  resetFeedback()
  resultArea.hidden = true
  uploadView.hidden = false

  if (!isSupportedWorkbook(file.name)) {
    showError("只支持 .xls 或 .xlsx 文件。")
    return
  }

  uploadAction.textContent = "正在解析…"
  try {
    const result = parseWorkbook(await file.arrayBuffer())
    renderResult(result, file.name)
    status.textContent = `已计算 ${file.name} 的各学期加权平均分`
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
