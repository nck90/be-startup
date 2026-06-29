import { useMemo, useState } from 'react'
import './App.css'

type FounderType = 'builder' | 'sales' | 'planner' | 'fundraiser'
type Difficulty = 'easy' | 'normal' | 'hard'
type Strategy = 'lean' | 'growth' | 'fundraising' | 'bootstrap'
type Screen = 'start' | 'create' | 'play' | 'result' | 'ending'
type MetricKey =
  | 'product'
  | 'validation'
  | 'market'
  | 'profit'
  | 'team'
  | 'investment'
  | 'stress'
  | 'execution'
  | 'problem'

type Company = {
  name: string
  problem: string
  customer: string
  category: string
  founderType: FounderType
  difficulty: Difficulty
  strategy: Strategy
}

type GameState = {
  company: Company
  month: number
  capital: number
  burn: number
  metrics: Record<MetricKey, number>
  pivoted: boolean
  investmentFailed: boolean
  history: Result[]
}

type Effect = Partial<Record<MetricKey, number>> & {
  capital?: number
  burn?: number
  pivoted?: boolean
  investmentCheck?: boolean
  adExperiment?: boolean
}

type Choice = {
  label: string
  detail: string
  effect: Effect
  response: string
}

type Chapter = {
  month: number
  title: string
  character: 'seoyoon' | 'minjae' | 'jihyun' | 'vc'
  speaker: string
  quote: string
  lesson: string
  choices: Choice[]
}

type Result = {
  month: number
  title: string
  narrative: string
  deltas: string[]
  runwayBefore: number
  runwayAfter: number
  incident?: {
    title: string
    body: string
  }
}

type Incident = {
  title: string
  body: string
  chance: (state: GameState, metrics: Record<MetricKey, number>, capital: number, burn: number) => number
  effect: Effect
}

type Achievement = {
  title: string
  body: string
  unlocked: boolean
}

type Mission = {
  title: string
  body: string
  done: boolean
}

type ChecklistItem = {
  label: string
  done: boolean
}

const STORAGE_KEY = 'be-startup-save'

const founderTypes: Record<FounderType, { label: string; bonus: string; effect: Partial<Record<MetricKey, number>> }> = {
  builder: { label: '개발형 대표', bonus: '제품 완성도 +10', effect: { product: 10 } },
  sales: { label: '영업형 대표', bonus: '고객 검증도 +10', effect: { validation: 10 } },
  planner: { label: '기획형 대표', bonus: '문제 해결력 +10', effect: { problem: 10 } },
  fundraiser: { label: '투자형 대표', bonus: '투자 매력도 +10', effect: { investment: 10 } },
}

const difficultySettings: Record<Difficulty, { label: string; description: string; capital: number; burn: number; stress: number }> = {
  easy: {
    label: '이지 모드',
    description: '자금 여유가 있어 창업 흐름을 학습하기 좋습니다.',
    capital: 6500,
    burn: 620,
    stress: 12,
  },
  normal: {
    label: '스탠다드',
    description: '기획안 기준의 기본 스타트업 생존 난이도입니다.',
    capital: 5000,
    burn: 700,
    stress: 20,
  },
  hard: {
    label: '하드 모드',
    description: '짧은 런웨이와 높은 압박 속에서 의사결정합니다.',
    capital: 4200,
    burn: 820,
    stress: 32,
  },
}

const strategySettings: Record<Strategy, { label: string; description: string; effect: Partial<Record<MetricKey, number>> & { capital?: number; burn?: number } }> = {
  lean: {
    label: '린 MVP',
    description: '고객 검증과 문제 정의를 우선합니다.',
    effect: { validation: 8, problem: 8, product: -2 },
  },
  growth: {
    label: '빠른 성장',
    description: '시장성과 실행 속도를 밀어붙입니다.',
    effect: { market: 8, execution: 8, burn: 80, stress: 4 },
  },
  fundraising: {
    label: '투자 유치',
    description: 'IR 설득력과 시장 스토리를 강화합니다.',
    effect: { investment: 12, market: 4, capital: -150 },
  },
  bootstrap: {
    label: '부트스트랩',
    description: '현금 보존과 수익성을 우선합니다.',
    effect: { profit: 8, team: 4, burn: -80, market: -3 },
  },
}

const metricLabels: Record<MetricKey, string> = {
  product: '제품 완성도',
  validation: '고객 검증도',
  market: '시장성',
  profit: '수익성',
  team: '팀 신뢰도',
  investment: '투자 매력도',
  stress: '스트레스',
  execution: '실행력',
  problem: '문제 해결력',
}

