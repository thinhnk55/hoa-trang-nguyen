const STORAGE_KEY = 'hocnhe.hoa-trang-nguyen.practice.v1'
const QUESTION_COUNT = 150
const HOME_PATH = '/'
const PRACTICE_PATH = '/on-tap/van-mieu-quoc-tu-giam'
const RESULT_PATH = `${PRACTICE_PATH}/ket-qua`

type Order = 'normal' | 'reverse'
type PracticeState = {
  queue: number[]
  currentIndex: number
  order: Order
  masteredIds: number[]
  lastIncorrectIds: number[]
  answers: Record<string, boolean>
  completedAt?: string
}

function questionPath(id: number) {
  return `${PRACTICE_PATH}/cau-${id}`
}

function readState(): PracticeState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const state = JSON.parse(value) as PracticeState
    if (!Array.isArray(state.queue) || !Number.isInteger(state.currentIndex)) return null
    return state
  } catch {
    return null
  }
}

function saveState(state: PracticeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function isActive(state: PracticeState | null) {
  return Boolean(state && !state.completedAt && state.currentIndex < state.queue.length)
}

function startPractice(order: Order = 'normal', queue?: number[]) {
  const ids = queue?.length ? queue : Array.from({ length: QUESTION_COUNT }, (_, index) => index + 1)
  const normalizedQueue = order === 'reverse' ? [...ids].reverse() : ids
  const existing = readState()
  const state: PracticeState = {
    queue: normalizedQueue,
    currentIndex: 0,
    order,
    masteredIds: existing?.masteredIds ?? [],
    lastIncorrectIds: [],
    answers: {},
  }
  saveState(state)
  window.location.assign(questionPath(state.queue[0]))
}

function startRemainingPractice() {
  const state = readState()
  const masteredIds = new Set(state?.masteredIds ?? [])
  const remainingIds = Array.from({ length: QUESTION_COUNT }, (_, index) => index + 1)
    .filter((id) => !masteredIds.has(id))
  if (remainingIds.length) startPractice('normal', remainingIds)
}

function playFeedback(isCorrect: boolean) {
  const source = document.body.dataset[isCorrect ? 'correctSound' : 'wrongSound']
  if (!source) return
  const audio = new Audio(source)
  audio.volume = 0.65
  void audio.play().catch(() => undefined)
}

function updateHome() {
  const state = readState()
  const progress = document.querySelector<HTMLElement>('[data-home-progress]')
  const continueButton = document.querySelector<HTMLButtonElement>('[data-action="continue"]')
  const skipMasteredButton = document.querySelector<HTMLButtonElement>('[data-action="skip-mastered"]')
  if (!progress || !continueButton || !skipMasteredButton) return
  continueButton.disabled = !isActive(state)
  skipMasteredButton.disabled = !state?.masteredIds.length || state.masteredIds.length === QUESTION_COUNT
  if (!state) return
  progress.hidden = false
  const mastered = state.masteredIds.length
  if (isActive(state)) {
    progress.innerHTML = `<strong>Đang ôn tập</strong><span>Đã xác nhận đúng ${mastered}/${QUESTION_COUNT} câu</span><a class="text-link" href="${questionPath(state.queue[state.currentIndex])}">Tiếp tục câu ${state.queue[state.currentIndex]}</a>`
  } else if (mastered === QUESTION_COUNT) {
    progress.innerHTML = '<strong>Thành tựu đã hoàn thành</strong><span>Em đã trả lời đúng đủ 150 câu hỏi.</span>'
  } else {
    progress.innerHTML = `<strong>Tiến độ đã lưu</strong><span>Đã xác nhận đúng ${mastered}/${QUESTION_COUNT} câu</span>`
  }
}

function updateIntro() {
  const state = readState()
  const continueButton = document.querySelector<HTMLButtonElement>('[data-continue]')
  const retryButton = document.querySelector<HTMLButtonElement>('[data-retry-wrong]')
  const progress = document.querySelector<HTMLElement>('[data-intro-progress]')
  if (continueButton && isActive(state)) continueButton.hidden = false
  if (retryButton && state && state.lastIncorrectIds.length) retryButton.hidden = false
  if (progress && state) {
    progress.textContent = isActive(state)
      ? `Đang làm đến câu ${state.queue[state.currentIndex]}. Đã xác nhận đúng ${state.masteredIds.length}/${QUESTION_COUNT} câu.`
      : state.masteredIds.length === QUESTION_COUNT
        ? 'Em đã hoàn thành thành tựu trả lời đúng đủ 150 câu.'
        : `Đã xác nhận đúng ${state.masteredIds.length}/${QUESTION_COUNT} câu.`
  }
}

function setQuestionMode() {
  const page = document.querySelector<HTMLElement>('[data-question-page]')
  if (!page) return
  const id = Number(page.dataset.questionId)
  const state = readState()
  const lock = page.querySelector<HTMLElement>('[data-preview-lock]')
  const answerArea = page.querySelector<HTMLElement>('[data-answer-area]')
  const progress = page.querySelector<HTMLElement>('[data-question-progress]')
  const navigation = page.querySelector<HTMLElement>('[data-question-navigation]')
  const previewMessage = page.querySelector<HTMLElement>('[data-preview-message]')
  const continueButton = page.querySelector<HTMLButtonElement>('[data-action="continue"]')
  const skipMasteredButton = page.querySelector<HTMLButtonElement>('[data-action="skip-mastered"]')
  continueButton?.toggleAttribute('disabled', !isActive(state))
  skipMasteredButton?.toggleAttribute('disabled', !state?.masteredIds.length || state.masteredIds.length === QUESTION_COUNT)

  if (!state || !isActive(state)) return
  const activeId = state.queue[state.currentIndex]
  if (activeId !== id) {
    navigation?.removeAttribute('hidden')
    lock?.setAttribute('hidden', '')
    previewMessage?.replaceChildren(`Em đang làm dở bài ôn tập ở câu ${activeId}. Chọn “Tiếp tục làm bài” để quay lại đúng tiến độ.`)
    lock?.removeAttribute('hidden')
    return
  }

  navigation?.setAttribute('hidden', '')
  lock?.setAttribute('hidden', '')
  answerArea?.removeAttribute('hidden')
  if (progress) progress.textContent = `Câu ${state.currentIndex + 1}/${state.queue.length}`

  const savedResult = state.answers[String(id)]
  if (savedResult !== undefined) showAnswerResult(page, savedResult)
}

function showAnswerResult(page: HTMLElement, isCorrect: boolean) {
  page.querySelectorAll<HTMLButtonElement>('[data-option]').forEach((option) => {
    option.disabled = true
    if (option.dataset.option === page.dataset.correctOption) option.classList.add('correct')
    if (!isCorrect && option.getAttribute('aria-checked') === 'true') option.classList.add('wrong')
  })
  const explanation = page.querySelector<HTMLElement>('[data-explanation]')
  const label = page.querySelector<HTMLElement>('[data-result-label]')
  label?.replaceChildren(isCorrect ? 'Chính xác!' : 'Chưa đúng rồi')
  label?.classList.toggle('is-correct', isCorrect)
  label?.classList.toggle('is-wrong', !isCorrect)
  explanation?.removeAttribute('hidden')
  page.querySelector<HTMLElement>('[data-question-actions]')?.removeAttribute('hidden')
}

function answerQuestion(button: HTMLButtonElement) {
  const page = button.closest<HTMLElement>('[data-question-page]')
  const state = readState()
  if (!page || !state || !isActive(state)) return
  const id = Number(page.dataset.questionId)
  if (state.queue[state.currentIndex] !== id || state.answers[String(id)] !== undefined) return

  page.querySelectorAll('[data-option]').forEach((option) => option.setAttribute('aria-checked', 'false'))
  button.setAttribute('aria-checked', 'true')
  const isCorrect = button.dataset.option === page.dataset.correctOption
  state.answers[String(id)] = isCorrect
  if (isCorrect && !state.masteredIds.includes(id)) state.masteredIds.push(id)
  if (!isCorrect && !state.lastIncorrectIds.includes(id)) state.lastIncorrectIds.push(id)
  saveState(state)
  playFeedback(isCorrect)
  showAnswerResult(page, isCorrect)
}

function nextQuestion() {
  const state = readState()
  if (!state || !isActive(state)) return
  state.currentIndex += 1
  if (state.currentIndex >= state.queue.length) {
    state.completedAt = new Date().toISOString()
    saveState(state)
    window.location.assign(RESULT_PATH)
    return
  }
  saveState(state)
  window.location.assign(questionPath(state.queue[state.currentIndex]))
}

function renderResults() {
  const page = document.querySelector<HTMLElement>('[data-result-page]')
  if (!page) return
  const state = readState()
  if (!state || !state.completedAt) {
    window.location.replace(HOME_PATH)
    return
  }
  const correct = Object.values(state.answers).filter(Boolean).length
  const incorrect = state.queue.length - correct
  const title = page.querySelector<HTMLElement>('[data-result-title]')
  const summary = page.querySelector<HTMLElement>('[data-result-summary]')
  const stats = page.querySelector<HTMLElement>('[data-result-stats]')
  if (state.masteredIds.length === QUESTION_COUNT) {
    title?.replaceChildren('Thành tựu đã hoàn thành!')
    summary?.replaceChildren('Em đã từng trả lời đúng đủ 150 câu hỏi. Rất tuyệt vời!')
  } else {
    summary?.replaceChildren('Em có thể làm lại toàn bộ hoặc ôn riêng các câu vừa trả lời chưa đúng.')
  }
  if (stats) stats.innerHTML = `<div><b>${correct}</b><span>Đúng lượt này</span></div><div><b>${incorrect}</b><span>Cần ôn lại</span></div><div><b>${state.masteredIds.length}/150</b><span>Đã xác nhận đúng</span></div>`
  const retryWrong = page.querySelector<HTMLButtonElement>('[data-retry-wrong]')
  if (retryWrong && !state.lastIncorrectIds.length) retryWrong.hidden = true
}

document.addEventListener('click', (event) => {
  const target = event.target as Element | null
  const start = target?.closest<HTMLElement>('[data-start]')
  if (start) {
    event.preventDefault()
    const order = document.querySelector<HTMLInputElement>('input[name="order"]:checked')?.value === 'reverse' ? 'reverse' : 'normal'
    startPractice(order)
    return
  }
  if (target?.closest('[data-continue]') || target?.closest('[data-resume]')) {
    const state = readState()
    if (state && isActive(state)) window.location.assign(questionPath(state.queue[state.currentIndex]))
    return
  }
  const option = target?.closest<HTMLButtonElement>('[data-option]')
  if (option) {
    answerQuestion(option)
    return
  }
  if (target?.closest('[data-next]')) {
    nextQuestion()
    return
  }
  if (target?.closest('[data-retry-all]')) {
    startPractice('normal')
    return
  }
  if (target?.closest('[data-retry-wrong]')) {
    const state = readState()
    if (state?.lastIncorrectIds.length) startPractice('normal', state.lastIncorrectIds)
  }
  const action = target?.closest<HTMLButtonElement>('[data-action]')
  if (action) {
    const actionName = action.dataset.action
    if (actionName === 'restart') {
      const order = document.querySelector<HTMLInputElement>('input[name="order"]:checked')?.value === 'reverse' ? 'reverse' : 'normal'
      startPractice(order)
    } else if (actionName === 'continue') {
      const state = readState()
      if (state && isActive(state)) window.location.assign(questionPath(state.queue[state.currentIndex]))
    } else if (actionName === 'skip-mastered') {
      startRemainingPractice()
    }
  }
})

updateHome()
updateIntro()
setQuestionMode()
renderResults()
