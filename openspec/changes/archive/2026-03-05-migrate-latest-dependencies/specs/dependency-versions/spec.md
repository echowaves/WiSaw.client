## ADDED Requirements

### Requirement: Build tooling versions
The project SHALL use the following build tooling versions as minimum baselines.

#### Scenario: Vite version
- **WHEN** the project is built or served in development
- **THEN** the build tool SHALL be Vite 7.x or later

#### Scenario: Vite React plugin version
- **WHEN** the Vite build processes React JSX
- **THEN** the @vitejs/plugin-react SHALL be version 5.x or later

### Requirement: Linting tooling versions
The project SHALL use current ESLint major version.

#### Scenario: ESLint version
- **WHEN** the linter is executed
- **THEN** ESLint SHALL be version 10.x or later
- **THEN** @eslint/js SHALL be version 10.x or later

### Requirement: Test environment version
The project SHALL use a current jsdom version for test rendering.

#### Scenario: jsdom version
- **WHEN** tests are executed via vitest with jsdom environment
- **THEN** jsdom SHALL be version 28.x or later

### Requirement: Runtime dependency freshness
Patch and minor updates to runtime dependencies SHALL be applied.

#### Scenario: Helmet library version
- **WHEN** SEO metadata is rendered
- **THEN** @dr.pogodin/react-helmet SHALL be version 3.1.x or later

#### Scenario: GraphQL library version
- **WHEN** GraphQL queries are executed
- **THEN** the graphql package SHALL be version 16.13.1 or later