const chapters: Chapter[] = [
  {
    month: 1,
    title: '아이디어 선정',
    character: 'seoyoon',
    speaker: '공동창업자 서윤',
    quote: '요즘 AI 서비스가 뜨니까 우리도 AI 스타트업으로 가면 어때?',
    lesson: '좋은 창업은 유행보다 고객 문제 정의에서 시작됩니다.',
    choices: [
      {
        label: '고객 문제를 먼저 찾는다',
        detail: '트렌드를 잠시 내려놓고 실제 불편을 인터뷰합니다.',
        effect: { validation: 10, team: 5, problem: 10 },
        response: '서윤이 고개를 끄덕입니다. 팀은 유행보다 문제에 집중하기로 했습니다.',
      },
      {
        label: 'AI 트렌드에 맞춰 빠르게 시작한다',
        detail: '빠른 프로토타입으로 시장 반응을 봅니다.',
        effect: { market: 5, product: 5, validation: -5, execution: 5 },
        response: '속도는 붙었지만 아직 누가 절실히 원하는지는 흐릿합니다.',
      },
      {
        label: '투자자가 좋아할 아이템으로 정한다',
        detail: 'IR에서 설명하기 좋은 시장과 키워드를 우선합니다.',
        effect: { investment: 10, problem: -10, team: -3 },
        response: '그럴듯한 스토리는 생겼지만 팀 내부에서는 문제의식이 약해졌습니다.',
      },
    ],
  },
  {
    month: 2,
    title: '고객 검증',
    character: 'jihyun',
    speaker: '초기 고객 지현',
    quote: '그 기능이 있으면 좋긴 한데, 제가 돈을 낼 정도인지는 모르겠어요.',
    lesson: '고객 인터뷰는 제품을 만들기 전에 위험한 가정을 줄입니다.',
    choices: [
      {
        label: '타겟 고객 10명을 인터뷰한다',
        detail: '시간은 들지만 진짜 문제와 지불 의사를 확인합니다.',
        effect: { capital: -100, validation: 20, market: 10, problem: 8 },
        response: '예상과 다른 반복 문제가 발견됐습니다. 아이디어가 더 날카로워졌습니다.',
      },
      {
        label: '간단한 설문조사만 진행한다',
        detail: '빠르고 저렴하게 정량 신호를 모읍니다.',
        effect: { capital: -30, validation: 8, market: 3 },
        response: '응답은 모였지만 왜 필요한지에 대한 깊이는 부족합니다.',
      },
      {
        label: '검증 없이 바로 개발한다',
        detail: '제품을 먼저 보여주고 판단받습니다.',
        effect: { capital: -500, product: 15, validation: -15, stress: 8 },
        response: 'MVP는 빨리 나왔지만 고객 반응이 차갑습니다.',
      },
    ],
  },
  {
    month: 3,
    title: '팀 구성',
    character: 'minjae',
    speaker: '개발자 민재',
    quote: '지금 속도로는 출시가 늦어질 수 있어요. 사람을 더 뽑을까요?',
    lesson: '채용은 실행 속도를 올리지만 런웨이를 줄이는 결정입니다.',
    choices: [
      {
        label: '정규 개발자를 채용한다',
        detail: '팀 속도를 높이는 대신 고정비가 커집니다.',
        effect: { capital: -300, burn: 350, product: 25, execution: 15, team: 4 },
        response: '개발 속도는 크게 올라갔지만 매달 나가는 비용도 무거워졌습니다.',
      },
      {
        label: '외주 개발을 맡긴다',
        detail: '한 번에 목돈을 쓰고 빠르게 결과물을 받습니다.',
        effect: { capital: -1000, product: 20, team: -5, stress: 5 },
        response: '화면은 빨리 나왔지만 내부 이해도가 낮아 유지보수가 걱정됩니다.',
      },
      {
        label: '직접 개발을 유지한다',
        detail: '비용은 아끼고 핵심만 천천히 만듭니다.',
        effect: { product: 5, execution: 5, stress: 15 },
        response: '돈은 아꼈지만 대표의 밤샘이 늘었습니다.',
      },
    ],
  },
  {
    month: 4,
    title: 'MVP 개발 범위',
    character: 'minjae',
    speaker: '개발자 민재',
    quote: '대표님, 기능을 어디까지 넣어서 출시할까요?',
    lesson: 'MVP는 완성품이 아니라 학습 속도를 높이는 실험입니다.',
    choices: [
      {
        label: '핵심 기능 1개만 출시한다',
        detail: '가장 위험한 가정을 빠르게 검증합니다.',
        effect: { capital: -300, product: 15, validation: 10, execution: 8 },
        response: '작지만 명확한 제품이 나왔고 고객 반응을 바로 배울 수 있게 됐습니다.',
      },
      {
        label: '기능 5개를 한 번에 만든다',
        detail: '풍성해 보이는 제품을 위해 출시를 늦춥니다.',
        effect: { capital: -1000, product: 25, validation: -6, stress: 10 },
        response: '제품은 좋아 보이지만 시장 학습 없이 런웨이를 크게 태웠습니다.',
      },
      {
        label: '출시를 미루고 기획을 더 한다',
        detail: '문제 정의와 사용자 흐름을 더 다듬습니다.',
        effect: { problem: 10, product: -5, validation: 4, stress: 4 },
        response: '기획은 정교해졌지만 실제 고객 반응은 아직 확인하지 못했습니다.',
      },
    ],
  },
  {
    month: 5,
    title: '첫 고객 확보',
    character: 'jihyun',
    speaker: '초기 고객 지현',
    quote: '써볼 수는 있어요. 그런데 주변 사람에게 추천할 만큼 명확한가요?',
    lesson: '초기 고객 확보는 돈보다 선명한 문제와 직접 접촉이 중요할 때가 많습니다.',
    choices: [
      {
        label: '직접 DM과 콜드메일을 보낸다',
        detail: '느리지만 고객 목소리를 직접 듣습니다.',
        effect: { capital: -50, validation: 15, execution: 15, profit: 5 },
        response: '작은 유료 전환이 생겼고 고객의 언어를 더 잘 이해하게 됐습니다.',
      },
      {
        label: '광고비 500만 원을 집행한다',
        detail: '클릭과 전환 데이터를 빠르게 확인합니다.',
        effect: { capital: -500, market: 10, adExperiment: true },
        response: '광고 성과가 공개됐습니다. 결과는 이번 라운드의 운과 제품 설득력에 달렸습니다.',
      },
      {
        label: '지인에게만 소개한다',
        detail: '부담 없이 반응을 보지만 시장 신호는 약합니다.',
        effect: { validation: 5, team: 3 },
        response: '응원은 받았지만 냉정한 구매 신호는 거의 없습니다.',
      },
    ],
  },
  {
    month: 6,
    title: '수익모델 결정',
    character: 'seoyoon',
    speaker: '공동창업자 서윤',
    quote: '사용자는 조금씩 늘고 있어. 그런데 돈은 어떻게 벌지 정해야 해.',
    lesson: '사용자가 있어도 수익모델이 없으면 회사는 오래 버티기 어렵습니다.',
    choices: [
      {
        label: '월 구독 모델로 간다',
        detail: '가치를 느끼는 고객에게 반복 매출을 만듭니다.',
        effect: { profit: 20, investment: 10, validation: 4 },
        response: '작지만 예측 가능한 매출 구조가 생겼습니다.',
      },
      {
        label: '광고 모델을 선택한다',
        detail: '사용자 규모를 먼저 키우는 전략입니다.',
        effect: { market: 10, profit: -5, investment: 3 },
        response: '성장 스토리는 좋아졌지만 당장의 현금 흐름은 약합니다.',
      },
      {
        label: '무료로 키운 뒤 나중에 유료화한다',
        detail: '마찰을 낮추고 사용자를 빠르게 모읍니다.',
        effect: { validation: 15, profit: -15, market: 8, stress: 7 },
        response: '사용자는 늘었지만 런웨이 압박이 더 크게 느껴집니다.',
      },
    ],
  },
  {
    month: 7,
    title: '투자자 미팅',
    character: 'vc',
    speaker: '투자자 한 대표',
    quote: '이 서비스가 왜 지금 필요하고, 누가 돈을 내나요?',
    lesson: '투자는 비전뿐 아니라 검증된 고객, 제품, 런웨이의 조합을 봅니다.',
    choices: [
      {
        label: '인터뷰 데이터와 결제 전환율을 보여준다',
        detail: '고객 검증과 수익 가능성을 근거로 답합니다.',
        effect: { investment: 25, validation: 8, investmentCheck: true },
        response: '투자자가 숫자와 고객 반응을 집중해서 보기 시작했습니다.',
      },
      {
        label: '시장 규모와 트렌드를 강조한다',
        detail: '큰 시장과 타이밍을 설득합니다.',
        effect: { market: 15, investment: 10, investmentCheck: true },
        response: '시장은 매력적이지만 실행 증거를 더 요구받았습니다.',
      },
      {
        label: '열정과 비전 위주로 말한다',
        detail: '창업자의 확신을 강하게 전달합니다.',
        effect: { team: 5, investment: -10, stress: 6, investmentCheck: true },
        response: '진심은 전해졌지만 투자 판단에 필요한 근거가 부족했습니다.',
      },
    ],
  },
  {
    month: 8,
    title: '위기와 피벗',
    character: 'seoyoon',
    speaker: '공동창업자 서윤',
    quote: '경쟁사가 먼저 비슷한 서비스를 냈어. 지금 방향을 고집해도 될까?',
    lesson: '피벗은 포기가 아니라 고객 문제를 다시 정의하는 의사결정입니다.',
    choices: [
      {
        label: '고객 세그먼트를 좁혀 피벗한다',
        detail: '가장 절실한 고객군으로 문제를 다시 정의합니다.',
        effect: { capital: -250, validation: 18, problem: 18, market: -4, pivoted: true },
        response: '시장은 작아졌지만 고객 문제는 훨씬 선명해졌습니다.',
      },
      {
        label: '기존 방향을 고수하고 속도로 이긴다',
        detail: '실행력을 끌어올려 경쟁사보다 빨리 움직입니다.',
        effect: { capital: -600, product: 18, execution: 16, stress: 15, team: -4 },
        response: '팀은 빠르게 움직였지만 체력과 현금이 동시에 닳았습니다.',
      },
      {
        label: '서버와 품질 안정화에 집중한다',
        detail: '기능보다 신뢰도를 높여 이탈을 줄입니다.',
        effect: { capital: -400, product: 10, validation: 8, team: 6, stress: -8 },
        response: '큰 뉴스는 없었지만 고객 불만이 줄고 팀 분위기가 안정됐습니다.',
      },
    ],
  },
]

