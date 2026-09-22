# Cascade — Alexa+ Disruption Recovery Agent

**One change. The rest of your day recovers.**

Cascade is a simulated Alexa+ experience for the 2026 Amazon Developer Hackathon. It models the hard part of disruption recovery: dependency reasoning, autonomous multi-service recovery, human approval boundaries, state across turns, and compensation/rollback.

Live demo: https://cascade-vwm225.v2.appdeploy.ai/

## Core demo

Run: `My flight is delayed four hours. Keep the rest of my day intact.`

Cascade marks downstream commitments at risk, parses the stated delay, builds a recovery plan, and automatically executes safe reversible actions across simulated Calendar, Transport, Tasks, Delivery and Smart Home tools. It pauses before held reservations, paid actions, cancellations, or external messages.

Then run: `Actually, I’ll take a rideshare instead.`

The second turn replans from the **current mutated context**, not the original schedule.

## Architecture

1. Persistent synthetic context in `localStorage`.
2. Deterministic planner with scenario/intent routing and delay parsing.
3. Typed simulated tool vocabulary with `SAFE`, `CONFIRM`, and `BLOCKED` risk levels.
4. Executor with human approval gates and explicit authority boundaries.
5. Audit receipt with compensation metadata only for reversible actions.

Simulated tools include `contacts.lookup`, `calendar.update_event`, `transport.reschedule_pickup`, `transport.switch_to_rideshare`, `tasks.update`, `household.update_routine`, `delivery.reschedule`, `reservations.modify`, and `messaging.send`.

Read-only contact lookup and external message sending are intentionally non-reversible.

## Scenarios

- Flight delayed four hours — multi-service recovery plus second-turn rideshare replan.
- School closed unexpectedly — protect a hard client commitment while negotiating childcare.
- Meeting moved two hours earlier — preserve prep time and commute.
- Heavy rain from 4 PM — move flexible plans while explicitly blocking a soccer cancellation controlled by the coach.

## Alexa+ simulation path

This project uses the hackathon-permitted simulated Alexa+ web experience path. It does not claim to call production Alexa+ services or real third-party accounts. All service calls are deterministic simulations over synthetic data so the agent loop can be judged without credentials, paid APIs, or personal data.

Browser speech recognition is used when available for microphone input, and SpeechSynthesis can read the final recovery summary aloud. Text input always works.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Privacy and safety

Cascade collects no personal data and requires no account. Demo data is synthetic and stored only in the browser. Consequential actions are simulated and require confirmation. The UI never claims a blocked integration succeeded.

## License

MIT.
