# SIS Course Scheduler

Course scheduling optimization service using Google OR-Tools CP-SAT solver.

## Features

- Constraint-based course scheduling
- Room and time slot optimization
- Instructor preference handling
- Cross-list and linked section support
- Bidirectional database integration

## Development

```bash
uv sync
uv run uvicorn scheduler.api.app:app --reload
```

## API

- `POST /solve` - Run solver with provided input
- `POST /solve-from-db` - Load from database, solve, and save results
- `POST /validate` - Validate input without solving
