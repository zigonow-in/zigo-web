# How to Use Codex Prompts for Customer API Development

## 📋 Overview

This guide explains how to use the Codex prompts created for consistent customer API development following your project's established patterns.

---

## 📁 Files Created

### 1. `.codex-customer-apis.md` (Main Reference)
**Location**: Root of project
**Size**: Comprehensive (18KB)
**Purpose**: Complete reference document with all patterns, templates, and standards

**Contains**:
- Route handler patterns (GET, POST, PUT, DELETE)
- Zod validation schemas
- Database operation patterns
- Error handling standards
- Permission checks
- Features checklist
- Response formats
- Testing expectations

**When to use**: 
- Share with Codex as main context for generating any customer API
- Reference for manual implementation
- Training document for team

### 2. `.codex-implementation-examples.md`
**Location**: Root of project  
**Size**: Detailed examples (8KB)
**Purpose**: Real-world implementation examples

**Contains**:
- 6 complete examples (Activity, Preferences, Bulk Update, Bookings, Ratings, Search)
- Each example shows: Schema → Route → Repository function
- Production-ready code snippets
- Error handling for each case
- Transaction patterns

**When to use**:
- Show Codex similar examples when generating new features
- Copy-paste as starting point
- Learn from concrete implementations

### 3. `/memories/repo/codex-patterns-summary.md`
**Location**: Repository memory (persistent in workspace)
**Size**: Quick reference (3KB)
**Purpose**: Quick lookup while coding

**Contains**:
- Route handler templates (collapsed)
- Zod schema quick examples
- Database query patterns
- Error handling reference
- Transaction/soft delete patterns
- Validation rules table
- File locations

**When to use**:
- Quick reference during implementation
- Paste into Codex prompts for shorter context
- Team reminder of core patterns

---

## 🚀 Quick Start: Generating New Customer APIs with Codex

### Step 1: Prepare Your Prompt

Copy this template and customize:

```
You are a TypeScript/Express backend developer. Generate a customer API feature 
following established patterns from this codebase.

REFERENCE: See `.codex-customer-apis.md` for complete patterns and standards.
EXAMPLES: See `.codex-implementation-examples.md` for 6 real-world examples.

Feature to implement:
- Endpoint: [POST/GET/PUT/DELETE] /customers/[path]
- Purpose: [What should this do?]
- Input validation: [Required fields and constraints]
- Business logic: [What checks/validations needed?]
- Database operations: [What should be created/updated]
- Permissions: customers.[view|edit|delete|manage]

Generate:
1. Zod validation schema
2. Route handler in customers.routes.ts
3. Repository function in customers.repository.ts
4. Include all error handling
5. Add SQL transactions where needed
6. Support soft deletes and audit trails

Follow ALL patterns from the reference documents exactly.
```

### Step 2: Provide Context to Codex

When requesting code generation, include:

```markdown
## Patterns Reference
[Paste relevant sections from `.codex-customer-apis.md`]

## Similar Examples
[Paste relevant examples from `.codex-implementation-examples.md`]

## Implementation Request
[Your specific feature request]
```

### Step 3: Key Things to Specify

Always tell Codex:

✅ **Permission Check**
- `requirePermission("customers.view")` for reads
- `requirePermission("customers.edit")` for creates/updates
- `requirePermission("customers.delete")` for deletes
- `requirePermission("customers.manage")` for admin operations

✅ **Database Patterns**
- Use parameterized queries: `$1, $2, ...` (prevents SQL injection)
- Filter out deleted records: `where deleted_at is null`
- Track audit: `created_by`, `updated_by`, `deleted_by`
- Use JSONB for flexible data: `metadata` column

✅ **Error Handling**
- 400: Bad request (validation/business logic failure)
- 404: Resource not found
- 409: Conflict (constraint violation)
- 422: Unprocessable entity

✅ **Response Format**
- Wrap in `{ data: ... }` object
- Include pagination for list endpoints
- Use camelCase for all fields
- Return ISO-8601 timestamps

---

## 📚 Example Workflow

### Scenario: Add Customer Notification Preferences API

**1. Define what you want**
```
Feature: Allow customers to manage notification preferences
Endpoint: PUT /customers/:id/notifications
Input: { email: bool, sms: bool, push: bool, offers: bool }
Permissions: customers.edit
Database: Save to preferences column
```

**2. Create Codex prompt**
```
Using patterns from `.codex-customer-apis.md` and example 2 (Preferences) 
from `.codex-implementation-examples.md`:

Generate API to update customer notification preferences:
- Endpoint: PUT /customers/:id/notifications  
- Input: { emailEnabled, smsEnabled, pushEnabled, offersEnabled }
- Store in metadata.notificationPreferences JSONB
- Require customers.edit permission
- Return updated preferences
- Include audit trail
```

**3. Codex generates**
- Schema validation (Zod)
- Route handler (follows template exactly)
- Repository function (with transaction)
- Error handling
- Soft delete support
- Audit logging

