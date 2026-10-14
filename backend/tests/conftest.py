"""Test setup: never let unit tests reach a real database or start the reminder scheduler."""
import os

# Set before the app's config module runs load_dotenv(), which does not override
# existing variables. Nothing listens on port 1, so any stray query fails fast.
os.environ["DATABASE_URL"] = "postgresql://test:test@127.0.0.1:1/test"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
