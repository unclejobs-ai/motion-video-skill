// The one-word cut's content: the word, the sheets that hand it over, and the ending. Edit this file (or copy the folder)
// to make your own; timing comes from plan.ts (written by plan.mjs from a reference analysis), the structure is fixed.
// Every text field marks the word with {w}; every sheet must hold it exactly once (checked by timing.test.ts).
// The demo is invented and neutral: a person keeps meaning to take a walk. No real names, places or claims.
export type Aspect = '9x16' | '16x9';
export type SheetKind = 'post' | 'receipt' | 'qa' | 'news' | 'chat' | 'subtitle' | 'memo' | 'search' | 'diary' | 'notice';

export type Sheet =
  | { kind: 'post'; meta: string; title: string; body: string[]; tags: string }
  | { kind: 'receipt'; title: string; sub: string; rows: [string, string][]; total: [string, string] }
  | { kind: 'qa'; chips: string[]; q: string; body: string[] }
  | { kind: 'news'; headline: string; body: string[] }
  | { kind: 'chat'; bubbles: { me?: boolean; text: string }[] }
  | { kind: 'subtitle'; lines: { tc: string; text: string }[] }
  | { kind: 'memo'; top: [string, string]; title: string; items: { done?: boolean; text: string }[] }
  | { kind: 'search'; query: string; suggestions: string[] }
  | { kind: 'diary'; date: string; lines: string[] }
  | { kind: 'notice'; clock: string; day: string; cards: { app: string; when: string; title: string; text: string }[] };

export const DATA = {
  /** the word that stays in one slot for the whole film (Hangul or Latin; keep it short) */
  word: '산책',
  /** default framing; render.mjs can override it per run */
  aspect: '9x16' as Aspect,
  /** sheets in the order they first appear; the burst cycles through them again */
  sheets: [
    { kind: 'post', meta: '일상 · 익명 · 3분 전', title: '퇴근하고 바로 눕게 되는 거, 저만 그런가요', body: ['요즘은 집에 오면 아무것도 하기 싫어요. 주말엔 더 그래요.', '친구는 저녁에 {w}이라도 해 보래요. 정말 달라질까요?', '일단 운동화부터 현관에 꺼내 뒀어요.'], tags: '#저녁루틴 #작심삼일 #걷기' },
    { kind: 'receipt', title: '동네문구', sub: '영수증 · 2026-10-12 19:42', rows: [['손목 시계줄', '6,500'], ['{w} 수첩', '4,800'], ['볼펜 3색', '2,000'], ['물통 500ml', '7,000']], total: ['합계', '20,300'] },
    { kind: 'qa', chips: ['#생활습관', '#걷기', '#저녁'], q: '저녁 {w}, 몇 분부터 해야 효과가 있나요?', body: ['처음엔 시간보다 매일 나가는 게 더 중요해요. 10분이라도 같은 시간에 나가 보세요.', '익숙해지면 조금씩 늘려도 늦지 않아요.'] },
    { kind: 'news', headline: '가을 저녁, 다시 늘어난 {w} 인구', body: ['해가 짧아지면서 퇴근 뒤 동네를 걷는 사람이 늘었다. 공원 둘레길은 저녁 일곱 시면 붐빈다.', '걷는 이유는 저마다 다르다. 생각을 정리하려고, 잠을 잘 자려고, 그냥 바람을 쐬려고.', '무엇보다 부담 없이 시작할 수 있다는 점이 꼽혔다.'] },
    { kind: 'chat', bubbles: [{ text: '오늘 저녁에 시간 돼?' }, { me: true, text: '응, 여덟 시에 공원 {w} 어때?' }, { text: '좋아. 편한 신발 신고 갈게.' }, { me: true, text: '물만 챙겨 오면 돼.' }] },
    { kind: 'subtitle', lines: [{ tc: '00:03:12,400 → 00:03:14,200 · 1.8초', text: '거창한 게 아니라 결국 {w}부터였어요' }, { tc: '00:03:14,400 → 00:03:16,300 · 1.9초', text: '집 앞 한 바퀴로 시작했죠' }] },
    { kind: 'memo', top: ['‹ 메모', '10월 11일 금요일'], title: '이번 주말', items: [{ done: true, text: '세탁소 들르기' }, { text: '토요일 아침 {w}' }, { text: '운동화 끈 바꾸기' }, { text: '물통 씻어 두기' }] },
    { kind: 'search', query: '{w}', suggestions: ['코스', '시간', '음악 추천', '하기 좋은 날씨'] },
    { kind: 'diary', date: '10월 9일 목요일 · 맑음', lines: ['저녁 먹고 나가 보니 바람이 좋았다.', '짧은 {w}, 그래도 오늘은 나갔다.', '내일도 같은 시간에 나가 봐야지.'] },
    { kind: 'notice', clock: '7:42', day: '10월 12일 토요일', cards: [{ app: '메시지', when: '지금', title: '친구', text: '오늘도 {w} 갈 거지?' }, { app: '캘린더', when: '오전 8:00', title: '아침 걷기', text: '물통 챙기기' }] },
  ] satisfies Sheet[] as Sheet[],
  /** the ending: a textbook line whose letters scatter, then the word becomes a dictionary head word */
  textbook: { chapter: '3장 · 몸과 습관', before: ['몸은 쓰는 만큼 깨어나고, 쉬는 만큼 회복한다. 둘 사이의 균형이 하루의 결을 정한다.'], line: ['가볍게 바람을 쐬며 천천히 걷는 일을 ', '이라고 부른다.'], after: ['방법은 사람마다 다르다. 같은 이름으로 부르지만 걷는 이유는 저마다 있다.'] },
  /** optional closing image (a file under the engine's public/ folder, e.g. 'closing.jpg'): the last beat fades to it
   *  and holds while the word stays in its slot on top. null ends on the dictionary page. */
  closing: null as string | null,
  dict: [{ tag: '명사', text: '휴식이나 건강을 위해서 천천히 걷는 일' }, { text: '저녁마다 공원을 산책하다' }, { tag: '비슷한말', text: '산보(散步)' }, { tag: '영어', text: 'walk' }],
  /** paper colour per sheet kind behind the sheet */
  bg: { post: '#121314', receipt: '#fbfaf6', qa: '#ffffff', news: '#f3efe4', chat: '#e9ecef', subtitle: '#1b1d20', memo: '#fffdf7', search: '#ffffff', diary: '#fbf8f1', notice: '#22262c', textbook: '#faf7ef', dict: '#F6F3EC' },
} as const;
