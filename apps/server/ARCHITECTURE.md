# Backend Architecture

The backend has been refactored into a layered architecture with clear separation of concerns:

## Structure

```
src/
├── index.ts              # Main server entry point
├── api/                  # API Layer - HTTP routing and request/response handling
│   ├── health-router.ts
│   └── integration-router.ts
├── bl/                   # Business Logic Layer - Business rules and orchestration
│   ├── provider-service.ts
│   ├── service-service.ts
│   └── ssh-service.ts
└── dal/                  # Data Access Layer - Database operations and external integrations
    ├── database.ts
    ├── provider-repository.ts
    └── service-repository.ts
```

## Layer Responsibilities

### API Layer (`api/`)
- Handle HTTP requests and responses
- Route requests to appropriate business logic
- Manage request validation and error formatting
- Keep controllers thin and focused on HTTP concerns

### Business Logic Layer (`bl/`)
- Implement business rules and logic
- Orchestrate between different data access objects
- Handle complex operations that span multiple entities
- Validate business constraints

### Data Access Layer (`dal/`)
- Manage database connections and operations
- Provide CRUD operations for entities
- Handle external service integrations (SSH, Docker)
- Abstract data persistence details

## Benefits

1. **Separation of Concerns**: Each layer has a single, well-defined responsibility
2. **Testability**: Layers can be tested independently with proper mocking
3. **Maintainability**: Changes in one layer don't affect others
4. **Scalability**: Easy to add new features following the established patterns
5. **Code Reusability**: Business logic can be reused across different API endpoints