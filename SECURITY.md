# Security Policy

## Supported Versions

Hormus is currently early-stage software. Security fixes are prioritized on the latest `main` branch and the most recent tagged release.

## Reporting A Vulnerability

Do not open a public GitHub issue for security-sensitive problems.

Report issues privately to:

- `abhilash@rejanair.com`

Please include:

- a clear description of the issue
- affected versions or commit SHAs
- reproduction steps or proof of concept
- impact assessment
- any suggested mitigation if you have one

## Response Expectations

The project will aim to:

- acknowledge reports within 5 business days
- provide an initial triage update within 10 business days
- coordinate disclosure timing with the reporter when the report is valid

## Scope

Security-sensitive areas in this project include:

- credential storage and retrieval
- Electron preload and IPC boundaries
- query execution and read-only enforcement
- release artifacts and packaging

## Public Disclosure

Please give maintainers reasonable time to investigate and ship a fix before public disclosure.
