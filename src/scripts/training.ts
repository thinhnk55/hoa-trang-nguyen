const STORAGE_KEY = 'hocnhe.hoa-trang-nguyen.practice.v1'
const SETTINGS_KEY = 'hocnhe.hoa-trang-nguyen.settings.v1'
const QUESTION_COUNT = 150
const TIME_LIMIT_SECONDS = 30 * 60
const MIN_TIME_LIMIT_MINUTES = 1
const MAX_TIME_LIMIT_MINUTES = 99
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
  startedAt: string
  expiresAt: string
  timeLimitSeconds: number
  completedAt?: string
  endedReason?: 'completed' | 'timeout'
}

type PracticeSettings = {
  timeLimitMinutes: number
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
    const now = Date.now()
    let changed = false
    if (!state.startedAt) {
      state.startedAt = new Date(now).toISOString()
      changed = true
    }
    if (!state.expiresAt) {
      state.timeLimitSeconds = TIME_LIMIT_SECONDS
      state.expiresAt = new Date(now + state.timeLimitSeconds * 1000).toISOString()
      changed = true
    }
    if (!state.timeLimitSeconds) {
      state.timeLimitSeconds = TIME_LIMIT_SECONDS
      changed = true
    }
    if (!state.completedAt && Date.parse(state.expiresAt) <= now) {
      state.completedAt = new Date(now).toISOString()
      state.endedReason = 'timeout'
      changed = true
    }
    if (changed) saveState(state)
    return state
  } catch {
    return null
  }
}

