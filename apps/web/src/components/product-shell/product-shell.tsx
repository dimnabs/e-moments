"use client";

import Image from "next/image";
import { useState } from "react";

import { frames, modes, type Frame, type Mode } from "./constants";

function Mark() {
  return <span aria-hidden="true" className="brand-mark"><span /><span /><span /><span /></span>;
}

export function ProductShell() {
  const [selectedFrame, setSelectedFrame] = useState<Frame>(frames[0]);
  const [selectedMode, setSelectedMode] = useState<Mode>(modes[0]);

  return <main>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="E-moment home"><Mark /><span>E-moment</span></a>
      <nav aria-label="Primary navigation"><a href="#how-it-works">How it works</a><a href="#frames">Frames</a></nav>
      <a className="header-action" href="/create">Start a moment <span aria-hidden="true">↗</span></a>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><span /> Digital photo box</p>
        <h1>A little closer.<br />One frame at a time.</h1>
        <p className="hero-description">Make a photo strip by yourself or with someone far away. Four tiny pauses, one keepsake to keep.</p>
        <div className="hero-actions"><a className="button button-primary" href="/create">Create a moment <span aria-hidden="true">→</span></a><a className="button button-text" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
        <p className="hero-proof">Solo or together <i /> Four photos <i /> One keepsake</p>
      </div>
      <div className="hero-art" aria-label="An example E-moment photo strip">
        <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
        <div className="photo-mat"><Image src="/images/hero-photo-strip.png" alt="A warm four-photo strip of two people smiling from different places" width={1024} height={1536} priority sizes="(max-width: 760px) 80vw, 440px" /></div>
        <div className="moment-note"><span>✦</span> Different places,<br />same moment.</div>
      </div>
    </section>

    <section className="how-it-works section-shell" id="how-it-works">
      <div className="section-heading"><p className="eyebrow"><span /> Made for the moment</p><h2>Nothing to overthink.<br />Just show up.</h2></div>
      <ol className="steps">
        <li><span>01</span><h3>Choose your company</h3><p>Keep it just you, or send a private invite to someone you miss.</p></li>
        <li><span>02</span><h3>Strike four poses</h3><p>Pick a frame, open your camera, and let the countdown do the rest.</p></li>
        <li><span>03</span><h3>Keep your strip</h3><p>Your little moment gets a home—ready whenever you want to revisit it.</p></li>
      </ol>
    </section>

    <section className="frames-section section-shell" id="frames">
      <div className="section-heading compact-heading"><p className="eyebrow"><span /> Choose your look</p><h2>Every moment has<br />its own mood.</h2></div>
      <div className="frame-layout">
        <div className={`frame-preview frame-${selectedFrame.id}`}><p>e-moment</p><div className="preview-photos" aria-hidden="true">{[0, 1, 2, 3].map((index) => <Image key={index} src="/images/hero-photo-strip.png" alt="" width={1024} height={1536} />)}</div><span>little things, 2026</span></div>
        <div className="frame-options" role="group" aria-label="Photo strip frame choices">
          {frames.map((frame, index) => <button key={frame.id} className={selectedFrame.id === frame.id ? "frame-option selected" : "frame-option"} onClick={() => setSelectedFrame(frame)} aria-pressed={selectedFrame.id === frame.id}>
            <span className={`frame-swatch swatch-${frame.id}`} aria-hidden="true"><b /><b /><b /><b /></span><span><small>0{index + 1}</small><strong>{frame.name}</strong><em>{frame.note}</em></span><span className="option-check" aria-hidden="true">{selectedFrame.id === frame.id ? "✓" : ""}</span>
          </button>)}
        </div>
      </div>
    </section>

    <section className="start-section section-shell" id="start">
      <div className="start-copy"><p className="eyebrow"><span /> Ready when you are</p><h2>Make this one<br />a keeper.</h2><p>Start with the kind of moment you want to make today.</p></div>
      <div className="mode-choices" role="group" aria-label="Choose a photo session type">
        {modes.map((mode) => <button key={mode.id} onClick={() => setSelectedMode(mode)} className={selectedMode.id === mode.id ? "mode-card selected" : "mode-card"} aria-pressed={selectedMode.id === mode.id}>
          <span className="mode-number">{mode.id === "solo" ? "01" : "02"}</span><span className="mode-content"><small>{mode.eyebrow}</small><strong>{mode.title}</strong><em>{mode.detail}</em></span><span className="mode-arrow" aria-hidden="true">{selectedMode.id === mode.id ? "↗" : "→"}</span>
        </button>)}
        <p className="selection-note"><span>✦</span> {selectedMode.title} selected — camera setup is coming next.</p>
      </div>
    </section>
    <footer><a className="brand" href="#top"><Mark /><span>E-moment</span></a><p>Your moments, beautifully framed.</p><span>© 2026</span></footer>
  </main>;
}
