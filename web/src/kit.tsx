import React, { useEffect, useState, type ReactNode } from "react";

export function useGrokTheme() {
  return { font: { family: "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif", mono: "'Pretendard Variable', Pretendard, ui-monospace, monospace" } };
}

export function Page(props: { title: string; summary?: string; width?: string; lang?: string; sources?: string[]; children?: ReactNode; footer?: ReactNode; badges?: string[]; hero?: string[]; compact?: boolean }) {
  useViewportFit();
  return (
    <>
      <header className="topbar">
        <div className="shell">
          <div className="brand">
            <img src="./favicon.svg" alt="" />
            <div><b>{props.title}</b><small>신구대학교 e스포츠과 · 밴픽 실습</small></div>
          </div>
          <div className="sp" />
          {(props.badges || []).map((b, i) => <span key={i} className={"pill" + (i > 0 ? " opt" : "")}>{i === 0 ? <i /> : null}{b}</span>)}
        </div>
      </header>
      <main className={"shell pg" + (props.compact ? " compact" : "")}>
        {props.summary ? (
          <div className="lede">
            <div className="hero-art" aria-hidden>{(props.hero || []).map((id, i) => <div key={id} className="slice" style={{ ["--i" as string]: i } as React.CSSProperties}><img src={`./champ/splash-sm/${id}.webp`} alt="" /></div>)}</div>
            <div className="lede-t"><span className="kicker">신구대학교 e스포츠과 · 밴픽 실습 도구</span><h1>프로처럼 <span>밴픽</span>하고,<br />데이터로 복기하세요</h1><p>{props.summary}</p></div>
          </div>
        ) : null}
        {props.children}
      </main>
      {props.footer}
    </>
  );
}

export function Section(props: { heading: string; caption?: string; collapsible?: boolean; defaultOpen?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState<boolean>(props.defaultOpen ?? true);
  const canToggle = !!props.collapsible;
  return (
    <section className={"sec" + (open ? " open" : "")}>
      <header className={"sec-h" + (canToggle ? " tog" : "")} onClick={canToggle ? () => setOpen(!open) : undefined} role={canToggle ? "button" : undefined} aria-expanded={canToggle ? open : undefined}>
        <div>
          <h2>{props.heading}</h2>
          {props.caption ? <p>{props.caption}</p> : null}
        </div>
        {canToggle ? <span className="chev" aria-hidden>{open ? "접기" : "펼치기"}<svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span> : null}
      </header>
      {open ? <div className="sec-b">{props.children}</div> : null}
    </section>
  );
}

export function Steps(props: { steps: { title: string; detail?: string }[] }) {
  return (
    <ol className="steps">
      {props.steps.map((s, i) => (
        <li key={i}><span className="n">{i + 1}</span><div><b>{s.title}</b>{s.detail ? <p>{s.detail}</p> : null}</div></li>
      ))}
    </ol>
  );
}

export function Properties(props: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="props">
      {props.items.map((it, i) => (<div key={i}><dt>{it.label}</dt><dd>{it.value}</dd></div>))}
    </dl>
  );
}

export function NumberedList(props: { items: ReactNode[] }) {
  return <ol className="nl">{props.items.map((x, i) => <li key={i}><span className="n">{i + 1}</span><span>{x}</span></li>)}</ol>;
}

export function Table(props: { headers?: string[]; rows?: ReactNode[][] }) {
  return (
    <table className="tbl">
      {props.headers ? <thead><tr>{props.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead> : null}
      <tbody>{(props.rows || []).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function Text(props: { children?: ReactNode; tone?: string; size?: string }) {
  return <p className="txt">{props.children}</p>;
}

// Scale the whole UI on large screens (classroom projectors) and expose the usable height
// (in zoomed CSS px) so the draft board can fill exactly one screen.
function useViewportFit() {
  useEffect(() => {
    const root = document.getElementById("root");
    const fit = () => {
      const w = window.innerWidth;
      const z = w >= 3000 ? 1.9 : w >= 2200 ? 1.45 : w >= 1680 ? Math.min(1.18, w / 1440) : 1;
      if (root) (root.style as CSSStyleDeclaration & { zoom: string }).zoom = String(z);
      const supported = typeof CSS !== "undefined" && CSS.supports("zoom", "1");
      const zz = supported ? z : 1;
      document.documentElement.style.setProperty("--app-h", `${Math.floor(window.innerHeight / zz)}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
}