**4. Review & integrate**
- Check all patterns match existing code
- Verify permission checks
- Test error scenarios
- Add to routes file

---

## 🔄 Pattern Consistency Checklist

### Before Asking Codex to Generate

✅ **Architecture**
- [ ] Route in `customers.routes.ts`
- [ ] Business logic in `customers.repository.ts`
- [ ] Schemas defined at top of routes file
- [ ] Error handling with `HttpError`

✅ **Input Validation**
- [ ] Use Zod for all inputs
- [ ] Validate UUID formats
- [ ] Validate coordinate ranges (if needed)
- [ ] Trim and constrain strings
- [ ] Provide defaults where appropriate

✅ **Database**
- [ ] Parameterized queries (no SQL injection)
- [ ] Filter `deleted_at is null`
- [ ] Include audit fields
- [ ] Use transactions for multi-step operations
- [ ] Create appropriate indexes

✅ **Response**
- [ ] `{ data: ... }` wrapper
- [ ] camelCase field names
- [ ] ISO-8601 timestamps
- [ ] Pagination info for lists
- [ ] No sensitive data in responses

✅ **Error Handling**
- [ ] 404 for not found
- [ ] 400 for validation errors
- [ ] 409 for conflicts
- [ ] 403 for permission denied
- [ ] Meaningful error messages

---

## 📝 Sample Codex Prompt - Copy & Customize

```markdown
# Customer API Generation Request

## Context
Generate Express.js TypeScript API following patterns established in this codebase.

## Reference Documents
- Full patterns: `.codex-customer-apis.md`
- Examples: `.codex-implementation-examples.md`
- Quick ref: Query `/memories/repo/codex-patterns-summary.md`

## Feature Requirements

**Endpoint**: [METHOD] /customers/[path]
**Purpose**: [What it does]
**Permissions**: [customers.view|edit|delete|manage]

**Input**:
```typescript
{
  field1: type,
  field2: type
}
```

**Business Logic**:
1. [First check/validation]
2. [Second operation]
3. [Database write]

**Database Schema**:
- Table: [table name]
- Columns involved: [list columns]
- Relationships: [foreign keys]

**Validations**:
- [Validation 1]
- [Validation 2]

**Response**:
```json
{
  "data": {
    "field": "type"
  }
}
```

## Generate

1. Zod validation schema
2. Route handler (GET/POST/PUT/DELETE)
3. Repository function with:
   - Parameterized queries
   - Soft delete support
   - Audit trail
   - Error handling
4. All per patterns in reference docs

## Standards to Follow
- Error codes: 400, 404, 409, 422, 403
- Permission checks: requirePermission()
- Soft deletes: filter `deleted_at is null`
- Audit: track created_by, updated_by, deleted_by
- JSONB: use for flexible metadata
- Transactions: for multi-step operations
```

---

## 🛠️ Troubleshooting

### Q: Codex generates code that doesn't match patterns
**A**: Include `.codex-customer-apis.md` sections in your prompt that are most relevant

### Q: Missing error handling or validation
**A**: Add error handling reference and examples to Codex prompt

### Q: Database queries not optimized
**A**: Show Codex similar query from `.codex-implementation-examples.md`

### Q: Permissions inconsistent
**A**: Explicitly state permission code required in prompt

### Q: Response format wrong
**A**: Copy example response format to prompt from reference doc

---

## 📖 File Locations Quick Reference

| Purpose | File | Location |
|---------|------|----------|
| Complete patterns | `.codex-customer-apis.md` | Project root |
| Examples | `.codex-implementation-examples.md` | Project root |
| Quick ref | `codex-patterns-summary.md` | `/memories/repo/` |
| Routes | `customers.routes.ts` | `src/modules/customers/` |
| Logic | `customers.repository.ts` | `src/modules/customers/` |
| Auth | `auth.js` | `src/http/` |
| Errors | `errors.js` | `src/http/` |
| DB Pool | `pool.js` | `src/db/` |

---

## 🎯 Best Practices

1. **Always include permission checks** - Every API should validate `req.auth!.sub`
2. **Use transactions for multi-step ops** - Prevent partial failures
3. **Track audit trail** - For compliance and debugging
4. **Validate early** - Check business logic before database writes
5. **Soft delete** - Never hard delete customer data
6. **Meaningful errors** - Help frontend show helpful messages
7. **Pagination** - For list endpoints (max 100 items)
8. **Test edge cases** - Null inputs, wrong IDs, missing permissions

---

## 🔗 Integrated Workflow

```
1. Define feature
   ↓
2. Prepare Codex prompt (include reference docs)
   ↓
3. Generate code with Codex
   ↓
4. Verify against checklist above
   ↓
5. Add to routes and repository files
   ↓
6. Test with cURL or Postman
   ↓
7. Update memory if new pattern discovered
```

Good luck with your customer API development! 🚀
