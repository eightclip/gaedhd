# Why GaeDHD works the way it does — the research

GaeDHD's design isn't vibes. Every flow below maps to published evidence on adult
ADHD — heavily weighted toward Harvard Medical School / Mass General Hospital
sources and peer-reviewed clinical literature, with a deliberate focus on **women
with ADHD**, where the emotional and social burden is highest and most under-served.

The product is built around four goals: **minimize ADHD's negative impacts**, and
make her more **self-sufficient**, more **outwardly facing**, and more **decisive**.

> This doc is the source of truth for *why* a feature exists. Before changing the
> tone of a nudge, the streak rules, or the help/coaching flows, read the relevant
> section so we don't accidentally undo something that's load-bearing.

---

## Foundational principles (apply everywhere)

- **Cognitive offloading / externalization.** The single highest-value ADHD
  strategy is moving tasks, reminders, and commitments *out of the head* into a
  trusted external system, preserving executive bandwidth. This is the entire
  "second brain" premise (capture, inbox, the bot).
  Harvard Health, *Confronting Adult ADHD*:
  https://www.health.harvard.edu/mind-and-mood/confronting-adult-adhd
- **Grace over shame.** 35–70% of adults with ADHD have significant emotional
  dysregulation; it is worse in women and tied to Rejection Sensitive Dysphoria
  (RSD). Shaming language and punitive mechanics drive the abandonment spiral.
  Every string in the app is written to be kind.
  ADDitude, *Rejection Sensitivity in Women with ADHD*:
  https://www.additudemag.com/rejection-sensitivity-women-adhd/
- **Scaffold, then fade.** Support only produces independence when it is
  *gradually withdrawn* as the skill is internalized. A permanent crutch builds
  dependence, not capacity.
  Executive-function coaching & self-determination (ERIC EJ861189):
  https://eric.ed.gov/?id=EJ861189
- **CBT for adult ADHD** (the clinical gold standard, developed at MGH/Harvard)
  targets three things: organizing, ignoring distractions, and the maladaptive
  *thoughts/avoidance* ("I can't do this"). Safren et al., *Mastering Your Adult ADHD*:
  https://chadd.org/attention-article/mastering-your-adult-adhd/

---

## Feature → evidence map

### Phase 1 — Protect what already works

