# Illustrative Workflow Control Review

**Purpose:** Show the format and level of specificity delivered in the Ops Control HQ two-day workflow review.

**Important:** This is a fictional, public-safe example. It is not a client engagement, testimonial, or claim about a real company.

## Scenario and scope

A 12-person services business receives new customer requests through a web form and shared inbox. Sales qualifies the request, Operations creates the delivery record, Finance verifies commercial terms, and a delivery owner begins work.

Scope: from receipt of a new request through confirmed delivery kickoff.  
Roles in scope: Requester, Sales, Operations, Finance, Delivery Owner.  
Evidence assumed: form export, shared-inbox examples, CRM stage definitions, invoice checklist, and kickoff template.

## 1. Current-state workflow map

| Step | Trigger | Owner | Required evidence | Decision / handoff | Control |
|---|---|---|---|---|---|
| 1. Capture request | Form or email received | Sales | Contact, request, source, timestamp | Is the request complete enough to review? | Required-field check |
| 2. Qualify | Complete request | Sales | Fit, urgency, budget range, constraints | Accept, reject, or request clarification | Qualification reason recorded |
| 3. Create delivery record | Accepted request | Operations | Approved scope and promised date | Is one canonical record present? | Duplicate search before creation |
| 4. Verify commercial terms | Delivery record created | Finance | Price, payment terms, billing entity | Clear or return exception | Independent terms check |
| 5. Assign delivery owner | Finance-cleared record | Operations | Capacity and required skill | Named owner accepts or declines | Acceptance timestamp |
| 6. Confirm kickoff | Owner accepted | Delivery Owner | Scope, inputs, date, responsibilities | Ready or blocked | Readiness checklist |

## 2. Ownership and decision rights

| Decision | Accountable owner | Input required from | Escalation condition |
|---|---|---|---|
| Request is commercially qualified | Sales lead | Requester | Missing price authority or unclear buyer |
| Delivery record is canonical | Operations lead | Sales | Possible duplicate or conflicting scope |
| Terms are cleared | Finance lead | Sales, Operations | Unapproved discount, missing entity, or nonstandard terms |
| Delivery can start | Delivery owner | Operations, Requester | Missing inputs, capacity conflict, or date risk |
| Exception is accepted | Operations lead | Relevant decision owner | Exception remains open beyond target time |

## 3. Failure and exception points

| Risk | Detection signal | Immediate action | Owner |
|---|---|---|---|
| Request exists only in email | No canonical record within 2 business hours | Create record or document rejection | Sales |
| Duplicate delivery records | Matching customer + scope + target date | Freeze both records and merge history | Operations |
| Scope changes after terms check | Scope timestamp newer than finance approval | Re-run commercial review | Finance |
| Work begins without owner acceptance | Activity logged before acceptance timestamp | Pause work and assign accountable owner | Operations |
| Kickoff date promised without required inputs | Missing checklist items at T-1 day | Notify requester and reset date explicitly | Delivery Owner |

## 4. KPI and control checks

| Measure | Definition | Target | Review cadence |
|---|---|---|---|
| Capture latency | Median time from request receipt to canonical record | Under 2 business hours | Weekly |
| Qualification completeness | Qualified requests with all required fields | At least 95% | Weekly |
| Duplicate rate | Duplicate records / records created | Under 1% | Weekly |
| Terms exception rate | Records returned by Finance / records checked | Track baseline; then reduce | Monthly |
| Owner acceptance latency | Time from assignment to accept/decline | Under 4 business hours | Weekly |
| Ready-at-kickoff rate | Kickoffs with all required inputs complete | At least 90% | Monthly |
| Aged exception count | Open exceptions beyond target time | Zero critical; downward trend overall | Daily queue |

Each metric requires a named source system, query owner, and exception route before it is treated as production-ready.

## 5. Prioritized 30/60/90-day sequence

### First 30 days

1. Name one canonical delivery record and prohibit shadow trackers.
2. Add required qualification fields and standardized rejection reasons.
3. Add Finance clearance and Delivery Owner acceptance timestamps.
4. Start a daily aged-exception queue owned by Operations.
5. Measure the seven baseline metrics without setting punitive targets.

### Days 31–60

1. Remove the two highest-volume exception causes.
2. Add duplicate detection before record creation.
3. Publish decision rights for discounts, nonstandard terms, and kickoff-date changes.
4. Review metrics weekly with named corrective actions.

### Days 61–90

1. Automate reminders only for proven, recurring exceptions.
2. Set service targets using the measured baseline.
3. Sample completed records monthly for control adherence.
4. Retire any tracker that does not feed the canonical record.

## 6. Executive summary

The workflow does not primarily need more software. It needs one canonical record, explicit commercial clearance, affirmative owner acceptance, and a visible exception queue. Those controls make lost requests, duplicate work, unapproved terms, and false-ready kickoffs detectable before they become customer failures.

## What a real engagement adds

A paid review replaces every illustrative assumption above with supplied evidence, marks unknowns explicitly, maps up to eight roles or handoffs, separates verified facts from risks and assumptions, and includes one factual correction round.
