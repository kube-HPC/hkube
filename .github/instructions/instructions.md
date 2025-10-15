---
# Node.js Backend Project Guidelines
---

### Project Setup
- Use **Node.js (v18+)** and **Express.js** for building APIs.
- Store configuration in environment variables (`.env`), and use the config files already present, if they exist.
- follow ES6+ JavaScript conventions.

### Style & Formatting
- Use **camelCase** for variables and function names.
- Apply **2-space indentation**.
- Prefer **single quotes** for strings.
- Always use **async/await** for asynchronous operations.
- Use **ESLint** with the **Airbnb Base** style guide (see `.eslintrc` or `package.json`).


### Architecture & Patterns
- Organize code into clear layers: `routes/`, `controllers/`, `services/`, `models/`.
- Keep business logic in services; route handlers should be thin.

### Error Handling & Security
- Implement centralized error handling middleware (must include status codes and JSON error messages), or adhere to existing code that handles it
- Always validate and sanitize inputs.
- For cookies or sessions, ensure `httpOnly`, `secure` (in prod), and `sameSite: 'strict'`.

### Testing
- Use **Mocha** for unit tests, always look for /tests/*/*.js or /test/*.js to learn the styling and test formats
- Maintain ≥80% test coverage.

### Build & Deployment
- Build command: `npm run build`.
- Start server with `npm start`;

### Documentation & Maintenance
- Tag PRs with [FEATURE], [BUGFIX], or [REFACTOR].

---

```markdown
---
applyTo: "tests/**/*.js"
---

# Test File Guidelines
- Write clear, descriptive test names.
- Use `describe` and `it` blocks from Jest.
- Clean up any test data or mocks after each test.