const initialMetrics: Record<MetricKey, number> = {
  product: 20,
  validation: 20,
  market: 45,
  profit: 10,
  team: 60,
  investment: 20,
  stress: 20,
  execution: 30,
  problem: 30,
}

const incidents: Incident[] = [
  {
    title: '서버 장애',
    body: '출시 직후 트래픽이 몰리며 일부 고객이 서비스를 쓰지 못했습니다.',
    chance: (_state, metrics) => (metrics.product < 45 ? 0.28 : 0.08),
    effect: { product: -8, validation: -6, stress: 12 },
  },
  {
    title: '정부지원사업 서류 통과',
    body: '팀이 제출한 사업계획서가 1차 심사를 통과해 운영 자금을 확보했습니다.',
    chance: (_state, metrics) => (metrics.problem >= 45 ? 0.18 : 0.08),
    effect: { capital: 1200, investment: 6, stress: -5 },
  },
  {
    title: '핵심 팀원 번아웃',
    body: '누적된 야근으로 팀 사기가 흔들렸습니다.',
    chance: (_state, metrics) => (metrics.stress >= 60 ? 0.25 : 0.06),
    effect: { team: -10, execution: -6, stress: 8 },
  },
  {
    title: '유료 고객 추천',
    body: '초기 고객이 지인을 소개하며 첫 번째 추천 매출이 생겼습니다.',
    chance: (_state, metrics) => (metrics.validation >= 55 ? 0.22 : 0.05),
    effect: { capital: 350, validation: 6, profit: 8 },
  },
  {
    title: '경쟁사 가격 인하',
    body: '비슷한 서비스가 낮은 가격으로 시장에 진입했습니다.',
    chance: (_state, metrics) => (metrics.market >= 55 ? 0.2 : 0.08),
    effect: { market: -8, investment: -5, stress: 7 },
  },
  {
    title: '현금 경고',
    body: '잔고가 빠르게 줄어 다음 달 지출 계획을 다시 봐야 합니다.',
    chance: (_state, _metrics, capital, burn) => (getRunway(capital, burn) <= 2 ? 0.45 : 0),
    effect: { stress: 10, team: -4 },
  },
]

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

function formatMoney(value: number) {
  return `${value.toLocaleString('ko-KR')}만 원`
}

function getRunway(capital: number, burn: number) {
  if (burn <= 0) return 99
  return Math.max(0, capital / burn)
}

function getEffectPreview(effect: Effect) {
  const preview: string[] = []

  Object.entries(effect).forEach(([key, value]) => {
    if (key in metricLabels && typeof value === 'number') {
      preview.push(`${metricLabels[key as MetricKey]} ${value > 0 ? '+' : ''}${value}`)
    }
  })

  if (effect.capital) preview.push(`자본 ${effect.capital > 0 ? '+' : ''}${formatMoney(effect.capital)}`)
  if (effect.burn) preview.push(`월 고정비 ${effect.burn > 0 ? '+' : ''}${formatMoney(effect.burn)}`)
  if (effect.adExperiment) preview.push('광고 성과 랜덤')
  if (effect.investmentCheck) preview.push('투자 심사 발생')
  if (effect.pivoted) preview.push('피벗 플래그')

  return preview
}

function getMission(state: GameState): Mission {
  const runway = getRunway(state.capital, state.burn)

  if (state.month <= 1) {
    return {
      title: '문제 정의',
      body: '문제 해결력 40 이상 또는 고객 검증도 30 이상 만들기',
      done: state.metrics.problem >= 40 || state.metrics.validation >= 30,
    }
  }
  if (state.month === 2) {
    return {
      title: '고객 검증',
      body: '고객 검증도 45 이상 달성',
      done: state.metrics.validation >= 45,
    }
  }
  if (state.month === 3) {
    return {
      title: '팀 속도 확보',
      body: '실행력 45 이상 또는 제품 완성도 45 이상 달성',
      done: state.metrics.execution >= 45 || state.metrics.product >= 45,
    }
  }
  if (state.month === 4) {
    return {
      title: 'MVP 검증',
      body: '제품 완성도 50 이상, 고객 검증도 40 이상',
      done: state.metrics.product >= 50 && state.metrics.validation >= 40,
    }
  }
  if (state.month === 5) {
    return {
      title: '첫 매출 신호',
      body: '수익성 25 이상 또는 고객 검증도 55 이상',
      done: state.metrics.profit >= 25 || state.metrics.validation >= 55,
    }
  }
  if (state.month === 6) {
    return {
      title: '비즈니스 모델',
      body: '수익성 40 이상 만들기',
      done: state.metrics.profit >= 40,
    }
  }
  if (state.month === 7) {
    return {
      title: 'IR 설득력',
      body: '투자 매력도 60 이상, 런웨이 2개월 이상',
      done: state.metrics.investment >= 60 && runway >= 2,
    }
  }

  return {
    title: '데모데이 생존',
    body: '런웨이 1개월 이상과 고객 검증도 60 이상 확보',
    done: runway >= 1 && state.metrics.validation >= 60,
  }
}

function getOutcomeSignals(result: Result) {
  const signals: string[] = []
  const joined = result.deltas.join(' ')

  if (joined.includes('고객 검증도 +') || joined.includes('문제 해결력 +')) signals.push('고객 학습 증가')
  if (joined.includes('제품 완성도 +') || joined.includes('실행력 +')) signals.push('실행 속도 증가')
  if (joined.includes('투자 매력도 +') || joined.includes('시장성 +')) signals.push('외부 설득력 증가')
  if (joined.includes('수익성 +')) signals.push('매출 가능성 증가')
  if (joined.includes('팀 신뢰도 +')) signals.push('팀 분위기 안정')
  if (joined.includes('자본 -') || joined.includes('월 고정비 지출') || result.runwayAfter < result.runwayBefore) signals.push('자금 압박 증가')
  if (joined.includes('스트레스 +') || joined.includes('팀 신뢰도 -')) signals.push('내부 리스크 증가')
  if (joined.includes('고객 검증도 -') || joined.includes('시장성 -')) signals.push('시장 신호 약화')
  if (result.incident) signals.push('예상 밖 변수 발생')

  return Array.from(new Set(signals)).slice(0, 5)
}

function getOutcomeTone(result: Result) {
  const signals = getOutcomeSignals(result)
  const negativeCount = signals.filter((signal) => signal.includes('압박') || signal.includes('리스크') || signal.includes('약화')).length
  const runwayDrop = result.runwayBefore - result.runwayAfter

  if (result.runwayAfter <= 1 || negativeCount >= 2) {
    return {
      label: '위험한 선택',
      body: '선택의 대가는 작지 않았습니다. 다음 달에는 생존 시간을 먼저 회복해야 합니다.',
      className: 'danger',
    }
  }
  if (runwayDrop >= 1) {
    return {
      label: '공격적인 선택',
      body: '성과 가능성은 생겼지만, 회사의 시간이 함께 줄었습니다.',
      className: 'warning',
    }
  }
  return {
    label: '안정적인 선택',
    body: '큰 무리는 없었습니다. 이제 다음 지표를 차분히 끌어올릴 차례입니다.',
    className: 'success',
  }
}

