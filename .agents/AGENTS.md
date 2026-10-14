# Project-Scoped Rules

- **Windows Shell Execution**: When running commands on Windows, always prepend the command with `cmd /c` (e.g. `cmd /c python ...`) to ensure processes terminate correctly and send the EOF signal properly.