**1. Varied nudge copy (anti-habituation).** ADHD brains habituate to identical
repeated alerts faster than neurotypical brains and begin filtering them as
background noise ("when every notification looks the same, the brain files it as
noise"). The fix is rotating phrasing / novelty. So the nudge channel cycles
through multiple wordings per ritual instead of one fixed string.
- AFFiNE, *Setting Effective Reminders ADHD Brains Actually Notice*:
  https://affine.pro/blog/setting-effective-reminders-adhd
- Implemented in: `src/lib/rituals.ts` (`nudgeVariants`, `pickNudge`),
  `telegram-bot/index.js` (rotation), `src/components/WaterTracker.tsx`.

**2. Forgiving momentum streak.** A single all-or-nothing streak that resets to 0
on one missed day is a classic ADHD/RSD abandonment trigger, and the dopamine lift
from streaks fades (hedonic adaptation) — "the streak becomes the goal instead of
the activity." So our streak forgives an isolated missed day and is paired with a
calmer "X of last 7 days" view that never displays a punishing zero.
- AFFiNE, *Gamified To-Do Apps ADHD Brains Stick With* (streak plateau):
  https://affine.pro/blog/gamified-to-do-list-apps-adhd
- Implemented in: `src/lib/momentum.ts`, `src/lib/store.ts` (`activeDays`).

### Phase 2 — The emotional layer

**3. "I'm overwhelmed" reset.** Emotional dysregulation is core to adult ADHD
(35–70%) and the standard of care is distress tolerance + reducing the field to a
single action. The app gives her a one-tap path that collapses the day to one tiny
task with a grounding line.
- Cleveland Clinic, *Rejection Sensitive Dysphoria*:
  https://my.clevelandclinic.org/health/diseases/24099-rejection-sensitive-dysphoria-rsd
- Lived experience of rejection sensitivity in ADHD (medRxiv):
  https://www.medrxiv.org/content/10.1101/2024.11.16.24317418.full.pdf

**4. Reframe on repeated skip.** Targets the CBT third pillar — the avoidance loop
and the "I can't do this" distortion — by offering a gentle reframe + a tiny
version when she keeps skipping the same thing.
- Safren et al., *Mastering Your Adult ADHD* (CBT):
  https://chadd.org/attention-article/mastering-your-adult-adhd/

**5. Optional evening check-in.** Builds emotional self-awareness with a low-friction
daily signal; ships off by default to avoid added nag load.
- Cognitive-behavioral / mindfulness skills as standard of care (see RSD sources above).

### Phase 3 — Build her capacity

**6. "Just start (2 min)" tiny-first-step.** Task-initiation failure is among the
most disabling features of adult ADHD; shrinking the *entry* (behavioral activation)
matters more than shrinking the task.
- Envision ADHD, *Why Starting Is Hard*:
  https://www.envisionadhd.com/single-post/why-starting-is-hard-the-science-of-task-initiation-in-adult-adhd-and-what-actually-helps
- SaskADHD, *Task Initiation: Evidence-Based Strategies*:
  https://saskadhd.com/adhd-task-initiation-evidence-based-strategies-that-actually-work/

**7. "Stuck deciding?" helper.** 82% of adults with ADHD report decision
difficulty; more choices trigger the same shutdown as high-stakes decisions.
Time-boxing, default choices, and a "60% right" rule measurably reduce decision
paralysis within weeks — and teaching the framework (vs. deciding for her) builds
the skill.
- *ADHD and Decision Paralysis: Overwhelm in a World of Choices* (PMC):
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12438291/
- Decision strategies overview:
  https://neurolaunch.com/analysis-paralysis-adhd/

**8. Fading decomposition (full → first-step-only → prompt-only).** The core
self-sufficiency lever: coaching uses an *inquiry approach that fosters
self-determination*, fading help as she internalizes the process.
- ERIC EJ861189 (self-determination coaching):
  https://eric.ed.gov/?id=EJ861189
- CHADD, *Coaching*: https://chadd.org/about-adhd/coaching/

### Phase 4 — Outwardly facing

**9. `relationships` category + reach-out ritual.** RSD drives *pre-emptive
withdrawal* from friendships, family, romance, and opportunities. Giving social
connection its own surface counters that.
- Lived experience of rejection sensitivity (medRxiv):
  https://www.medrxiv.org/content/10.1101/2024.11.16.24317418.full.pdf

**10. Assertiveness helper ("help me say…").** Self-advocacy and assertiveness are
*teachable skills*, not traits — the bot drafts kind "I"-statement scripts.
- ADDitude, *Stand Up for Yourself: Assertiveness for ADHD Adults*:
  https://www.additudemag.com/stand-up-for-yourself-assertiveness-adhd/

**11. Body doubling (shared focus session).** Doing a task in the low-interaction
presence of another person lowers activation energy; a 117-person study of ADHD
users found faster re-engagement and more consistent focus. John is the built-in
body double.
- ADD Resource Center, *Body Doubling and ADHD*:
  https://www.addrc.org/body-doubling-and-adhd-does-working-alongside-help/

---

## Time-blindness (already strong, worth protecting)

Countdown timers, the live timeline + now-marker, "minutes left" on meetings, and
the meeting wrap-up nudge all target the time-perception deficit. Don't remove them.
- Stanford CTL, *Managing Time Blindness*:
  https://ctl.stanford.edu/managing-time-blindness

---

*Compiled from the GaeDHD ADHD flow audit. If you add a feature that touches
attention, emotion, motivation, or decision-making, add its citation here.*