function getStrategyFit(state: GameState) {
  const runway = getRunway(state.capital, state.burn)

  if (state.company.strategy === 'lean') {
    const score = Math.round((state.metrics.validation + state.metrics.problem + Math.min(100, runway * 14)) / 3)
    return {
      score,
      label: score >= 70 ? '고객 학습이 전략과 잘 맞습니다.' : '검증 없는 개발비 지출을 더 줄여야 합니다.',
    }
  }

  if (state.company.strategy === 'growth') {
    const score = Math.round((state.metrics.market + state.metrics.execution + state.metrics.product - state.metrics.stress * 0.5) / 2.5)
    return {
      score: clamp(score),
      label: score >= 70 ? '성장 속도가 설득력 있게 쌓이고 있습니다.' : '성장 전략에는 실행력과 제품 신뢰도가 더 필요합니다.',
    }
  }

  if (state.company.strategy === 'fundraising') {
    const score = Math.round((state.metrics.investment + state.metrics.market + state.metrics.validation + Math.min(100, runway * 12)) / 4)
    return {
      score,
      label: score >= 70 ? '투자자에게 설명할 근거가 충분해지고 있습니다.' : '투자 전략에는 고객 검증과 런웨이 방어가 더 필요합니다.',
    }
  }

  const score = Math.round((state.metrics.profit + state.metrics.team + Math.min(100, runway * 16) - state.metrics.stress * 0.4) / 2.6)
  return {
    score: clamp(score),
    label: score >= 70 ? '현금 보존과 수익 실험이 잘 맞물립니다.' : '부트스트랩 전략에는 수익성 개선이 더 필요합니다.',
  }
}

function getAdvisorFeedback(state: GameState, result?: Result) {
  const runway = getRunway(state.capital, state.burn)
  const strategyFit = getStrategyFit(state)

  if (state.capital <= 0) return '현금이 끝났습니다. 다음 플레이에서는 큰 지출 전에 월 소진액 변화를 먼저 확인하세요.'
  if (runway <= 2) return '런웨이가 짧습니다. 다음 선택은 자본 확보, 고정비 절감, 매출 신호 중 하나에 집중하는 편이 좋습니다.'
  if (state.metrics.validation < 40 && state.metrics.product >= 60) return '제품보다 고객 검증이 뒤처졌습니다. 다음 의사결정은 인터뷰나 유료 전환 확인이 우선입니다.'
  if (state.metrics.team <= 35) return '팀 신뢰도가 낮습니다. 속도를 높이는 선택보다 갈등을 줄이는 선택이 장기적으로 유리합니다.'
  if (result?.incident) return '돌발 이벤트가 발생했습니다. 이번 달 수치만 보지 말고 다음 달 리스크 알림까지 같이 확인하세요.'
  if (strategyFit.score < 55) return strategyFit.label

  return '현재 전략과 지표가 크게 어긋나지 않습니다. 다음 선택에서는 가장 낮은 핵심 지표를 보완하세요.'
}

function getFocusMetric(state: GameState) {
  const runway = getRunway(state.capital, state.burn)
  const candidates: { key: MetricKey | 'runway'; label: string; value: number; reason: string }[] = [
    { key: 'runway', label: '런웨이', value: Math.min(100, runway * 18), reason: '생존 기간이 짧으면 모든 전략의 선택지가 줄어듭니다.' },
    { key: 'validation', label: metricLabels.validation, value: state.metrics.validation, reason: '고객 검증은 제품과 투자 판단의 공통 근거입니다.' },
    { key: 'profit', label: metricLabels.profit, value: state.metrics.profit, reason: '수익성은 매출 기반 생존과 투자 설득력을 동시에 높입니다.' },
    { key: 'team', label: metricLabels.team, value: state.metrics.team, reason: '팀 신뢰도가 낮으면 실행 속도가 오래 유지되지 않습니다.' },
    { key: 'investment', label: metricLabels.investment, value: state.metrics.investment, reason: '투자 미팅 전에는 시장성과 검증 지표를 연결해야 합니다.' },
  ]

  if (state.month <= 4) {
    candidates.push({ key: 'product', label: metricLabels.product, value: state.metrics.product, reason: '초기에는 검증 가능한 MVP 수준까지 제품을 끌어올려야 합니다.' })
  }

  return candidates.sort((a, b) => a.value - b.value)[0]
}

function getCashForecast(state: GameState) {
  return Array.from({ length: 4 }, (_item, index) => {
    const month = state.month + index
    const capital = Math.max(0, state.capital - state.burn * index)
    return {
      month,
      capital,
      runway: getRunway(capital, state.burn),
    }
  })
}

function getIrChecklist(state: GameState): ChecklistItem[] {
  const runway = getRunway(state.capital, state.burn)

  return [
    { label: '고객 검증 50+', done: state.metrics.validation >= 50 },
    { label: '제품 완성도 50+', done: state.metrics.product >= 50 },
    { label: '런웨이 2개월+', done: runway >= 2 },
    { label: '수익성 35+', done: state.metrics.profit >= 35 },
    { label: '투자 매력도 60+', done: state.metrics.investment >= 60 },
  ]
}

function getFounderScore(state: GameState) {
  const runway = getRunway(state.capital, state.burn)
  const positive =
    state.metrics.product +
    state.metrics.validation +
    state.metrics.market +
    state.metrics.profit +
    state.metrics.team +
    state.metrics.investment +
    state.metrics.execution +
    state.metrics.problem
  const runwayBonus = Math.min(120, runway * 14)
  const capitalBonus = Math.max(0, Math.min(80, state.capital / 100))
  const score = Math.round(Math.max(0, Math.min(100, (positive + runwayBonus + capitalBonus - state.metrics.stress * 1.2) / 9)))

  if (score >= 85) return { score, grade: 'S', label: '투자자가 다시 만나고 싶은 팀' }
  if (score >= 72) return { score, grade: 'A', label: '다음 라운드를 설득할 수 있는 팀' }
  if (score >= 58) return { score, grade: 'B', label: '방향을 찾은 초기 팀' }
  if (score >= 42) return { score, grade: 'C', label: '위험을 줄여야 하는 팀' }
  return { score, grade: 'D', label: '재설계가 필요한 팀' }
}

function getAchievements(state: GameState): Achievement[] {
  const runway = getRunway(state.capital, state.burn)

  return [
    {
      title: '문제 발견자',
      body: '고객 검증도 60 이상',
      unlocked: state.metrics.validation >= 60,
    },
    {
      title: 'MVP 출시팀',
      body: '제품 완성도 60 이상',
      unlocked: state.metrics.product >= 60,
    },
    {
      title: '현금 방어',
      body: '런웨이 3개월 이상 유지',
      unlocked: runway >= 3,
    },
    {
      title: '매출 실험',
      body: '수익성 45 이상',
      unlocked: state.metrics.profit >= 45,
    },
    {
      title: '팀 빌더',
      body: '팀 신뢰도 70 이상',
      unlocked: state.metrics.team >= 70,
    },
    {
      title: 'IR 준비 완료',
      body: '투자 매력도 70 이상',
      unlocked: state.metrics.investment >= 70,
    },
    {
      title: '하드 생존자',
      body: '하드 모드에서 6개월차 이후 도달',
      unlocked: state.company.difficulty === 'hard' && state.month >= 7,
    },
  ]
}

