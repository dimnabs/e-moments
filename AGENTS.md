# E-moment agent rules

## Git workflow

- `main` contains production-ready code only.
- `dev` is the integration branch for development-complete work.
- Create every `feature/<name>` branch from the latest `dev`.
- For every completed feature, commit the work, push its feature branch, and create a pull request targeting `dev`.
- Do not merge a pull request unless the user explicitly asks.

## Delegation

- Delegate frontend UI styling work to an Astra sub-agent.
- Delegate easy or recurrent non-UI work to a Luna sub-agent.
- Delegate other non-UI work to a Terra sub-agent by default.
