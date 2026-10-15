interface ComingSoonProps {
  title: string;
  hint: string;
}

export function ComingSoon({ title, hint }: ComingSoonProps) {
  return (
    <section className="card card--stub" aria-label={title}>
      <h3 className="card__title">{title}</h3>
      <p className="card__hint">Coming soon. {hint}</p>
    </section>
  );
}