function applyEffect(
  effect: Effect,
  metrics: Record<MetricKey, number>,
  deltas: string[],
  capital: number,
  burn: number,
) {
  let nextCapital = capital + (effect.capital ?? 0)
  const nextBurn = Math.max(100, burn + (effect.burn ?? 0))

  Object.entries(effect).forEach(([key, value]) => {
    if (key in metricLabels && typeof value === 'number') {
      const metricKey = key as MetricKey
      metrics[metricKey] = clamp(metrics[metricKey] + value)
      deltas.push(`${metricLabels[metricKey]} ${value > 0 ? '+' : ''}${value}`)
    }
  })

  if (effect.capital) {
    deltas.push(`자본 ${effect.capital > 0 ? '+' : ''}${formatMoney(effect.capital)}`)
  }
  if (effect.burn) {
    deltas.push(`월 소진액 ${effect.burn > 0 ? '+' : ''}${formatMoney(effect.burn)}`)
  }

  return { capital: nextCapital, burn: nextBurn }
}

function getRiskNotes(state: GameState) {
  const runway = getRunway(state.capital, state.burn)
  const notes: string[] = []

  if (runway <= 2) notes.push('런웨이 위험')
  if (state.metrics.stress >= 70) notes.push('대표 스트레스 과부하')
  if (state.metrics.team <= 35) notes.push('팀 신뢰도 저하')
  if (state.metrics.product >= 70 && state.metrics.validation <= 35) notes.push('고객 없는 제품 위험')
  if (state.metrics.profit <= 20 && state.month >= 6) notes.push('수익모델 취약')

  return notes
}

function pickIncident(
  state: GameState,
  metrics: Record<MetricKey, number>,
  capital: number,
  burn: number,
) {
  if (state.month < 3 || state.month > 8) return null

  const candidates = incidents
    .map((incident) => ({ incident, chance: incident.chance(state, metrics, capital, burn) }))
    .filter(({ chance }) => chance > 0)
    .sort((a, b) => b.chance - a.chance)

  for (const { incident, chance } of candidates) {
    if (Math.random() < chance) return incident
  }

  return null
}

function createNewGame(company: Company): GameState {
  const metrics = { ...initialMetrics }
  const difficulty = difficultySettings[company.difficulty]
  const strategy = strategySettings[company.strategy]
  const founderBonus = founderTypes[company.founderType].effect
  metrics.stress = difficulty.stress
  Object.entries(founderBonus).forEach(([key, value]) => {
    metrics[key as MetricKey] = clamp(metrics[key as MetricKey] + (value ?? 0))
  })
  Object.entries(strategy.effect).forEach(([key, value]) => {
    if (key in metricLabels && typeof value === 'number') {
      metrics[key as MetricKey] = clamp(metrics[key as MetricKey] + value)
    }
  })

  return {
    company,
    month: 1,
    capital: difficulty.capital + (strategy.effect.capital ?? 0),
    burn: Math.max(100, difficulty.burn + (strategy.effect.burn ?? 0)),
    metrics,
    pivoted: false,
    investmentFailed: false,
    history: [],
  }
}

function normalizeSave(savedState: GameState): GameState {
  const company = {
    ...savedState.company,
    difficulty: savedState.company.difficulty ?? 'normal',
    strategy: savedState.company.strategy ?? 'lean',
  }

  return {
    ...savedState,
    company,
    history: savedState.history.map((item, index) => ({
      ...item,
      month: item.month ?? index + 1,
    })),
  }
}

function getEnding(state: GameState) {
  const runway = getRunway(state.capital, state.burn)
  const { product, validation, profit, team, investment, stress, market } = state.metrics

  if (state.capital <= 0) {
    return {
      title: '런웨이 소진 엔딩',
      tone: 'danger',
      body: '자금이 모두 소진되어 서비스를 계속 운영할 수 없게 됐습니다. 다음 창업에서는 지출 결정마다 런웨이를 먼저 확인해야 합니다.',
    }
  }

  if (team <= 20 && stress >= 80) {
    return {
      title: '팀 붕괴 엔딩',
      tone: 'danger',
      body: '갈등과 압박이 누적되며 프로젝트가 중단됐습니다. 스타트업의 속도는 팀 신뢰도 위에서만 지속됩니다.',
    }
  }

  if (investment >= 80 && validation >= 60 && profit >= 50 && runway >= 2) {
    return {
      title: '투자 유치 성공 엔딩',
      tone: 'success',
      body: 'VC로부터 Seed 투자를 유치했습니다. 고객 검증, 수익성, 런웨이가 함께 설득력을 만들었습니다.',
    }
  }

  if (profit >= 70 && validation >= 60 && state.investmentFailed && runway >= 1) {
    return {
      title: '매출 기반 생존 엔딩',
      tone: 'success',
      body: '투자는 받지 못했지만 유료 고객 덕분에 회사를 유지했습니다. 매출은 가장 현실적인 자금 조달 방식이 될 수 있습니다.',
    }
  }

  if (market < 45 && state.pivoted && validation >= 70) {
    return {
      title: '피벗 성공 엔딩',
      tone: 'success',
      body: '처음 아이디어는 흔들렸지만 고객 문제를 다시 정의해 새로운 기회를 찾았습니다.',
    }
  }

  if (product >= 80 && validation <= 30) {
    return {
      title: '제품만 있고 고객 없는 엔딩',
      tone: 'warning',
      body: '제품은 완성됐지만 실제로 쓰고 돈을 낼 고객이 부족합니다. 만들기 전에 검증하는 습관이 필요합니다.',
    }
  }

  if (runway >= 1 && validation >= 55 && product >= 55) {
    return {
      title: '작지만 살아남은 팀 엔딩',
      tone: 'success',
      body: '완벽한 승리는 아니지만 고객과 제품의 방향을 찾았습니다. 다음 라운드에서 성장 전략을 실험할 수 있습니다.',
    }
  }

  return {
    title: '불안정한 생존 엔딩',
    tone: 'warning',
    body: '회사는 아직 남아 있지만 제품, 고객, 수익 중 하나가 약합니다. 스타트업은 균형이 무너지면 런웨이가 빠르게 줄어듭니다.',
  }
}

function CharacterPortrait({ type }: { type: Chapter['character'] }) {
  const label = {
    seoyoon: '서윤',
    minjae: '민재',
    jihyun: '지현',
    vc: '한 대표',
  }[type]

  return (
    <div className={`portrait ${type}`} aria-label={`${label} 캐릭터 이미지`}>
      <div className="portraitGlow" />
      <div className="hair" />
      <div className="face">
        <span className="eye left" />
        <span className="eye right" />
        <span className="mouth" />
      </div>
      <div className="body" />
      <div className="badge">{label}</div>
    </div>
  )
}

function StartupBackground() {
  return (
    <div className="sceneArt" aria-hidden="true">
      <div className="city">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="chartLine" />
      <div className="desk" />
      <div className="laptop" />
      <div className="coffee" />
    </div>
  )
}