function saveState(state: PracticeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function readSettings(): PracticeSettings {
  try {
    const value = localStorage.getItem(SETTINGS_KEY)
    if (!value) return { timeLimitMinutes: 30 }
    const settings = JSON.parse(value) as Partial<PracticeSettings>
    const minutes = Number(settings.timeLimitMinutes)
    return minutes >= MIN_TIME_LIMIT_MINUTES && minutes <= MAX_TIME_LIMIT_MINUTES
      ? { timeLimitMinutes: minutes }
      : { timeLimitMinutes: 30 }
  } catch {
    return { timeLimitMinutes: 30 }
  }
}

function saveSettings(settings: PracticeSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function selectedTimeLimitSeconds() {
  return readSettings().timeLimitMinutes * 60
}

function isActive(state: PracticeState | null) {
  return Boolean(state && !state.completedAt && state.currentIndex < state.queue.length)
}

function startPractice(order: Order = 'normal', queue?: number[]) {
  const ids = queue?.length ? queue : Array.from({ length: QUESTION_COUNT }, (_, index) => index + 1)
  const normalizedQueue = order === 'reverse' ? [...ids].reverse() : ids
  const existing = readState()
  const timeLimitSeconds = selectedTimeLimitSeconds()
  const state: PracticeState = {
    queue: normalizedQueue,
    currentIndex: 0,
    order,
    masteredIds: existing?.masteredIds ?? [],
    lastIncorrectIds: [],
    answers: {},
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + timeLimitSeconds * 1000).toISOString(),
    timeLimitSeconds,
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

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function getSessionStats(state: PracticeState) {
  const values = Object.values(state.answers)
  return {
    correct: values.filter(Boolean).length,
    incorrect: values.filter((answer) => !answer).length,
    remaining: Math.max(0, Math.ceil((Date.parse(state.expiresAt) - Date.now()) / 1000)),
    position: `${Math.min(state.currentIndex + 1, state.queue.length)}/${state.queue.length}`,
  }
}

let sessionTimer: number | undefined

function updateSessionStats(state: PracticeState) {
  const stats = getSessionStats(state)
  document.querySelector<HTMLElement>('[data-session-timer]')?.replaceChildren(formatTime(stats.remaining))
  document.querySelector<HTMLElement>('[data-session-correct]')?.replaceChildren(String(stats.correct))
  document.querySelector<HTMLElement>('[data-session-incorrect]')?.replaceChildren(String(stats.incorrect))
  document.querySelector<HTMLElement>('[data-session-position]')?.replaceChildren(stats.position)
}

function showTimeoutMessage() {
  document.querySelector<HTMLElement>('[data-timeout-message]')?.removeAttribute('hidden')
  document.querySelector<HTMLElement>('[data-answer-area]')?.setAttribute('hidden', '')
  document.querySelector<HTMLElement>('[data-question-navigation]')?.setAttribute('hidden', '')
  window.setTimeout(() => window.location.assign(RESULT_PATH), 1200)
}

function startSessionTimer(state: PracticeState) {
  window.clearInterval(sessionTimer)
  updateSessionStats(state)
  if (!isActive(state)) {
    if (state.endedReason === 'timeout') showTimeoutMessage()
    return
  }
  sessionTimer = window.setInterval(() => {
    const current = readState()
    if (!current) return
    if (!isActive(current)) {
      window.clearInterval(sessionTimer)
      if (current.endedReason === 'timeout') showTimeoutMessage()
      return
    }
    updateSessionStats(current)
  }, 1000)
}

function updateHome() {
  const state = readState()
  const progress = document.querySelector<HTMLElement>('[data-home-progress]')
  const continueButton = document.querySelector<HTMLButtonElement>('[data-action="continue"]')
  const skipMasteredButton = document.querySelector<HTMLButtonElement>('[data-action="skip-mastered"]')
  const resetButton = document.querySelector<HTMLButtonElement>('[data-reset-button]')
  if (!progress || !continueButton || !skipMasteredButton) return
  if (resetButton) resetButton.hidden = !state
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
  const navigation = page.querySelector<HTMLElement>('[data-question-navigation]')
  const previewMessage = page.querySelector<HTMLElement>('[data-preview-message]')
  const continueButton = page.querySelector<HTMLButtonElement>('[data-action="continue"]')
  const skipMasteredButton = page.querySelector<HTMLButtonElement>('[data-action="skip-mastered"]')
  continueButton?.toggleAttribute('disabled', !isActive(state))
  skipMasteredButton?.toggleAttribute('disabled', !state?.masteredIds.length || state.masteredIds.length === QUESTION_COUNT)

  if (state) {
    document.querySelector<HTMLElement>('[data-session-stats]')?.removeAttribute('hidden')
    startSessionTimer(state)
  }
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
  const savedResult = state.answers[String(id)]
  if (savedResult !== undefined) showAnswerResult(page, savedResult)
}

function showAnswerResult(page: HTMLElement, isCorrect: boolean) {
  page.querySelectorAll<HTMLButtonElement>('[data-option]').forEach((option) => {
    option.disabled = true
    if (option.dataset.option === page.dataset.correctOption) option.classList.add('correct')
    if (!isCorrect && option.getAttribute('aria-checked') === 'true') option.classList.add('wrong')
  })
  const label = page.querySelector<HTMLElement>('[data-result-label]')
  label?.replaceChildren(isCorrect ? 'Chính xác!' : 'Chưa đúng rồi')
  label?.classList.toggle('is-correct', isCorrect)
  label?.classList.toggle('is-wrong', !isCorrect)
  page.querySelector<HTMLElement>('[data-explanation]')?.removeAttribute('hidden')
  const actions = page.querySelector<HTMLElement>('[data-question-actions]')
  actions?.removeAttribute('hidden')
  requestAnimationFrame(() => actions?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
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
  updateSessionStats(state)
  playFeedback(isCorrect)
  showAnswerResult(page, isCorrect)
}

function nextQuestion() {
  const state = readState()
  if (!state || !isActive(state)) return
  state.currentIndex += 1
  if (state.currentIndex >= state.queue.length) {
    state.completedAt = new Date().toISOString()
    state.endedReason = 'completed'
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
  const incorrect = Object.values(state.answers).filter((answer) => !answer).length
  const elapsedSeconds = Math.min(
    TIME_LIMIT_SECONDS,
    Math.max(0, Math.floor((Date.parse(state.completedAt) - Date.parse(state.startedAt)) / 1000)),
  )
  const title = page.querySelector<HTMLElement>('[data-result-title]')
  const summary = page.querySelector<HTMLElement>('[data-result-summary]')
  const stats = page.querySelector<HTMLElement>('[data-result-stats]')
  if (state.endedReason === 'timeout') {
    title?.replaceChildren('Hết giờ')
    summary?.replaceChildren(`Phiên làm bài đã kết thúc vì đã hết ${Math.round(state.timeLimitSeconds / 60)} phút. Em có thể làm lại hoặc ôn các câu sai.`)
  } else if (state.masteredIds.length === QUESTION_COUNT) {
    title?.replaceChildren('Thành tựu đã hoàn thành!')
    summary?.replaceChildren('Em đã từng trả lời đúng đủ 150 câu hỏi. Rất tuyệt vời!')
  } else {
    summary?.replaceChildren('Em có thể làm lại toàn bộ hoặc ôn riêng các câu vừa trả lời chưa đúng.')
  }
  if (stats) stats.innerHTML = `<div><b>${formatTime(elapsedSeconds)}</b><span>Thời gian</span></div><div><b>${correct}</b><span>Câu đúng</span></div><div><b>${incorrect}</b><span>Câu sai</span></div><div><b>${state.masteredIds.length}/150</b><span>Đã xác nhận đúng</span></div>`
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
    } else if (actionName === 'reset') {
      document.querySelector<HTMLElement>('[data-reset-confirm]')?.removeAttribute('hidden')
    } else if (actionName === 'cancel-reset') {
      document.querySelector<HTMLElement>('[data-reset-confirm]')?.setAttribute('hidden', '')
    } else if (actionName === 'confirm-reset') {
      localStorage.removeItem(STORAGE_KEY)
      const order = document.querySelector<HTMLInputElement>('input[name="order"]:checked')?.value === 'reverse' ? 'reverse' : 'normal'
      startPractice(order)
    }
  }
})

document.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | null
  if (!target?.matches('[data-time-limit]')) return
  const minutes = Number(target.value)
  if (Number.isInteger(minutes) && minutes >= MIN_TIME_LIMIT_MINUTES && minutes <= MAX_TIME_LIMIT_MINUTES) {
    saveSettings({ timeLimitMinutes: minutes })
  }
})

const timeLimitInput = document.querySelector<HTMLInputElement>('[data-time-limit]')
if (timeLimitInput) timeLimitInput.value = String(readSettings().timeLimitMinutes)
updateHome()
updateIntro()
setQuestionMode()
renderResults()
