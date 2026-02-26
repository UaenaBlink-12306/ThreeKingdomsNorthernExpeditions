import { useMemo, useState } from "react";

import { playMechanicalClick, playMechanicalPress } from "../utils/sound";

interface PrologueGuideProps {
  open: boolean;
  onFinish: () => void;
}

interface ProloguePage {
  chapter: string;
  title: string;
  intro: string;
  paragraphs: string[];
  basics?: string[];
}

const PROLOGUE_PAGES: ProloguePage[] = [
  {
    chapter: "卷一",
    title: "出师之局",
    intro: "时在蜀汉，北伐未定，关中与陇右系国运之轻重。",
    paragraphs: [
      "今汝所执之身，乃丞相诸葛亮。内需安朝议，外须制魏压；一令之失，可伤军心；一策之中，方可续汉祚。",
      "朝堂多议，前线多变。汝当权衡粮草、士气、政争与 Doom 之势，勿徒恃一时之勇，亦不可因循失机。",
    ],
  },
  {
    chapter: "卷二",
    title: "行军要略",
    intro: "先明胜负，再定次第，乃可稳步北进。",
    paragraphs: [
      "每回合先阅“当前事件”与“本回合变化”，后择一策而行。若无可选行动，便可推进下一回合。",
      "朝堂缓冲区中，可陈词、选策略、观群臣反应。陈词愈有理据且切中时局，支持度愈易上升。",
    ],
    basics: [
      "主目标：关中稳固达 3 回合。",
      "要务：陇右不可崩盘，Doom 切勿失控。",
      "常法：先稳粮草与士气，再图攻势。",
      "读盘：先看“Because / 下一步”，再行决断。",
      "捷键：N 新局、J 推进回合、H 开帮助。",
    ],
  },
];

export default function PrologueGuide({ open, onFinish }: PrologueGuideProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = PROLOGUE_PAGES[pageIndex];
  const isLastPage = pageIndex >= PROLOGUE_PAGES.length - 1;

  const progressText = useMemo(() => `第 ${pageIndex + 1} 页 / 共 ${PROLOGUE_PAGES.length} 页`, [pageIndex]);

  if (!open) {
    return null;
  }

  function nextPage() {
    if (isLastPage) {
      playMechanicalPress();
      onFinish();
      return;
    }
    playMechanicalClick();
    setPageIndex((current) => Math.min(PROLOGUE_PAGES.length - 1, current + 1));
  }

  function prevPage() {
    playMechanicalClick();
    setPageIndex((current) => Math.max(0, current - 1));
  }

  return (
    <div className="prologue-backdrop" role="dialog" aria-modal="true" aria-label="新局引导">
      <section className="panel prologue-card">
        <header className="prologue-header">
          <span>{page.chapter}</span>
          <small>{progressText}</small>
        </header>
        <h2>{page.title}</h2>
        <p className="prologue-intro">{page.intro}</p>
        {page.paragraphs.map((paragraph) => (
          <p key={paragraph} className="prologue-paragraph">
            {paragraph}
          </p>
        ))}
        {page.basics ? (
          <ul className="prologue-list">
            {page.basics.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="prologue-actions">
          {pageIndex > 0 ? (
            <button type="button" onClick={prevPage}>
              上一页
            </button>
          ) : (
            <span className="prologue-hint">请先阅前情，再入军议。</span>
          )}
          <button type="button" className="primary-cta" onClick={nextPage}>
            {isLastPage ? "入局执令" : "下一页"}
          </button>
        </div>
      </section>
    </div>
  );
}
