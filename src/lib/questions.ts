import rawQuestions from '../data/van-mieu-quoc-tu-giam.questions.json'
import { getExplanation } from './explanation-notes'

export interface Question {
  id: number
  question: string
  options: Record<string, string>
  answer_text: string
  correct_option: string
  explanation: string
}

// File nguồn có một vài số thứ tự bị lặp. ID nội bộ luôn theo vị trí 1–150 để
// URL, tiến độ localStorage và thứ tự luyện tập ổn định.
export const questions = (rawQuestions as Question[]).map((question, index) => ({
  ...question,
  id: index + 1,
  explanation: getExplanation(index + 1, question.explanation),
}))
export const questionIds = questions.map((question) => question.id)

export function getQuestion(id: number): Question | undefined {
  return questions.find((question) => question.id === id)
}

export function questionPath(id: number): string {
  return `/on-tap/van-mieu-quoc-tu-giam/cau-${id}`
}

export const practicePath = '/on-tap/van-mieu-quoc-tu-giam'
export const resultPath = '/on-tap/van-mieu-quoc-tu-giam/ket-qua'
