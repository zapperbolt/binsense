export function PageHero({ eyebrow, title1, title2, text, children }) {
  return <section className="hero"><div><div className="eyebrow"><span className="pulse" /> {eyebrow}</div><h1>{title1}<br /><span>{title2}</span></h1><p>{text}</p></div>{children}</section>;
}