function Dashboard({ state }: { state: GameState }) {
  const runway = getRunway(state.capital, state.burn)
  const metricEntries = Object.entries(state.metrics) as [MetricKey, number][]
  const riskNotes = getRiskNotes(state)
  const recentHistory = state.history.slice(-4).reverse()
  const founderScore = getFounderScore(state)
  const achievements = getAchievements(state)
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length
  const mission = getMission(state)
  const strategyFit = getStrategyFit(state)
  const focusMetric = getFocusMetric(state)
  const cashForecast = getCashForecast(state)
  const maxForecastCapital = Math.max(...cashForecast.map((item) => item.capital), 1)
  const irChecklist = getIrChecklist(state)
  const irReadyCount = irChecklist.filter((item) => item.done).length

  return (
    <aside className="dashboard" aria-label="스타트업 현재 상태">
      <div className="companyCard">
        <p className="eyebrow">MONTH {state.month}</p>
        <h2>{state.company.name}</h2>
        <p>{state.company.category} · {state.company.customer}</p>
        <span>{difficultySettings[state.company.difficulty].label}</span>
        <span>{strategySettings[state.company.strategy].label}</span>
      </div>

      <div className="progressTrack" aria-label="월별 진행률">
        {chapters.map((chapter) => (
          <span
            className={chapter.month < state.month ? 'done' : chapter.month === state.month ? 'current' : ''}
            key={chapter.month}
          >
            {chapter.month}
          </span>
        ))}
      </div>

      <div className="scoreCard">
        <span>Founder Score</span>
        <strong>{founderScore.grade}</strong>
        <p>{founderScore.score}점 · {founderScore.label}</p>
      </div>

      <div className={`missionCard ${mission.done ? 'done' : ''}`}>
        <span>{mission.done ? '이번 달 미션 완료' : '이번 달 미션'}</span>
        <strong>{mission.title}</strong>
        <p>{mission.body}</p>
      </div>

      <div className="strategyCard">
        <span>전략 적합도</span>
        <strong>{strategyFit.score}</strong>
        <p>{strategyFit.label}</p>
      </div>

      <div className="focusCard">
        <span>다음 집중 지표</span>
        <strong>{focusMetric.label}</strong>
        <p>{focusMetric.reason}</p>
      </div>

      <div className="moneyGrid">
        <div>
          <span>현재 자본</span>
          <strong>{formatMoney(state.capital)}</strong>
        </div>
        <div>
          <span>월 소진액</span>
          <strong>{formatMoney(state.burn)}</strong>
        </div>
        <div className={runway <= 2 ? 'dangerStat' : ''}>
          <span>남은 런웨이</span>
          <strong>{runway.toFixed(1)}개월</strong>
        </div>
      </div>

      <div className="forecastCard" aria-label="현금 흐름 예측">
        <strong>현금 예측</strong>
        <div>
          {cashForecast.map((item) => (
            <span key={item.month}>
              <em style={{ height: `${Math.max(8, (item.capital / maxForecastCapital) * 72)}px` }} />
              <b>{item.month}M</b>
            </span>
          ))}
        </div>
      </div>

      {riskNotes.length > 0 && (
        <div className="riskBox" aria-label="현재 리스크">
          <strong>리스크 알림</strong>
          <div>
            {riskNotes.map((note) => <span key={note}>{note}</span>)}
          </div>
        </div>
      )}

      <div className="metricList">
        {metricEntries.map(([key, value]) => (
          <div className="metric" key={key}>
            <div>
              <span>{metricLabels[key]}</span>
              <strong>{value}</strong>
            </div>
            <progress value={value} max="100" />
          </div>
        ))}
      </div>

      <div className="irChecklist" aria-label="IR 준비 체크리스트">
        <strong>IR 준비 {irReadyCount}/{irChecklist.length}</strong>
        {irChecklist.map((item) => (
          <div className={item.done ? 'done' : ''} key={item.label}>
            <span />
            <p>{item.label}</p>
          </div>
        ))}
      </div>

      <div className="achievementMini" aria-label="업적 현황">
        <strong>업적 {unlockedCount}/{achievements.length}</strong>
        <div>
          {achievements.map((achievement) => (
            <span className={achievement.unlocked ? 'unlocked' : ''} key={achievement.title}>
              {achievement.title}
            </span>
          ))}
        </div>
      </div>

      {recentHistory.length > 0 && (
        <div className="historyBox" aria-label="최근 의사결정 기록">
          <strong>최근 결정</strong>
          {recentHistory.map((item) => (
            <div className="historyItem" key={`${item.month}-${item.title}`}>
              <span>{item.month}개월차</span>
              <p>{item.title}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

function StartScreen({ onCreate, onContinue }: { onCreate: () => void; onContinue: () => void }) {
  const hasSave = Boolean(localStorage.getItem(STORAGE_KEY))

  return (
    <main className="startScreen">
      <section className="heroPanel">
        <div className="heroCopy">
          <p className="eyebrow">Startup Survival Simulation</p>
          <h1>Be StartUp</h1>
          <p>
            당신은 오늘 스타트업 대표가 되었습니다. 초기 자본 5,000만 원과 8개월의 시간 안에서
            팀, 고객, 투자자를 설득하고 런웨이를 지켜야 합니다.
          </p>
          <div className="heroActions">
            <button className="primaryButton" type="button" onClick={onCreate}>스타트업 시작하기</button>
            <button className="ghostButton" type="button" onClick={onContinue} disabled={!hasSave}>이어하기</button>
          </div>
        </div>
        <StartupBackground />
      </section>
      <section className="featureStrip" aria-label="게임 핵심 요소">
        <div><strong>8개월</strong><span>월별 의사결정</span></div>
        <div><strong>9개 지표</strong><span>런웨이와 성장 관리</span></div>
        <div><strong>다중 엔딩</strong><span>선택에 따른 결과</span></div>
      </section>
    </main>
  )
}

function CreateScreen({ onStart }: { onStart: (company: Company) => void }) {
  const [company, setCompany] = useState<Company>({
    name: 'Be StartUp',
    problem: '초기 창업자가 무엇부터 해야 할지 모른다',
    customer: '예비 창업자',
    category: 'AI 교육 SaaS',
    founderType: 'planner',
    difficulty: 'normal',
    strategy: 'lean',
  })

  return (
    <main className="createScreen">
      <section className="formPanel">
        <p className="eyebrow">Create Company</p>
        <h1>스타트업 생성</h1>
        <div className="formGrid">
          <label>
            스타트업 이름
            <input value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} />
          </label>
          <label>
            해결할 문제
            <input value={company.problem} onChange={(event) => setCompany({ ...company, problem: event.target.value })} />
          </label>
          <label>
            타겟 고객
            <input value={company.customer} onChange={(event) => setCompany({ ...company, customer: event.target.value })} />
          </label>
          <label>
            서비스 분야
            <input value={company.category} onChange={(event) => setCompany({ ...company, category: event.target.value })} />
          </label>
        </div>

        <div className="founderPicker" role="radiogroup" aria-label="대표 성향">
          {(Object.entries(founderTypes) as [FounderType, (typeof founderTypes)[FounderType]][]).map(([key, item]) => (
            <button
              className={company.founderType === key ? 'selected' : ''}
              key={key}
              type="button"
              onClick={() => setCompany({ ...company, founderType: key })}
            >
              <strong>{item.label}</strong>
              <span>{item.bonus}</span>
            </button>
          ))}
        </div>

        <div className="difficultyPicker" role="radiogroup" aria-label="난이도">
          {(Object.entries(difficultySettings) as [Difficulty, (typeof difficultySettings)[Difficulty]][]).map(([key, item]) => (
            <button
              className={company.difficulty === key ? 'selected' : ''}
              key={key}
              type="button"
              onClick={() => setCompany({ ...company, difficulty: key })}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <em>초기 자본 {formatMoney(item.capital)} · 월 {formatMoney(item.burn)}</em>
            </button>
          ))}
        </div>

        <div className="strategyPicker" role="radiogroup" aria-label="창업 전략">
          {(Object.entries(strategySettings) as [Strategy, (typeof strategySettings)[Strategy]][]).map(([key, item]) => (
            <button
              className={company.strategy === key ? 'selected' : ''}
              key={key}
              type="button"
              onClick={() => setCompany({ ...company, strategy: key })}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <div>
                {getEffectPreview(item.effect).map((preview) => <em key={preview}>{preview}</em>)}
              </div>
            </button>
          ))}
        </div>

        <button
          className="primaryButton"
          type="button"
          onClick={() => onStart(company)}
          disabled={!company.name.trim() || !company.problem.trim()}
        >
          1개월차 시작
        </button>
      </section>
    </main>
  )
}

function PlayScreen({ state, onChoose, onRestart }: { state: GameState; onChoose: (choice: Choice) => void; onRestart: () => void }) {
  const chapter = chapters[state.month - 1]
  const [showStatus, setShowStatus] = useState(false)
  const runway = getRunway(state.capital, state.burn)
  const mission = getMission(state)

  return (
    <main className="vnShell">
      <header className="vnTopBar">
        <div>
          <span>MONTH {state.month}</span>
          <strong>{state.company.name}</strong>
        </div>
        <div className="vnQuickStats" aria-label="핵심 상태">
          <span>자본 {formatMoney(state.capital)}</span>
          <span>런웨이 {runway.toFixed(1)}개월</span>
          <span className={mission.done ? 'done' : ''}>{mission.done ? '미션 완료' : mission.title}</span>
        </div>
        <div className="vnActions">
          <button className="ghostButton compact" type="button" onClick={() => setShowStatus(true)}>상태</button>
          <button className="ghostButton compact" type="button" onClick={onRestart}>새로 시작</button>
        </div>
      </header>

      <section className="vnScene">
        <div className="vnBackdrop" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="vnCharacterStage">
          <CharacterPortrait type={chapter.character} />
        </div>
      </section>

      <section className="vnDialogueBox" aria-label="스토리 선택">
        <div className="vnSpeakerLine">
          <div>
            <p className="eyebrow">Chapter {chapter.month}</p>
            <h1>{chapter.title}</h1>
          </div>
          <span>{chapter.speaker}</span>
        </div>
        <p className="vnQuote">“{chapter.quote}”</p>

        <div className="vnChoiceGrid">
          {chapter.choices.map((choice) => (
            <button key={choice.label} type="button" onClick={() => onChoose(choice)}>
              <span>선택</span>
              <strong>{choice.label}</strong>
              <p>{choice.detail}</p>
            </button>
          ))}
        </div>

        <div className="vnLesson">
          <strong>학습 포인트</strong>
          <span>{chapter.lesson}</span>
        </div>
      </section>

      {showStatus && (
        <div className="vnStatusOverlay" role="dialog" aria-label="상세 상태">
          <button className="vnStatusBackdrop" type="button" aria-label="상태 닫기" onClick={() => setShowStatus(false)} />
          <div className="vnStatusPanel">
            <div className="vnStatusHeader">
              <strong>상세 상태</strong>
              <button className="ghostButton compact" type="button" onClick={() => setShowStatus(false)}>닫기</button>
            </div>
            <Dashboard state={state} />
          </div>
        </div>
      )}
    </main>
  )
}

function ResultScreen({ state, result, onNext }: { state: GameState; result: Result; onNext: () => void }) {
  const [showStatus, setShowStatus] = useState(false)
  const advisorFeedback = getAdvisorFeedback(state, result)
  const focusMetric = getFocusMetric(state)
  const chapter = chapters[result.month - 1]
  const runway = getRunway(state.capital, state.burn)
  const outcomeTone = getOutcomeTone(result)
  const outcomeSignals = getOutcomeSignals(result)

  return (
    <main className="vnShell resultVnShell">
      <header className="vnTopBar">
        <div>
          <span>RESULT</span>
          <strong>{state.company.name}</strong>
        </div>
        <div className="vnQuickStats" aria-label="핵심 상태">
          <span>자본 {formatMoney(state.capital)}</span>
          <span>런웨이 {runway.toFixed(1)}개월</span>
          <span>{state.month > chapters.length ? '데모데이' : `다음 ${state.month}개월차`}</span>
        </div>
        <div className="vnActions">
          <button className="ghostButton compact" type="button" onClick={() => setShowStatus(true)}>상태</button>
        </div>
      </header>

      <section className="vnScene">
        <div className="vnBackdrop" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="vnCharacterStage">
          <CharacterPortrait type={chapter.character} />
        </div>
      </section>

      <section className="vnDialogueBox resultDialogueBox" aria-label="선택 결과">
        <div className="vnSpeakerLine">
          <div>
            <p className="eyebrow">Decision Result</p>
            <h1>{result.title}</h1>
          </div>
          <span>{chapter.speaker}</span>
        </div>
        <p className="vnQuote">“{result.narrative}”</p>

        <div className={`outcomeBanner ${outcomeTone.className}`}>
          <span>{outcomeTone.label}</span>
          <p>{outcomeTone.body}</p>
        </div>

        {outcomeSignals.length > 0 && (
          <div className="outcomeSignals" aria-label="결과 흐름">
            {outcomeSignals.map((signal) => <span key={signal}>{signal}</span>)}
          </div>
        )}

        {result.incident && (
          <div className="incidentCard">
            <span>돌발 이벤트</span>
            <strong>{result.incident.title}</strong>
            <p>{result.incident.body}</p>
          </div>
        )}

        <div className="advisorCard">
          <span>어드바이저 피드백</span>
          <p>{advisorFeedback}</p>
        </div>

        <div className="focusWide">
          <span>다음 달 우선순위</span>
          <strong>{focusMetric.label}</strong>
          <p>{focusMetric.reason}</p>
        </div>

        <div className="resultActions">
          <button className="primaryButton" type="button" onClick={onNext}>
            {state.month > chapters.length ? '데모데이 결과 보기' : `${state.month}개월차로 이동`}
          </button>
        </div>
      </section>

      {showStatus && (
        <div className="vnStatusOverlay" role="dialog" aria-label="상세 상태">
          <button className="vnStatusBackdrop" type="button" aria-label="상태 닫기" onClick={() => setShowStatus(false)} />
          <div className="vnStatusPanel">
            <div className="vnStatusHeader">
              <strong>상세 상태</strong>
              <button className="ghostButton compact" type="button" onClick={() => setShowStatus(false)}>닫기</button>
            </div>
            <Dashboard state={state} />
          </div>
        </div>
      )}
    </main>
  )
}

function EndingScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ending = getEnding(state)
  const runway = getRunway(state.capital, state.burn)
  const founderScore = getFounderScore(state)
  const achievements = getAchievements(state)
  const strategyFit = getStrategyFit(state)
  const advisorFeedback = getAdvisorFeedback(state)
  const focusMetric = getFocusMetric(state)
  const irChecklist = getIrChecklist(state)
  const irReadyCount = irChecklist.filter((item) => item.done).length
  const completedMonths = state.history.filter((_item, index) => {
    const snapshotMonth = Math.min(index + 2, chapters.length)
    return snapshotMonth <= state.month
  }).length
  const bestMetric = (Object.entries(state.metrics) as [MetricKey, number][])
    .sort((a, b) => b[1] - a[1])[0]
  const weakMetric = (Object.entries(state.metrics) as [MetricKey, number][])
    .sort((a, b) => a[1] - b[1])[0]

  return (
    <main className="endingScreen">
      <section className={`endingPanel ${ending.tone}`}>
        <p className="eyebrow">Demo Day</p>
        <h1>{ending.title}</h1>
        <p>{ending.body}</p>
        <div className="finalScore">
          <div>
            <span>Founder Score</span>
            <strong>{founderScore.grade}</strong>
          </div>
          <p>{founderScore.score}점 · {founderScore.label}</p>
        </div>
        <div className="endingStats">
          <div><span>난이도</span><strong>{difficultySettings[state.company.difficulty].label}</strong></div>
          <div><span>전략</span><strong>{strategySettings[state.company.strategy].label}</strong></div>
          <div><span>진행 개월</span><strong>{completedMonths}/{chapters.length}개월</strong></div>
          <div><span>전략 적합도</span><strong>{strategyFit.score}</strong></div>
          <div><span>IR 준비</span><strong>{irReadyCount}/{irChecklist.length}</strong></div>
          <div><span>최종 자본</span><strong>{formatMoney(state.capital)}</strong></div>
          <div><span>최종 런웨이</span><strong>{runway.toFixed(1)}개월</strong></div>
          <div><span>고객 검증도</span><strong>{state.metrics.validation}</strong></div>
          <div><span>투자 매력도</span><strong>{state.metrics.investment}</strong></div>
        </div>
        <div className="advisorCard">
          <span>최종 어드바이저 코멘트</span>
          <p>{advisorFeedback}</p>
        </div>
        <div className="focusWide">
          <span>다음 플레이 개선 포인트</span>
          <strong>{focusMetric.label}</strong>
          <p>{focusMetric.reason}</p>
        </div>
        <div className="founderReport">
          <div>
            <span>가장 강한 역량</span>
            <strong>{metricLabels[bestMetric[0]]} {bestMetric[1]}</strong>
          </div>
          <div>
            <span>다음에 보완할 지표</span>
            <strong>{metricLabels[weakMetric[0]]} {weakMetric[1]}</strong>
          </div>
        </div>
        <div className="achievementBoard">
          <strong>달성 업적</strong>
          <div>
            {achievements.map((achievement) => (
              <article className={achievement.unlocked ? 'unlocked' : ''} key={achievement.title}>
                <span>{achievement.unlocked ? '달성' : '미달성'}</span>
                <h2>{achievement.title}</h2>
                <p>{achievement.body}</p>
              </article>
            ))}
          </div>
        </div>
        {state.history.length > 0 && (
          <div className="journey">
            <strong>창업 여정</strong>
            {state.history.map((item) => (
              <div key={`${item.month}-${item.title}`}>
                <span>{item.month}개월차</span>
                <p>{item.title}</p>
              </div>
            ))}
          </div>
        )}
        <button className="primaryButton" type="button" onClick={onRestart}>다시 창업하기</button>
      </section>
    </main>
  )
}

function applyChoice(state: GameState, choice: Choice): { nextState: GameState; result: Result } {
  const runwayBefore = getRunway(state.capital, state.burn)
  const deltas: string[] = []
  const nextMetrics = { ...state.metrics }
  let investmentFailed = state.investmentFailed
  let narrative = choice.response
  let incidentResult: Result['incident']

  let { capital: nextCapital, burn: nextBurn } = applyEffect(
    choice.effect,
    nextMetrics,
    deltas,
    state.capital,
    state.burn,
  )

  if (choice.effect.adExperiment) {
    const successChance = 0.3 + nextMetrics.validation / 400
    if (Math.random() < successChance) {
      nextCapital += 300
      nextMetrics.profit = clamp(nextMetrics.profit + 12)
      nextMetrics.validation = clamp(nextMetrics.validation + 8)
      deltas.push('광고 실험 성공: 유료 고객 3명 확보, 자본 +300만 원')
      deltas.push('수익성 +12')
      narrative = '광고 클릭이 실제 결제로 이어졌습니다. 메시지와 타겟이 맞아떨어졌습니다.'
    } else {
      nextMetrics.stress = clamp(nextMetrics.stress + 8)
      deltas.push('광고 실험 실패: 클릭은 많았지만 결제 없음')
      deltas.push('스트레스 +8')
      narrative = '노출은 늘었지만 결제 전환은 나오지 않았습니다. 고객 문제와 메시지를 다시 봐야 합니다.'
    }
  }

  if (choice.effect.investmentCheck) {
    const runway = getRunway(nextCapital, nextBurn)
    const passed = nextMetrics.investment >= 70 && nextMetrics.validation >= 50 && nextMetrics.product >= 50 && runway >= 2

    if (passed) {
      nextCapital += 5000
      nextBurn += 100
      nextMetrics.investment = clamp(nextMetrics.investment + 20)
      deltas.push('Seed 투자 유치 성공: 자본 +5,000만 원')
      deltas.push('월 소진액 +100만 원')
      deltas.push('투자 매력도 +20')
      narrative = '투자자가 고객 검증과 제품 지표를 확인하고 Seed 투자를 제안했습니다.'
    } else {
      nextMetrics.stress = clamp(nextMetrics.stress + 20)
      investmentFailed = true
      deltas.push('투자 보류')
      deltas.push('스트레스 +20')
      narrative = '투자자는 관심을 보였지만 아직 고객 검증, 제품 완성도, 런웨이 중 설득력이 부족하다고 판단했습니다.'
    }
  }

  const incident = pickIncident(state, nextMetrics, nextCapital, nextBurn)
  if (incident) {
    incidentResult = { title: incident.title, body: incident.body }
    deltas.push(`돌발 이벤트: ${incident.title}`)
    const applied = applyEffect(incident.effect, nextMetrics, deltas, nextCapital, nextBurn)
    nextCapital = applied.capital
    nextBurn = applied.burn
  }

  nextCapital -= nextBurn
  deltas.push(`월 고정비 지출 -${formatMoney(nextBurn)}`)

  const runwayAfter = getRunway(nextCapital, nextBurn)
  const result: Result = {
    month: state.month,
    title: choice.label,
    narrative,
    deltas,
    runwayBefore,
    runwayAfter,
    incident: incidentResult,
  }

  const nextState: GameState = {
    ...state,
    month: state.month + 1,
    capital: nextCapital,
    burn: nextBurn,
    metrics: nextMetrics,
    pivoted: state.pivoted || Boolean(choice.effect.pivoted),
    investmentFailed,
    history: [...state.history, result],
  }

  return { nextState, result }
}

function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [state, setState] = useState<GameState | null>(null)
  const [lastResult, setLastResult] = useState<Result | null>(null)

  const isGameOver = useMemo(() => {
    if (!state) return false
    return state.capital <= 0 || state.month > chapters.length
  }, [state])

  function persist(nextState: GameState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  }

  function startGame(company: Company) {
    const nextState = createNewGame(company)
    setState(nextState)
    persist(nextState)
    setScreen('play')
  }

  function continueGame() {
    const rawSave = localStorage.getItem(STORAGE_KEY)
    if (!rawSave) return
    const nextState = normalizeSave(JSON.parse(rawSave) as GameState)
    setState(nextState)
    setScreen(nextState.month > chapters.length || nextState.capital <= 0 ? 'ending' : 'play')
  }

  function restart() {
    localStorage.removeItem(STORAGE_KEY)
    setState(null)
    setLastResult(null)
    setScreen('create')
  }

  function choose(choice: Choice) {
    if (!state) return
    const { nextState, result } = applyChoice(state, choice)
    setState(nextState)
    setLastResult(result)
    persist(nextState)
    setScreen('result')
  }

  function nextAfterResult() {
    setScreen(isGameOver ? 'ending' : 'play')
  }

  if (screen === 'create') return <CreateScreen onStart={startGame} />
  if (screen === 'play' && state) return <PlayScreen state={state} onChoose={choose} onRestart={restart} />
  if (screen === 'result' && state && lastResult) return <ResultScreen state={state} result={lastResult} onNext={nextAfterResult} />
  if (screen === 'ending' && state) return <EndingScreen state={state} onRestart={restart} />

  return <StartScreen onCreate={() => setScreen('create')} onContinue={continueGame} />
}

export default App
