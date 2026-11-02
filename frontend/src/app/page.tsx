import Link from "next/link";
import AuthNavigation from "@/components/AuthNavigation";

const features = [
  {
    number: "01",
    icon: "♡",
    title: "Real connections",
    description:
      "Go beyond the swipe. Discover people who share your interests, values, and intentions.",
  },
  {
    number: "02",
    icon: "✦",
    title: "Your story matters",
    description:
      "Create a profile that feels like you, with room for your personality, passions, and photos.",
  },
  {
    number: "03",
    icon: "⌁",
    title: "Your pace, your choice",
    description:
      "Take your time, explore thoughtfully, and decide which connections feel right.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <div className="nav-container">
          <Link href="/" className="brand" aria-label="LetsDate home">
            <span className="brand-mark">♡</span>
            <span>
              lets<span className="brand-accent">date</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#about">Our approach</a>
            <a href="#features">Why LetsDate</a>
          </nav>

          <AuthNavigation />
        </div>
      </header>

      <section className="hero" id="about">
        <div className="hero-decoration decoration-one" />
        <div className="hero-decoration decoration-two" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />A little more meaning. A lot more
            connection.
          </div>

          <h1>
            Your next
            <br />
            chapter starts
            <br />
            with <span className="highlight-word">a hello.</span>
          </h1>

          <p className="hero-description">
            Meet people who make you smile, conversations that feel natural, and
            connections worth getting to know.
          </p>

          <div className="hero-actions">
            <Link href="/register" className="button button-large">
              Find your connection <span aria-hidden="true">↗</span>
            </Link>

            <a href="#features" className="text-link">
              Discover LetsDate <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="hero-note">
            <span className="note-heart">♡</span>
            <span>Good connections begin with being yourself.</span>
          </div>
        </div>

        <div
          className="hero-art"
          aria-label="Decorative connection illustration"
        >
          <div className="art-orbit orbit-outer" />
          <div className="art-orbit orbit-inner" />

          <div className="art-center">
            <span className="art-heart">♥</span>
          </div>

          <div className="art-card art-card-top">
            <span className="art-card-icon">✦</span>
            <span>Something real</span>
          </div>

          <div className="art-card art-card-bottom">
            <span className="art-card-icon">♡</span>
            <span>A lovely beginning</span>
          </div>

          <span className="floating-spark spark-one">✳</span>
          <span className="floating-spark spark-two">✦</span>
          <span className="floating-spark spark-three">·</span>
        </div>

        <div className="hero-bottom-label">
          <span>01 / A NEW WAY TO CONNECT</span>
          <span>MADE FOR MEANINGFUL MOMENTS</span>
        </div>
      </section>

      <section className="intro-section">
        <div className="section-kicker">NOT JUST ANOTHER DATING APP</div>

        <h2>
          Less about the perfect profile.
          <br />
          More about the <span>person behind it.</span>
        </h2>

        <p>
          We believe meeting someone should feel exciting, comfortable, and
          genuinely human. LetsDate is a place to show up as yourself and
          discover where a conversation can go.
        </p>
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <div>
            <div className="section-kicker">THE LETSDATE DIFFERENCE</div>
            <h2>
              Make room for <span>something good.</span>
            </h2>
          </div>

          <p>
            Thoughtful profiles. Genuine conversations. A little more intention
            in every introduction.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-card-top">
                <span className="feature-number">{feature.number}</span>
                <span className="feature-icon">{feature.icon}</span>
              </div>

              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing-section">
        <div className="closing-decoration">♡</div>
        <div className="section-kicker">YOUR STORY. YOUR NEXT CHAPTER.</div>

        <h2>
          It all starts
          <br />
          with <span>hello.</span>
        </h2>

        <p>
          Take the first step. Create your profile and see who you might meet.
        </p>

        <Link href="/register" className="button button-large closing-button">
          Get started with LetsDate <span aria-hidden="true">↗</span>
        </Link>
      </section>

      <footer className="site-footer">
        <Link href="/" className="brand footer-brand">
          <span className="brand-mark">♡</span>
          <span>
            lets<span className="brand-accent">date</span>
          </span>
        </Link>

        <p>Made for meaningful connections.</p>
      </footer>
    </main>
  );
}
